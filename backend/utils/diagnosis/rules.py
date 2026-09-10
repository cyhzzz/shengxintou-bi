# -*- coding: utf-8 -*-
"""智能辅助诊断 - 规则评估层（纯函数，无 IO）

11 条规则与阈值定义见 docs/superpowers/specs/2026-09-09-智能辅助诊断.md 第 5.4 节。
"""
from datetime import date

MATURITY_DAYS = 7
COLLAPSE_MIN_RUN = 3
COLLAPSE_RATIO = 0.5
COLLAPSE_MIN_DAILY = 5
OPEN_MOM_WARN = 0.7
OPEN_MOM_ERROR = 0.5
OPEN_ABS_LOW = 0.3
VALID_DROP_WARN = 0.2
STOCK_MIX_WARN = 0.05
FUNNEL_DROP_WARN = 0.3
FUNNEL_DROP_ERROR = 0.5
DEVICE_SHARE_WARN = 0.10
DEVICE_SHARE_ERROR = 0.03
ASSETS_DROP_WARN = 0.4
FRESH_WARN_DAYS = 5
FRESH_ERROR_DAYS = 14
ALIGN_MAX_SPREAD = 3
STALLED_GAP_DAYS = 14
STALLED_MIN_LEADS = 20
STALLED_WINDOW_DAYS = 60

LEVEL_RANK = {'error': 0, 'warn': 1, 'info': 2}
CHAIN_RANK = {'appmarket': 0, 'global': 1, 'xhs': 2}

FUNNEL_STEPS = [
    ('activated', 'downloads', '激活/下载'),
    ('registered', 'activated', '注册/激活'),
    ('account_created', 'registered', '完资金账号/注册'),
]


def _rate(numerator, denominator):
    if not denominator:
        return None
    return numerator / denominator


def _make_item(item_id, chain, level, title, detail, evidence, suggestion):
    return {
        'id': item_id,
        'chain': chain,
        'level': level,
        'title': title,
        'detail': detail,
        'evidence': evidence,
        'suggestion': suggestion,
    }


def rule_snapshot_freshness(ctx):
    stale_error = []
    stale_warn = []
    for snapshot in ctx['snapshot_dates']:
        days_ago = snapshot['days_ago']
        if days_ago is None or days_ago > FRESH_ERROR_DAYS:
            stale_error.append(snapshot)
        elif days_ago > FRESH_WARN_DAYS:
            stale_warn.append(snapshot)
    if not stale_error and not stale_warn:
        return None
    affected = stale_error + stale_warn
    lines = []
    for snapshot in affected:
        days_text = snapshot['days_ago'] if snapshot['days_ago'] is not None else '未知'
        lines.append(f"{snapshot['name']}: 最新 {snapshot['latest'] or '无数据'}（{days_text} 天前）")
    return _make_item(
        'snapshot_freshness', 'global',
        'error' if stale_error else 'warn',
        '底表快照新鲜度不足',
        f'存在超过 {FRESH_WARN_DAYS} 天未更新的底表，基于旧快照的月度诊断可能低估最新趋势',
        '；'.join(lines),
        '确认上游 ETL 是否正常运行，或等待数据更新后重新生成诊断',
    )


def rule_snapshot_alignment(ctx):
    if ctx['snapshot_min'] is None or ctx['snapshot_max'] is None:
        return None
    spread = (ctx['snapshot_max'] - ctx['snapshot_min']).days
    if spread <= ALIGN_MAX_SPREAD:
        return None
    lines = [f"{snapshot['name']}: {snapshot['latest'] or '无数据'}" for snapshot in ctx['snapshot_dates']]
    return _make_item(
        'snapshot_alignment', 'global', 'warn',
        '底表快照日期不一致',
        f'六张底表最新数据日期极差 {spread} 天（>{ALIGN_MAX_SPREAD} 天），跨表对比可能失真',
        '；'.join(lines),
        '排查更新滞后的底表所属上游链路，对齐各表更新节奏后再复核结论',
    )


def rule_maturity_window(ctx):
    snapshot_max = ctx['snapshot_max']
    eval_cutoff = ctx['eval_cutoff']
    if snapshot_max is None or eval_cutoff is None or not ctx['month']:
        return None
    if ctx['month'] != snapshot_max.strftime('%Y-%m'):
        return None
    month_start = date(snapshot_max.year, snapshot_max.month, 1)
    if eval_cutoff < month_start:
        window_days = 0
    else:
        window_days = (eval_cutoff - month_start).days + 1
    if window_days >= MATURITY_DAYS:
        return None
    return _make_item(
        'maturity_window', 'global', 'info',
        '当前月份观察窗未成熟',
        f'报告月与数据快照同月，成熟观察窗仅 {window_days} 天（<{MATURITY_DAYS} 天），本月结论仅供参考',
        f'快照日 {snapshot_max.isoformat()}，评估窗截止 {eval_cutoff.isoformat()}',
        '建议在次月快照更新后重新查看本月诊断',
    )


