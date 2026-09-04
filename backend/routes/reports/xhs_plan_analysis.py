# -*- coding: utf-8 -*-
"""小红书 · 计划分析（v3.3.10）

业务定位：仿照应用市场 `/api/v1/reports/app-market/plan-analysis` 的「按周度走势 + Top N 计划」
核心思路，但数据源换成 `fact_conv_content`，漏斗顶端改成"开口 / 有效线索 / 开户 / 有效户"四阶段。

与 app-market /plan-analysis 的差异：
  - 数据源：`fact_conv_appmarket`（设备级）→ `fact_conv_content`（企微级）
  - 漏斗阶段（6 阶段，按业务不变式剔除存量客户）：
        应用市场: 激活APP → 开户成功 → 新开户 → 入金 → 有效户
        小红书:   企微   → 开口   → 有效线索 → 有效线索(不含存量)
                                          → 新开户 → 有效户
      注：
        - 表里 1 行=1 企微（漏斗顶端），用 COUNT(*) 表达
        - "有效线索（不含存量）" 和 "新开户" 都按业务不变式「内容平台非存量条件」过滤：
              是否为存量客户 == 0 OR IS NULL
        - 小红书漏斗无"激活APP"和"入金"概念
  - 维度字段：`广告计划ID / 投放账号` → `广告ID / 广告账号`
  - 筛选维度：`应用市场` → `广告代理商`（直投 / 量子 / 绩牛 / 美洋）

入参：
  filters: { start_date, end_date, agency (单值字符串，可为 None=全部) }
  top_n: int，Top N 计划（默认 30）

返回：
  agencies: 所有广告代理商列表（供前端单选）
  weekly_totals: 该筛选范围的整体周度走势
  plan_items: [{plan_id, 广告账号, totals: {...}, weekly: [...]}]
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, case, or_

from backend.models_v2 import FactConvContent, FactPlanDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('xhs_plan_analysis_report', __name__, url_prefix='/api/v1/reports/xhs')

_META = {
    'version': 'v3.3.10',
    'source_table': 'fact_conv_content',
    'note': '漏斗 counts 是 SQL SUM 聚合；conversion_rate 是派生；"有效线索（不含存量）"和"新开户"按业务不变式剔除存量客户',
    'funnel_stages': ['企微', '开口', '有效线索', '有效线索_不含存量', '新开户', '有效户'],
    'funnel_columns': [
        'COUNT(*)',                                          # 企微 = 行数
        '是否客户开口',
        '是否有效线索',
        '是否有效线索 AND (是否为存量客户=0 OR IS NULL)',     # 有效线索（不含存量）
        '是否开户 AND (是否为存量客户=0 OR IS NULL)',          # 新开户（按业务不变式）
        '是否为有效户',
    ],
}

# v3.3.10 业务期望代理商名单（前端下拉选项固定这 4 个，便于投放评审）
#   其他代理商即使数据库有数据，本期不展示；如需扩充直接修改此列表即可。
TARGET_AGENCIES = ['直投', '量子', '绩牛', '美洋']


def _apply_filters(q, filters):
    """小红书 · 计划分析 通用筛选：日期区间 + 单代理商"""
    sd, ed = filters.get('start_date'), filters.get('end_date')
    if sd and ed:
        q = q.filter(and_(FactConvContent.线索日期 >= sd,
                          FactConvContent.线索日期 <= ed))
    if filters.get('agency'):
        q = q.filter(FactConvContent.广告代理商 == str(filters['agency']))
    return q


@bp.route('/plan-analysis', methods=['POST'])
@handle_exceptions
def xhs_plan_analysis():
    """小红书 · 计划分析（按周度走势 + 按代理商单选）

    数据源: fact_conv_content（限定平台来源=小红书）
    维度: 广告ID × 周起始日
    """
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    top_n = int(data.get('top_n', 30))
    agency = filters.get('agency')  # 单值字符串

    # 平台来源=小红书 写死过滤
    base_filters = dict(filters)
    base_filters['__platform'] = '小红书'
    inner_filters = dict(filters)

    def _q_with_platform(extra=None):
        q = db.session.query(FactConvContent)
        q = _apply_filters(q, inner_filters)
        q = q.filter(FactConvContent.平台来源 == '小红书')
        if extra:
            for clause in extra:
                q = q.filter(clause)
        return q

    # 代理商列表（去重，仅返回有投放数据的代理商；前端只展示 TARGET_AGENCIES 子集）
    agency_rows = _q_with_platform([
        FactConvContent.广告代理商.isnot(None),
        FactConvContent.广告代理商 != '',
    ]).with_entities(FactConvContent.广告代理商).distinct().order_by(
        FactConvContent.广告代理商
    ).all()
    agencies = [r[0] for r in agency_rows]

    # 周起始日表达式（dialect 无关）：SQLite 用 date(d, 'weekday 0', '-6 days')；
    # PG 用 date_trunc('week', d)，均返回 d 所在周的周一
    from backend.utils.dialect_helpers import make_week_start_expr
    week_start_expr = make_week_start_expr(FactConvContent.线索日期).label('week_start')

    # 广告ID 归一化（与 app-market 一致：NULL/空 fallback 到广告账号）
    plan_expr = case(
        (or_(FactConvContent.广告ID.is_(None), FactConvContent.广告ID == ''),
         func.coalesce(FactConvContent.广告账号, '未归因')),
        else_=FactConvContent.广告ID
    ).label('plan_key')

    # v3.3.10 业务不变式「内容平台非存量条件」：
    #   是否为存量客户 == 0 OR IS NULL
    not_existing = or_(
        FactConvContent.是否为存量客户 == 0,
        FactConvContent.是否为存量客户.is_(None),
    )

    funnels = [
        ('企微', func.count(FactConvContent.id)),                          # 企微 = 行数
        ('开口', func.sum(FactConvContent.是否客户开口)),
        ('有效线索', func.sum(FactConvContent.是否有效线索)),
        ('有效线索_不含存量', func.sum(case((and_(FactConvContent.是否有效线索 == 1, not_existing), 1), else_=0))),
        ('新开户', func.sum(case((and_(FactConvContent.是否开户 == 1, not_existing), 1), else_=0))),
        ('有效户', func.sum(FactConvContent.是否为有效户)),
    ]

    # 按 (plan, week_start) 分组聚合
    selects = [plan_expr, FactConvContent.广告账号, FactConvContent.广告代理商, week_start_expr]
    for alias, expr in funnels:
        selects.append(func.coalesce(expr, 0).label(alias))
    q = db.session.query(*selects)
    q = q.filter(FactConvContent.平台来源 == '小红书')
    q = _apply_filters(q, filters)
    q = q.group_by(plan_expr, FactConvContent.广告账号, FactConvContent.广告代理商, week_start_expr).order_by(week_start_expr)
    rows = q.all()

    FUNNEL_KEYS = ('企微', '开口', '有效线索', '有效线索_不含存量', '新开户', '有效户')

    def _calc_rates(qiwei, kaihou, youxiao, youxiao_bcq, xinkaihu, youxiao_hu):
        # 漏斗顶端：企微 → 开口 → 有效线索 → 有效线索(不含存量) → 新开户 → 有效户
        # 主要转化率按"企微→开口/开户/有效户"做分母，前阶段也能算（如开口→开户）
        return {
            '企微_开口率': round(kaihou / qiwei * 100, 2) if qiwei > 0 else 0,
            '企微_有效线索率': round(youxiao / qiwei * 100, 2) if qiwei > 0 else 0,
            '企微_不含存量率': round(youxiao_bcq / qiwei * 100, 2) if qiwei > 0 else 0,
            '企微_新开户率': round(xinkaihu / qiwei * 100, 2) if qiwei > 0 else 0,
            '企微_有效户率': round(youxiao_hu / qiwei * 100, 2) if qiwei > 0 else 0,
            '开口_新开户率': round(xinkaihu / kaihou * 100, 2) if kaihou > 0 else 0,
            '不含存量_有效户率': round(youxiao_hu / youxiao_bcq * 100, 2) if youxiao_bcq > 0 else 0,
        }

    # 按 plan 聚合 weekly
    plan_map = {}
    weekly_agg = {}
    for r in rows:
        plan_key = str(r.plan_key) if r.plan_key is not None else '未归因'
        week = str(r.week_start) if r.week_start is not None else '未知周'
        vals = {k: int(getattr(r, k) or 0) for k in FUNNEL_KEYS}
        weekly_point = {
            'week_start': week,
            **vals,
            **_calc_rates(vals['企微'], vals['开口'], vals['有效线索'], vals['有效线索_不含存量'], vals['新开户'], vals['有效户']),
        }
        if plan_key not in plan_map:
            plan_map[plan_key] = {
                'plan_id': plan_key,
                '广告账号': r.广告账号 or '-',
                '广告代理商': r.广告代理商 or '-',
                'totals': {k: 0 for k in FUNNEL_KEYS},
                'weekly': [],
            }
        p = plan_map[plan_key]
        for k in FUNNEL_KEYS:
            p['totals'][k] += vals[k]
        p['weekly'].append(weekly_point)
        if week not in weekly_agg:
            weekly_agg[week] = {k: 0 for k in FUNNEL_KEYS}
        for k in FUNNEL_KEYS:
            weekly_agg[week][k] += vals[k]

    plan_items = list(plan_map.values())
    for p in plan_items:
        t = p['totals']
        rates = _calc_rates(t['企微'], t['开口'], t['有效线索'], t['有效线索_不含存量'], t['新开户'], t['有效户'])
        p['totals'] = {**t, **rates}
        p['weekly'].sort(key=lambda x: x['week_start'])
    plan_items.sort(
        key=lambda x: (x['totals']['新开户'], x['totals']['有效线索_不含存量'], x['totals']['开口']),
        reverse=True,
    )

    # ---- 补计划级 消耗/展示/点击/下载 + 计划名称（数据源 fact_plan_daily，平台=小红书，广告ID=计划ID） ----
    # 周起始用本报表统一的 make_week_start_expr（周一），保证消耗周与漏斗周对齐。
    plan_daily_fweek = make_week_start_expr(FactPlanDaily.日期).label('week_start')
    cover_names = {'消耗': 0.0, '展示': 0, '点击': 0, '下载': 0}
    def _cover(spend, imp, clk, dl):
        return {'消耗': round(float(spend or 0), 2), '展示': int(imp or 0),
                '点击': int(clk or 0), '下载': int(dl or 0)}

    cost_week = {}          # (plan_id, week) -> cover
    cost_tot = {}           # plan_id -> cover
    plan_name = {}          # plan_id -> 计划名称
    cost_week_agg = {}      # week -> cover（跨计划合计）
    metric_keys = ('消耗', '展示', '点击', '下载')
    sd, ed = filters.get('start_date'), filters.get('end_date')
    # 仅对真实数字广告ID计划尝试关联；fallback 到广告账号/未归因的 plan_key 无法匹配 fact_plan_daily.计划ID
    numeric_plan_ids = [int(p['plan_id']) for p in plan_items if p['plan_id'].isdigit()]
    if numeric_plan_ids:
        q_plan = db.session.query(
            FactPlanDaily.计划ID, plan_daily_fweek,
            func.coalesce(func.sum(FactPlanDaily.花费), 0).label('spend'),
            func.coalesce(func.sum(FactPlanDaily.展示量), 0).label('imp'),
            func.coalesce(func.sum(FactPlanDaily.点击量), 0).label('clk'),
            func.coalesce(func.sum(FactPlanDaily.下载量), 0).label('dl'),
        ).filter(FactPlanDaily.平台 == '小红书')
        if sd: q_plan = q_plan.filter(FactPlanDaily.日期 >= sd)
        if ed: q_plan = q_plan.filter(FactPlanDaily.日期 <= ed)
        for r in q_plan.filter(FactPlanDaily.计划ID.in_(numeric_plan_ids)).group_by(
                FactPlanDaily.计划ID, plan_daily_fweek).all():
            pid, week = int(r.计划ID), str(r.week_start)[:10]
            c = _cover(r.spend, r.imp, r.clk, r.dl)
            cost_week[(pid, week)] = c
            t = cost_tot.setdefault(pid, dict(cover_names))
            for k in metric_keys: t[k] += c[k]
        for r in db.session.query(FactPlanDaily.计划ID, FactPlanDaily.计划名称).filter(
                FactPlanDaily.计划ID.in_(numeric_plan_ids),
                FactPlanDaily.计划名称.isnot(None), FactPlanDaily.计划名称 != '',
                FactPlanDaily.平台 == '小红书').distinct().all():
            plan_name.setdefault(int(r.计划ID), r.计划名称)

    for p in plan_items:
        pid = int(p['plan_id']) if p['plan_id'].isdigit() else None
        tl = dict(cost_tot.get(pid, cover_names)) if pid is not None else dict(cover_names)
        p['plan_name'] = plan_name.get(pid, '') if pid is not None else ''
        p['totals'] = {**p['totals'], **tl}
        for wpt in p['weekly']:
            ws = str(wpt['week_start'])[:10]
            wc = cost_week.get((pid, ws), dict(cover_names)) if pid is not None else dict(cover_names)
            wpt['消耗'] = wc['消耗']; wpt['展示'] = wc['展示']; wpt['点击'] = wc['点击']; wpt['下载'] = wc['下载']
            agg = cost_week_agg.setdefault(ws, dict(cover_names))
            for k in metric_keys: agg[k] += wc[k]

    top_plans = plan_items[:top_n]

    weekly_totals = []
    for week, t in sorted(weekly_agg.items()):
        ws = week[:10]
        rates = _calc_rates(t['企微'], t['开口'], t['有效线索'], t['有效线索_不含存量'], t['新开户'], t['有效户'])
        cw = cost_week_agg.get(ws, dict(cover_names))
        weekly_totals.append({'week_start': week, **t, **rates, **cw})

    totals = {
        'total_plans': len(plan_items),
        'top_plans': len(top_plans),
        'total_qiwei': sum(p['totals']['企微'] for p in plan_items),
        'total_kaihou': sum(p['totals']['开口'] for p in plan_items),
        'total_youxiao': sum(p['totals']['有效线索'] for p in plan_items),
        'total_youxiao_bcq': sum(p['totals']['有效线索_不含存量'] for p in plan_items),
        'total_xinkaihu': sum(p['totals']['新开户'] for p in plan_items),
        'total_youxiao_hu': sum(p['totals']['有效户'] for p in plan_items),
        'total_spend': round(sum(p['totals']['消耗'] for p in plan_items), 2),
        'total_impressions': sum(p['totals']['展示'] for p in plan_items),
        'total_clicks': sum(p['totals']['点击'] for p in plan_items),
        'total_downloads': sum(p['totals']['下载'] for p in plan_items),
        'total_weeks': len(weekly_totals),
    }

    return jsonify({
        'success': True,
        'data': {
            'agencies': agencies,
            'target_agencies': TARGET_AGENCIES,
            'selected_agency': agency,
            'weekly_totals': weekly_totals,
            'plan_items': top_plans,
            'totals': totals,
            'top_n': top_n,
            'all_count': len(plan_items),
        },
        'meta': {**_META, 'group_by': '广告ID × 周起始日'},
    })