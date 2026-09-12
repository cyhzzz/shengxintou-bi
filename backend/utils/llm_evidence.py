# -*- coding: utf-8 -*-
"""AI 报告业务证据包：厂商经营 / 小红书笔记分层 / 应用市场经营。

与 diagnosis 体检信号互补：只做 SELECT/SUM/GROUP BY 聚合的经营视角数据，
不做异常判定、不输出设备/线索级明细（数据安全红线）。

口径：
- 应用市场聚合强制 渠道类型=互联网引流（对齐获客报表 _funnel_filters）；
  「是否新开户」是漏斗末段指标，绝不用 WHERE 过滤（漏斗变平红线）。
- 内容平台转化侧沿用 CONTENT_NON_STOCK（非存量口径）。
- agg_vendor_daily 是统一漏斗超集：开口/有效线索列=内容平台值，
  APP下载/激活列=应用市场值；日期列存在历史脏值，按月份 IN 过滤天然排除。
- 笔记衰退基于转化侧（fact_conv_content 按笔记×月聚合）；agg_xhs_note 为
  累计快照（无日期维度），只用于当前表现分层，不判定趋势。
- fact_conv_content 的笔记归属仅部分线索携带（主要为小红书链路）。
"""
import logging

from sqlalchemy import and_, case, func

from backend.database import db
from backend.models_v2 import (
    AggVendorDaily,
    AggXhsNote,
    DimAdPlanClass,
    FactConvAppmarket,
    FactConvContent,
)
from backend.utils.calibers import CONTENT_NON_STOCK
from backend.utils.diagnosis.engine import shift_month
from backend.utils.diagnosis.metrics import ratio

log = logging.getLogger(__name__)

# ---- 证据包瘦身限制（控制 payload 体积） ----
NOTE_TOP_LIMIT = 10
NOTE_DECLINE_LIMIT = 5
NOTE_STOP_LIMIT = 5
NOTE_NEW_LIMIT = 5
PLACEMENT_TOP_LIMIT = 5
PLACEMENT_BOTTOM_LIMIT = 5
PLAN_TOP_LIMIT = 5
TITLE_MAX_LEN = 24
VENDOR_PLATFORM_LIMIT = 6

# 笔记衰退判定（转化侧）：前 3 月月均开口达下限、当月跌破均值的指定比例
DECLINE_MIN_AVG_OPENED = 10
DECLINE_DROP_RATIO = 0.3
# 停投候选（投放侧累计快照）：消费达下限且企微加微几乎为零
STOP_MIN_COST = 1000.0
STOP_MAX_ADDS = 2

VENDOR_FIELDS = (
    'cost', 'leads', 'opened', 'valid', 'accounts', 'eff_accounts',
    'app_downloads', 'app_activations', 'asset', 'revenue',
)


def _num(value):
    return None if value is None else round(float(value), 4)


def _clip_title(title):
    text = (title or '').strip()
    return text[:TITLE_MAX_LEN] if text else '未命名'


def _prev_months(month):
    return [shift_month(month, -3), shift_month(month, -2), shift_month(month, -1)]


def _trend_months(month):
    return _prev_months(month) + [month]


# ============================================================
# 厂商经营（agg_vendor_daily）
# ============================================================

def fetch_vendor_monthly(months):
    """按月×厂商×平台聚合统一漏斗超集（内容平台与应用市场指标混合在同一行集）"""
    month_expr = func.substr(AggVendorDaily.日期, 1, 7)
    vendor_expr = func.coalesce(func.nullif(AggVendorDaily.厂商, ''), '未归因')
    platform_expr = func.coalesce(func.nullif(AggVendorDaily.平台, ''), '未知')
    rows = db.session.query(
        month_expr.label('month'),
        vendor_expr.label('vendor'),
        platform_expr.label('platform'),
        func.sum(AggVendorDaily.花费).label('cost'),
        func.sum(AggVendorDaily.线索数).label('leads'),
        func.sum(AggVendorDaily.开口人数).label('opened'),
        func.sum(AggVendorDaily.有效线索数).label('valid'),
        func.sum(AggVendorDaily.开户人数).label('accounts'),
        func.sum(AggVendorDaily.有效户人数).label('eff_accounts'),
        func.sum(AggVendorDaily.APP下载数).label('app_downloads'),
        func.sum(AggVendorDaily.APP激活人数).label('app_activations'),
        func.sum(AggVendorDaily.客户资产).label('asset'),
        func.sum(AggVendorDaily.客户创收).label('revenue'),
    ).filter(month_expr.in_(months)).group_by(
        month_expr, vendor_expr, platform_expr,
    ).all()
    return [
        {
            'month': row.month,
            'vendor': row.vendor,
            'platform': row.platform,
            'cost': _num(row.cost),
            'leads': int(row.leads or 0),
            'opened': int(row.opened or 0),
            'valid': int(row.valid or 0),
            'accounts': int(row.accounts or 0),
            'eff_accounts': int(row.eff_accounts or 0),
            'app_downloads': int(row.app_downloads or 0),
            'app_activations': int(row.app_activations or 0),
            'asset': _num(row.asset),
            'revenue': _num(row.revenue),
        }
        for row in rows
    ]