def rule_platform_stalled(ctx):
    platforms = [item for item in ctx['platform_activity'] if item['last_date']]
    if not platforms:
        return None
    global_last = max(date.fromisoformat(item['last_date']) for item in platforms)
    stalled = []
    for item in platforms:
        gap = (global_last - date.fromisoformat(item['last_date'])).days
        if item['leads'] >= STALLED_MIN_LEADS and gap > STALLED_GAP_DAYS:
            stalled.append((item, gap))
    if not stalled:
        return None
    stalled.sort(key=lambda pair: -pair[1])
    lines = [
        f"{item['platform']}: 最近线索 {item['last_date']}（落后全局 {gap} 天，近 60 天线索 {item['leads']} 条）"
        for item, gap in stalled
    ]
    return _make_item(
        'platform_stalled', 'xhs', 'warn',
        '部分内容平台线索停滞',
        f'以下平台近 60 天线索量达到统计门槛（≥{STALLED_MIN_LEADS} 条），但最近线索日期落后全局 {STALLED_GAP_DAYS} 天以上，可能已停投或上游断更',
        '；'.join(lines),
        '与投放同学确认这些平台是否停投；若仍在投则排查线索回传链路',
    )


def rule_open_rate_collapse(ctx):
    cutoff = ctx['eval_cutoff']
    if cutoff is None:
        return None
    window = [row for row in ctx['content_daily'] if row['date'] <= cutoff]
    if not window:
        return None
    total = sum(row['total'] for row in window)
    opened = sum(row['opened'] for row in window)
    baseline = _rate(opened, total)
    if not baseline:
        return None
    threshold = baseline * COLLAPSE_RATIO
    failing = []
    for row in window:
        rate = _rate(row['opened'], row['total'])
        if row['total'] >= COLLAPSE_MIN_DAILY and rate is not None and rate < threshold:
            failing.append(row)
    if not failing:
        return None
    longest = []
    current = [failing[0]]
    for prev_row, cur_row in zip(failing, failing[1:]):
        if (cur_row['date'] - prev_row['date']).days == 1:
            current.append(cur_row)
        else:
            if len(current) > len(longest):
                longest = current
            current = [cur_row]
    if len(current) > len(longest):
        longest = current
    if len(longest) < COLLAPSE_MIN_RUN:
        return None
    shown = longest[:8]
    rates = '、'.join(
        f"{row['date'].isoformat()} {row['opened']}/{row['total']}={row['opened'] / row['total']:.1%}"
        for row in shown
    )
    if len(longest) > len(shown):
        rates += f" 等 {len(longest)} 天"
    return _make_item(
        'open_rate_collapse', 'xhs', 'error',
        '开口率连续塌陷',
        f'评估窗内开口率连续 {len(longest)} 个自然日低于当月基线的 {COLLAPSE_RATIO:.0%}，通常为上游开口状态回写缺失或投放素材异常',
        f"当月基线 {baseline:.1%}，塌陷区间 {longest[0]['date'].isoformat()} 至 {longest[-1]['date'].isoformat()}；{rates}",
        '先核对上游 ETL 是否漏更「是否客户开口」状态，再与投放确认素材与链路',
    )


def rule_open_rate_level(ctx):
    cur = ctx['cur_mature']
    prev = ctx['prev_window']
    cur_rate = _rate(cur['opened'], cur['total'])
    prev_rate = _rate(prev['opened'], prev['total'])
    if cur_rate is None or not prev_rate:
        return None
    ratio = cur_rate / prev_rate
    if ratio >= OPEN_MOM_WARN:
        return None
    level = 'error' if ratio < OPEN_MOM_ERROR else 'warn'
    if cur_rate < OPEN_ABS_LOW and ratio < 1:
        level = 'error'
    return _make_item(
        'open_rate_level', 'xhs', level,
        '开口率环比明显下降',
        f'成熟观察窗（快照日 −{MATURITY_DAYS} 天，与上月同窗口对齐）开口率为上期的 {ratio:.0%}（阈值 warn <{OPEN_MOM_WARN:.0%} / error <{OPEN_MOM_ERROR:.0%}）',
        f"本期 {cur_rate:.1%}（{cur['total']} 条线索） vs 上期同窗口 {prev_rate:.1%}（{prev['total']} 条线索）",
        '结合 open_rate_collapse 与上游回写情况判断是数据问题还是真实转化恶化',
    )


def rule_valid_lead_quality(ctx):
    cur = ctx['cur_mature']['valid']
    prev = ctx['prev_window']['valid']
    if prev <= 0:
        return None
    drop = (prev - cur) / prev
    if drop <= VALID_DROP_WARN:
        return None
    return _make_item(
        'valid_lead_quality', 'xhs', 'warn',
        '有效线索量环比下降',
        f'成熟观察窗内有效线索较上月同窗口下降 {drop:.0%}（阈值 >{VALID_DROP_WARN:.0%}）',
        f'本期 {cur} 条 vs 上期同窗口 {prev} 条',
        '区分上游标记缺失与真实线索质量下滑；必要时抽样核对原始明细',
    )


def rule_stock_mix(ctx):
    monthly = ctx['content_monthly'].get(ctx['month'])
    if not monthly or monthly['total'] <= 0:
        return None
    ratio = monthly['stock'] / monthly['total']
    if ratio <= STOCK_MIX_WARN:
        return None
    return _make_item(
        'stock_mix', 'xhs', 'warn',
        '存量客户混入内容平台线索',
        f"本月内容平台线索中存量客户占比 {ratio:.1%}（阈值 >{STOCK_MIX_WARN:.0%}），违反「内容平台非存量」口径",
        f"存量 {monthly['stock']} 条 / 全部 {monthly['total']} 条",
        '检查上游 ETL 的存量过滤逻辑是否失效',
    )


def rule_funnel_step_anomaly(ctx):
    cur = ctx['appmarket_monthly'].get(ctx['month'])
    prev = ctx['appmarket_monthly'].get(ctx['prev_month'])
    if not cur or not prev:
        return None
    details = []
    worst_level = None
    for numerator_key, denominator_key, label in FUNNEL_STEPS:
        cur_rate = _rate(cur[numerator_key], cur[denominator_key])
        prev_rate = _rate(prev[numerator_key], prev[denominator_key])
        if cur_rate is None or not prev_rate:
            continue
        drop = (prev_rate - cur_rate) / prev_rate
        if drop <= FUNNEL_DROP_WARN:
            continue
        level = 'error' if drop > FUNNEL_DROP_ERROR else 'warn'
        if worst_level is None or LEVEL_RANK[level] < LEVEL_RANK[worst_level]:
            worst_level = level
        details.append(f'{label}: {prev_rate:.1%} -> {cur_rate:.1%}（相对降幅 {drop:.0%}）')
    if not details:
        return None
    return _make_item(
        'funnel_step_anomaly', 'appmarket', worst_level,
        '应用市场漏斗环节异常',
        f'以下漏斗转化率环比相对降幅超过 {FUNNEL_DROP_WARN:.0%}（error 阈值 >{FUNNEL_DROP_ERROR:.0%}）',
        '；'.join(details),
        '结合 new_device_share 判断是流量结构变化还是落地链路问题',
    )


def rule_new_device_share(ctx):
    monthly = ctx['appmarket_monthly'].get(ctx['month'])
    if not monthly or monthly['downloads'] <= 0:
        return None
    share = monthly['devices'] / monthly['downloads']
    if share >= DEVICE_SHARE_WARN:
        return None
    level = 'error' if share < DEVICE_SHARE_ERROR else 'warn'
    return _make_item(
        'new_device_share', 'appmarket', level,
        '应用市场新设备占比偏低',
        f'本月下载中独立新设备占比 {share:.1%}，重复设备下载占比过高，获客真实性存疑（阈值 warn <{DEVICE_SHARE_WARN:.0%} / error <{DEVICE_SHARE_ERROR:.0%}）',
        f"独立设备 {monthly['devices']} / 下载 {monthly['downloads']} = {share:.2%}",
        '与投放渠道核对是否重复归因或刷量，必要时按设备明细抽样核查',
    )


def rule_new_assets_yield(ctx):
    cur = ctx['appmarket_monthly'].get(ctx['month'])
    prev = ctx['appmarket_monthly'].get(ctx['prev_month'])
    if not cur or not prev or cur['account_created'] <= 0:
        return None
    cur_yield = _rate(cur['new_assets'], cur['account_created'])
    prev_yield = _rate(prev['new_assets'], prev['account_created'])
    if cur_yield is None or not prev_yield:
        return None
    drop = (prev_yield - cur_yield) / prev_yield
    if drop <= ASSETS_DROP_WARN:
        return None
    return _make_item(
        'new_assets_yield', 'appmarket', 'warn',
        '新开户户均资产环比下降',
        f'新开户人均资产较上月下降 {drop:.0%}（阈值 >{ASSETS_DROP_WARN:.0%}）；新客群资产随观察时长自然增长，需区分成熟度效应',
        f'本期 {cur_yield:.0f} 元/户 vs 上期 {prev_yield:.0f} 元/户',
        '核对是否入金率下降或新客群质量变化；可对比历史月份同类降幅判断是否为季节性',
    )


_RULES = (
    rule_snapshot_freshness,
    rule_snapshot_alignment,
    rule_maturity_window,
    rule_platform_stalled,
    rule_open_rate_collapse,
    rule_open_rate_level,
    rule_valid_lead_quality,
    rule_stock_mix,
    rule_funnel_step_anomaly,
    rule_new_device_share,
    rule_new_assets_yield,
)


def build_items(ctx):
    items = []
    for rule in _RULES:
        item = rule(ctx)
        if item:
            items.append(item)
    items.sort(key=lambda item: (LEVEL_RANK[item['level']], CHAIN_RANK[item['chain']], item['id']))
    return items