def _vendor_side(bucket, side):
    data = dict(bucket[side])
    data['open_rate'] = ratio(data['opened'], data['leads'])
    data['lead_cost'] = ratio(data['cost'], data['leads'])
    data['account_cost'] = ratio(data['cost'], data['accounts'])
    data['eff_account_cost'] = ratio(data['cost'], data['eff_accounts'])
    return data


def build_vendor_evidence(month, rows):
    """厂商×（当月 vs 前 3 月）聚合 + 当月平台拆分，按当月花费降序"""
    agg = {}
    for row in rows:
        bucket = agg.setdefault(row['vendor'], {
            'current': dict.fromkeys(VENDOR_FIELDS, 0),
            'prev3': dict.fromkeys(VENDOR_FIELDS, 0),
            'platforms': {},
        })
        side = 'current' if row['month'] == month else 'prev3'
        for field in VENDOR_FIELDS:
            bucket[side][field] += row[field] or 0
        if row['month'] == month:
            plat = bucket['platforms'].setdefault(
                row['platform'], dict.fromkeys(VENDOR_FIELDS, 0))
            for field in VENDOR_FIELDS:
                plat[field] += row[field] or 0
    out = []
    for vendor, bucket in sorted(agg.items(), key=lambda kv: -(kv[1]['current']['cost'] or 0)):
        platforms = [
            dict({'platform': name}, **vals)
            for name, vals in sorted(
                bucket['platforms'].items(), key=lambda kv: -(kv[1]['cost'] or 0))
            [:VENDOR_PLATFORM_LIMIT]
        ]
        out.append({
            'vendor': vendor,
            'current': _vendor_side(bucket, 'current'),
            'prev3': _vendor_side(bucket, 'prev3'),
            'platforms_current': platforms,
        })
    return out


# ============================================================
# 小红书笔记（转化侧月度趋势 + 投放侧累计快照）
# ============================================================

def _content_flag_sum(column):
    return func.sum(case((and_(CONTENT_NON_STOCK, column == 1), 1), else_=0))


def fetch_note_conversion_monthly(months):
    """转化侧：按笔记×月聚合非存量线索、开口、有效线索、开户"""
    month_expr = func.substr(FactConvContent.线索日期, 1, 7)
    note_id_expr = func.coalesce(func.nullif(FactConvContent.笔记ID, ''), '未标注')
    rows = db.session.query(
        note_id_expr.label('note_id'),
        func.max(FactConvContent.笔记名称).label('note_name'),
        month_expr.label('month'),
        func.count().label('leads'),
        _content_flag_sum(FactConvContent.是否客户开口).label('opened'),
        _content_flag_sum(FactConvContent.是否有效线索).label('valid'),
        _content_flag_sum(FactConvContent.是否开户).label('accounts'),
    ).filter(
        month_expr.in_(months),
        CONTENT_NON_STOCK,
        FactConvContent.笔记ID.isnot(None),
        FactConvContent.笔记ID != '',
    ).group_by(note_id_expr, month_expr).all()
    return [
        {
            'note_id': row.note_id,
            'note_name': row.note_name,
            'month': row.month,
            'leads': int(row.leads or 0),
            'opened': int(row.opened or 0),
            'valid': int(row.valid or 0),
            'accounts': int(row.accounts or 0),
        }
        for row in rows
    ]


def fetch_note_snapshot():
    """投放侧：agg_xhs_note 累计快照关键列（全量读入内存做分层）"""
    rows = db.session.query(
        AggXhsNote.笔记ID.label('note_id'),
        AggXhsNote.笔记标题.label('title'),
        AggXhsNote.内容类型.label('type'),
        AggXhsNote.发布时间.label('published'),
        AggXhsNote.总展现量.label('impressions'),
        AggXhsNote.总点击率.label('ctr'),
        AggXhsNote.私信进线人数.label('dm'),
        AggXhsNote.企微成功添加人数.label('adds'),
        AggXhsNote.加微成本.label('add_cost'),
        AggXhsNote.开户人数.label('accounts'),
        AggXhsNote.消费金额.label('cost'),
    ).all()
    return [
        {
            'note_id': row.note_id,
            'title': row.title,
            'type': row.type,
            'published': row.published,
            'impressions': int(row.impressions or 0),
            'ctr': _num(row.ctr),
            'dm': int(row.dm or 0),
            'adds': int(row.adds or 0),
            'add_cost': _num(row.add_cost),
            'accounts': int(row.accounts or 0),
            'cost': _num(row.cost),
        }
        for row in rows
    ]


def _note_snapshot_brief(snapshot):
    if not snapshot:
        return None
    return {
        'type': snapshot['type'] or '未分类',
        'published': (snapshot['published'] or '')[:10],
        'impressions': snapshot['impressions'],
        'ctr': snapshot['ctr'],
        'adds': snapshot['adds'],
        'add_cost': snapshot['add_cost'],
        'accounts': snapshot['accounts'],
        'cost': snapshot['cost'],
    }


def build_note_evidence(month, conv_rows, snap_rows):
    """笔记分层：值得关注 TOP / 衰退 / 停投候选 / 内容类型选题聚合 / 当月新笔记"""
    snapshot_by_id = {row['note_id']: row for row in snap_rows if row['note_id']}
    trend = {}
    for row in conv_rows:
        trend.setdefault(row['note_id'], {})[row['month']] = row

    prev_months = _prev_months(month)
    watch, decline = [], []
    for note_id, months_map in trend.items():
        cur = months_map.get(month)
        cur_opened = cur['opened'] if cur else 0
        prev_opened = [months_map[m]['opened'] for m in prev_months if m in months_map]
        name = _clip_title((cur or next(iter(months_map.values())))['note_name'])
        if cur and cur_opened > 0:
            watch.append({
                'note': name,
                'opened': cur_opened,
                'leads': cur['leads'],
                'valid': cur['valid'],
                'accounts': cur['accounts'],
                'snapshot': _note_snapshot_brief(snapshot_by_id.get(note_id)),
            })
        if prev_opened:
            avg_opened = sum(prev_opened) / len(prev_opened)
            if (avg_opened >= DECLINE_MIN_AVG_OPENED
                    and cur_opened <= avg_opened * DECLINE_DROP_RATIO):
                decline.append({
                    'note': name,
                    'prev3_avg_opened': round(avg_opened, 1),
                    'current_opened': cur_opened,
                    'snapshot': _note_snapshot_brief(snapshot_by_id.get(note_id)),
                })
    watch.sort(key=lambda item: -item['opened'])
    decline.sort(key=lambda item: -(item['prev3_avg_opened'] - item['current_opened']))
    watch = watch[:NOTE_TOP_LIMIT]
    decline = decline[:NOTE_DECLINE_LIMIT]
    watch_names = {item['note'] for item in watch}

    stop = [
        {
            'note': _clip_title(row['title']),
            'cost': row['cost'],
            'impressions': row['impressions'],
            'ctr': row['ctr'],
            'adds': row['adds'],
            'accounts': row['accounts'],
        }
        for row in snap_rows
        if (row['cost'] or 0) >= STOP_MIN_COST and row['adds'] <= STOP_MAX_ADDS
        and _clip_title(row['title']) not in watch_names
    ]
    stop.sort(key=lambda item: -(item['cost'] or 0))
    stop = stop[:NOTE_STOP_LIMIT]

    types = {}
    for row in snap_rows:
        kind = (row['type'] or '').strip() or '未分类'
        bucket = types.setdefault(kind, {
            'notes': 0, 'impressions': 0, 'ctr_sum': 0.0, 'ctr_n': 0,
            'dm': 0, 'adds': 0, 'accounts': 0, 'cost': 0.0,
        })
        bucket['notes'] += 1
        bucket['impressions'] += row['impressions']
        if row['ctr'] is not None:
            bucket['ctr_sum'] += row['ctr']
            bucket['ctr_n'] += 1
        bucket['dm'] += row['dm']
        bucket['adds'] += row['adds']
        bucket['accounts'] += row['accounts']
        bucket['cost'] += row['cost'] or 0
    types_out = [
        {
            'type': kind,
            'notes': vals['notes'],
            'impressions': vals['impressions'],
            'avg_ctr': ratio(vals['ctr_sum'], vals['ctr_n']) if vals['ctr_n'] else None,
            'dm': vals['dm'],
            'adds': vals['adds'],
            'accounts': vals['accounts'],
            'cost': _num(vals['cost']),
        }
        for kind, vals in sorted(types.items(), key=lambda kv: -kv[1]['adds'])
    ]

    new_notes = [
        {
            'note': _clip_title(row['title']),
            'type': row['type'] or '未分类',
            'published': (row['published'] or '')[:10],
            'impressions': row['impressions'],
            'ctr': row['ctr'],
            'adds': row['adds'],
            'accounts': row['accounts'],
            'cost': row['cost'],
        }
        for row in snap_rows
        if (row['published'] or '').startswith(month)
    ]
    new_notes.sort(key=lambda item: -item['adds'])
    new_notes = new_notes[:NOTE_NEW_LIMIT]

    return {
        'watch_top': watch,
        'declining': decline,
        'stop_candidates': stop,
        'content_types': types_out,
        'new_notes': new_notes,
        'snapshot_note_count': len(snap_rows),
        'conversion_tracked_note_count': len(trend),
    }


# ============================================================
# 应用市场经营（fact_conv_appmarket × dim_ad_plan_class）
# ============================================================

def _appmarket_month_expr():
    return func.substr(FactConvAppmarket.下载日期, 1, 7)


def _appmarket_store_expr():
    return func.coalesce(func.lower(func.nullif(FactConvAppmarket.应用市场, '')), '未知')


def _appmarket_internet_filter():
    # 获客口径：漏斗只看互联网引流（对齐 _funnel_filters；新开户是末段指标不过滤）
    return FactConvAppmarket.渠道类型 == '互联网引流'


APPMARKET_FUNNEL_FIELDS = (
    'downloads', 'activated', 'registered', 'funded', 'opened_accounts',
    'new_accounts', 'deposited', 'eff_accounts',
)


def fetch_appmarket_store_monthly(months):
    """商店×月漏斗聚合（下载→激活→注册→完资金账号→开户成功→新开户→入金→有效户 + 资产/创收）"""
    rows = db.session.query(
        _appmarket_store_expr().label('store'),
        _appmarket_month_expr().label('month'),
        func.count().label('downloads'),
        func.sum(case((FactConvAppmarket.是否激活APP == 1, 1), else_=0)).label('activated'),
        func.sum(case((FactConvAppmarket.是否开户注册 == 1, 1), else_=0)).label('registered'),
        func.sum(case((FactConvAppmarket.是否创建完资金账号 == 1, 1), else_=0)).label('funded'),
        func.sum(case((FactConvAppmarket.是否开户成功 == 1, 1), else_=0)).label('opened_accounts'),
        func.sum(case((FactConvAppmarket.是否新开户 == 1, 1), else_=0)).label('new_accounts'),
        func.sum(case((FactConvAppmarket.是否入金 == 1, 1), else_=0)).label('deposited'),
        func.sum(case((FactConvAppmarket.是否有效户 == 1, 1), else_=0)).label('eff_accounts'),
        func.sum(FactConvAppmarket.总资产).label('asset'),
        func.sum(FactConvAppmarket.累计创收).label('revenue'),
    ).filter(
        _appmarket_month_expr().in_(months),
        _appmarket_internet_filter(),
    ).group_by(_appmarket_store_expr(), _appmarket_month_expr()).all()
    return [
        {
            'store': row.store,
            'month': row.month,
            'downloads': int(row.downloads or 0),
            'activated': int(row.activated or 0),
            'registered': int(row.registered or 0),
            'funded': int(row.funded or 0),
            'opened_accounts': int(row.opened_accounts or 0),
            'new_accounts': int(row.new_accounts or 0),
            'deposited': int(row.deposited or 0),
            'eff_accounts': int(row.eff_accounts or 0),
            'asset': _num(row.asset),
            'revenue': _num(row.revenue),
        }
        for row in rows
    ]


def _appmarket_store_side(bucket, side):
    data = dict(bucket[side])
    data['activation_rate'] = ratio(data['activated'], data['downloads'])
    data['new_account_rate'] = ratio(data['new_accounts'], data['downloads'])
    data['asset_per_new_account'] = ratio(data['asset'], data['new_accounts'])
    data['revenue_per_new_account'] = ratio(data['revenue'], data['new_accounts'])
    return data


def fetch_appmarket_placement(month):
    """当月：商店×版位 漏斗聚合（fact_conv_appmarket JOIN dim_ad_plan_class）"""
    store_expr = _appmarket_store_expr()
    placement_expr = func.coalesce(func.nullif(DimAdPlanClass.版位, ''), '未分类')
    rows = db.session.query(
        store_expr.label('store'),
        placement_expr.label('placement'),
        func.count().label('downloads'),
        func.sum(case((FactConvAppmarket.是否新开户 == 1, 1), else_=0)).label('new_accounts'),
        func.sum(FactConvAppmarket.总资产).label('asset'),
        func.sum(FactConvAppmarket.累计创收).label('revenue'),
    ).join(
        DimAdPlanClass, FactConvAppmarket.广告计划ID == DimAdPlanClass.广告分组ID,
    ).filter(
        _appmarket_month_expr() == month,
        _appmarket_internet_filter(),
    ).group_by(store_expr, placement_expr).all()
    return [
        {
            'store': row.store,
            'placement': row.placement,
            'downloads': int(row.downloads or 0),
            'new_accounts': int(row.new_accounts or 0),
            'asset': _num(row.asset),
            'revenue': _num(row.revenue),
        }
        for row in rows
    ]


def fetch_appmarket_plans_top(month):
    """当月：广告计划（分组名称）下载 TOP，用于计划级关注建议"""
    store_expr = _appmarket_store_expr()
    plan_expr = func.coalesce(func.nullif(DimAdPlanClass.广告分组名称, ''), '未命名计划')
    rows = db.session.query(
        store_expr.label('store'),
        plan_expr.label('plan'),
        func.count().label('downloads'),
        func.sum(case((FactConvAppmarket.是否新开户 == 1, 1), else_=0)).label('new_accounts'),
    ).join(
        DimAdPlanClass, FactConvAppmarket.广告计划ID == DimAdPlanClass.广告分组ID,
    ).filter(
        _appmarket_month_expr() == month,
        _appmarket_internet_filter(),
    ).group_by(store_expr, plan_expr).all()
    plans = [
        {
            'store': row.store,
            'plan': (row.plan or '')[:TITLE_MAX_LEN],
            'downloads': int(row.downloads or 0),
            'new_accounts': int(row.new_accounts or 0),
        }
        for row in rows
    ]
    plans.sort(key=lambda item: -item['downloads'])
    return plans[:PLAN_TOP_LIMIT]


def build_appmarket_evidence(month, store_rows, placement_rows, plan_rows):
    """商店漏斗当月 vs 前 3 月 + 版位潜力/需关注 + 计划 TOP + 客群质量"""
    agg = {}
    for row in store_rows:
        bucket = agg.setdefault(row['store'], {
            'current': dict.fromkeys(APPMARKET_FUNNEL_FIELDS + ('asset', 'revenue'), 0),
            'prev3': dict.fromkeys(APPMARKET_FUNNEL_FIELDS + ('asset', 'revenue'), 0),
        })
        side = 'current' if row['month'] == month else 'prev3'
        for field in APPMARKET_FUNNEL_FIELDS + ('asset', 'revenue'):
            bucket[side][field] += row[field] or 0
    stores = [
        {
            'store': store,
            'current': _appmarket_store_side(bucket, 'current'),
            'prev3': _appmarket_store_side(bucket, 'prev3'),
        }
        for store, bucket in sorted(
            agg.items(), key=lambda kv: -kv[1]['current']['downloads'])
    ]

    potential = sorted(placement_rows, key=lambda item: -item['new_accounts'])[:PLACEMENT_TOP_LIMIT]
    watchlist = sorted(
        (row for row in placement_rows if row['downloads'] >= 30),
        key=lambda item: ratio(item['new_accounts'], item['downloads']) or 0,
    )[:PLACEMENT_BOTTOM_LIMIT]

    return {
        'stores': stores,
        'placement_potential': potential,
        'placement_watchlist': watchlist,
        'plans_top': plan_rows,
    }


# ============================================================
# 入口
# ============================================================

def build_business_evidence(month):
    """组装三包业务证据；单包取数失败降级为 None（prompt 会说明缺失时不解读）"""
    months = _trend_months(month)
    packages = {}
    for key, builder in (
        ('vendor', lambda: build_vendor_evidence(month, fetch_vendor_monthly(months))),
        ('note', lambda: build_note_evidence(
            month, fetch_note_conversion_monthly(months), fetch_note_snapshot())),
        ('appmarket', lambda: build_appmarket_evidence(
            month, fetch_appmarket_store_monthly(months),
            fetch_appmarket_placement(month), fetch_appmarket_plans_top(month))),
    ):
        try:
            packages[key] = builder()
        except Exception as e:  # noqa: BLE001 单包失败不阻断整份报告
            log.warning('业务证据包 %s 构建失败: %s', key, e)
            packages[key] = None
    return packages
