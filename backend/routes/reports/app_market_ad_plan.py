# -*- coding: utf-8 -*-
"""应用市场 · 广告计划分析（v3.8.2）

结合三个数据源：
  1. dim_ad_plan_class（应用市场计划分解，1 行=1 广告分组）
     → 应用市场 / 广告分组ID / 广告分组名称 / 版位 / 子版位 / 出价
     → 仅用于「计划明细 / 按版位聚合 / 按周分计划 / 分计划展开」（5 大市场有分解，苹果/鸿蒙无分解）
  2. fact_conv_appmarket（应用市场下载链路，1 行=1 APP 下载）
     → 按 应用市场 直接聚合 广告开户（渠道类型=互联网引流 & 是否新开户=1 & 是否创建完资金账号=1）
     → 按 广告计划ID + 周五周 统计下载链路各阶段（下载/激活/开户注册/身份证/银行卡/开户提交/开户成功/广告开户，按设备号去重）
  3. agg_vendor_daily（厂商广告投放分析）
     → 按 平台(应用市场) 直接聚合 消耗（花费）
  4. fact_appmarket_plan_daily（厂商广告计划维度明细 9.3）
     → 按 计划ID + 周五周 统计 计划级 消耗/展示/点击/下载

页面结构（周度口径统一：上周五 → 本周四）：
  一、市场筛选（前端多选 + 全部，默认全部 7 大应用市场）
  二、开户概览：总开户 / 总消耗 / 总开户成本
  三、按周开户量柱状图（每周广告开户量，上周五~本周四）
  四、按周分计划分析：周度筛选（默认最新一周），各计划按该周消耗降序，
     展示 消耗/展示/点击/点击率/下载量/下载率/激活量/激活率/开户注册量/开户注册率/
     身份证上传量/身份证上传率/银行卡上传量/银行卡上传率/开户提交量/开户提交率/
     开户成功量/开户成功率/广告开户量/广告开户率/广告开户成本
  五、广告聚类分析（前端由 plan_week_detail 按所选周派生）：周度筛选，
     版位 / 子版位 / 版位+子版位 / 出价 四类聚类 × 消耗 / 广告开户量 / 广告开户成本
  六、分计划分析：每条计划一个子模块，顶部为汇总数据，点击「+」按周展开（上周五~本周四）
  七、计划分析（原）：按计划明细 / 按版位 / 按市场聚合
  八、ReportFooter

口径说明：
  - 总开户（广告开户节点）= 是否创建完资金账号=1 AND 渠道类型=互联网引流 AND 是否新开户=1
  - 总消耗 = 所选应用市场 agg_vendor_daily.花费（平台=应用市场，计划全渠道花费）之和
  - 总开户成本 = 总消耗 / 总开户（分母为 0 时返回 null，前端展示 '-'）
  - 分计划漏斗各阶段量 = fact_conv_appmarket 按 广告计划ID + 周 统计「去重设备号」；
    消耗/展示/点击/下载 = fact_appmarket_plan_daily 按 计划ID + 周 求和
  - 转化率均为步骤间口径：点击率=点击/展示、下载率=下载/点击、激活率=激活/下载、
    开户注册率=开户注册/激活、身份证上传率=身份证/开户注册、银行卡上传率=银行卡/身份证、
    开户提交率=开户提交/银行卡、开户成功率=开户成功/开户提交、
    广告开户率=广告开户/开户成功；广告开户成本=消耗/广告开户量
"""
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from sqlalchemy import case, distinct, func

from backend.models_v2 import DimAdPlanClass, FactConvAppmarket, AggVendorDaily, FactAppmarketPlanDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.dialect_helpers import make_friday_week_start_expr

bp = Blueprint('app_market_ad_plan', __name__, url_prefix='/api/v1/reports/app-market')

# 7 大应用市场（与归因转化率 / 计划分解口径一致）
ALLOWED_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']

_META = {
    'version': 'v3.8.2',
    'source': 'dim_ad_plan_class + fact_conv_appmarket + agg_vendor_daily + fact_appmarket_plan_daily',
    'note': '广告计划分析：开户概览 + 按周开户量 + 按周分计划 + 分计划展开（周度=上周五~本周四）',
    'open_condition': '是否创建完资金账号=1 AND 渠道类型=互联网引流 AND 是否新开户=1',
    'spend_source': 'agg_vendor_daily.花费（按 平台=应用市场 聚合）；分计划消耗/展示/点击/下载 = fact_appmarket_plan_daily 按 计划ID 聚合',
    'open_source': 'fact_conv_appmarket（按 应用市场 聚合，广告开户节点）',
    'week_rule': '上周五 ~ 本周四',
    'funnel_note': '分计划漏斗量按 设备号去重；计划级消耗/展示/点击/下载取自 fact_appmarket_plan_daily（9.3）；转化率为步骤间口径（点击/展示、下载/点击、激活/下载、…、广告开户/开户成功）',
}

# 广告开户复合条件（与归因转化率报表口径一致）
AD_ACCOUNT_CONDITIONS = (
    (FactConvAppmarket.是否创建完资金账号 == 1)
    & (FactConvAppmarket.渠道类型 == '互联网引流')
    & (FactConvAppmarket.是否新开户 == 1)
)

# 下载链路各阶段条件（量 = 去重设备号）
FUNNEL_STAGES = [
    ('激活量', FactConvAppmarket.是否激活APP == 1),
    ('开户注册量', FactConvAppmarket.是否开户注册 == 1),
    ('身份证上传量', FactConvAppmarket.是否注册身份证 == 1),
    ('银行卡上传量', FactConvAppmarket.是否注册银行卡 == 1),
    ('开户提交量', FactConvAppmarket.是否提交开户 == 1),
    # 开户成功阶段口径：必须用「是否创建完资金账号」（business-invariants.md 第3节）
    ('开户成功量', FactConvAppmarket.是否创建完资金账号 == 1),
]


def _resolve_markets(platforms):
    """返回本次分析涉及的应用市场列表（空 -> 全部 7 大市场）。"""
    if platforms:
        return [p for p in platforms if p in ALLOWED_PLATFORMS]
    return list(ALLOWED_PLATFORMS)


def _rate(numerator, denominator):
    """安全比率计算，分母为 0 返回 0.0（前端展示为 '-'）"""
    if not denominator:
        return 0.0
    return round(numerator / denominator, 4)


def _ws_str(v):
    """周起始值归一化为 'YYYY-MM-DD' 字符串（SQLite 返回 str，PG 返回 date）"""
    if isinstance(v, str):
        return v
    if hasattr(v, 'isoformat'):
        return v.isoformat()[:10]
    return str(v)


def _week_end(week_start):
    """周五起始周的结束日（周四）"""
    try:
        d = datetime.strptime(week_start, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return week_start
    return (d + timedelta(days=6)).isoformat()


def _count_devices(cond):
    """满足条件的去重设备号计数（COUNT(DISTINCT 设备号)），用于漏斗各阶段量"""
    return func.count(distinct(case((cond, FactConvAppmarket.设备号), else_=None)))


# ---------------------------------------------------------------------------
# 市场级（应用市场 / 平台）聚合：开销户与消耗，覆盖全部 7 大市场（含苹果/鸿蒙）
# ---------------------------------------------------------------------------
def _market_open_map(markets, start_date, end_date):
    """各应用市场的广告开户数（fact_conv_appmarket.应用市场）。"""
    q = db.session.query(
        FactConvAppmarket.应用市场,
        func.coalesce(
            func.sum(case((AD_ACCOUNT_CONDITIONS, 1), else_=0)), 0
        ).label('open_cnt'),
    ).filter(FactConvAppmarket.应用市场.in_(markets))
    if start_date:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 >= start_date)
    if end_date:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 <= end_date)
    q = q.group_by(FactConvAppmarket.应用市场)
    return {r.应用市场: int(r.open_cnt or 0) for r in q.all()}


def _market_spend_map(markets, start_date, end_date):
    """各应用市场的消耗（agg_vendor_daily.平台，花费>0）。"""
    q = db.session.query(
        AggVendorDaily.平台,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('spend'),
    ).filter(AggVendorDaily.平台.in_(markets), AggVendorDaily.花费 > 0)
    if start_date:
        q = q.filter(AggVendorDaily.日期 >= start_date)
    if end_date:
        q = q.filter(AggVendorDaily.日期 <= end_date)
    q = q.group_by(AggVendorDaily.平台)
    return {r.平台: float(r.spend or 0) for r in q.all()}


# ---------------------------------------------------------------------------
# 计划级（dim_ad_plan_class）聚合：仅 5 大市场有 plan 分解
# ---------------------------------------------------------------------------
def _load_plans(markets):
    """加载应用市场计划分解维度（按 markets 过滤），返回 plan 列表。"""
    q = db.session.query(DimAdPlanClass)
    if markets:
        q = q.filter(DimAdPlanClass.应用市场.in_(markets))
    plans = []
    for r in q.all():
        plans.append({
            'plan_id': r.广告分组ID,
            'market': r.应用市场,
            'plan_name': r.广告分组名称,
            'placement': r.版位,
            'sub_placement': r.子版位,
            'bid': r.出价,
        })
    return plans


def _plan_level_maps(plan_ids, start_date, end_date):
    """各计划的广告开户数（fact_conv_appmarket）与消耗（agg_vendor_daily）。"""
    open_map, spend_map = {}, {}
    if not plan_ids:
        return open_map, spend_map

    open_q = db.session.query(
        FactConvAppmarket.广告计划ID,
        func.coalesce(
            func.sum(case((AD_ACCOUNT_CONDITIONS, 1), else_=0)), 0
        ).label('open_cnt'),
    ).filter(FactConvAppmarket.广告计划ID.in_(plan_ids))
    if start_date:
        open_q = open_q.filter(FactConvAppmarket.资金账号创建完成时间 >= start_date)
    if end_date:
        open_q = open_q.filter(FactConvAppmarket.资金账号创建完成时间 <= end_date)
    open_q = open_q.group_by(FactConvAppmarket.广告计划ID)
    for r in open_q.all():
        open_map[int(r.广告计划ID)] = int(r.open_cnt or 0)

    spend_q = db.session.query(
        FactAppmarketPlanDaily.计划ID,
        func.coalesce(func.sum(FactAppmarketPlanDaily.花费), 0).label('spend'),
    ).filter(FactAppmarketPlanDaily.计划ID.in_(plan_ids), FactAppmarketPlanDaily.花费 > 0)
    if start_date:
        spend_q = spend_q.filter(FactAppmarketPlanDaily.日期 >= start_date)
    if end_date:
        spend_q = spend_q.filter(FactAppmarketPlanDaily.日期 <= end_date)
    spend_q = spend_q.group_by(FactAppmarketPlanDaily.计划ID)
    for r in spend_q.all():
        spend_map[int(r.计划ID)] = float(r.spend or 0)

    return open_map, spend_map


def _overview_and_breakdown(markets, start_date, end_date):
    """计算 开户概览 + 计划分析（明细/版位/市场聚合）。"""
    open_map = _market_open_map(markets, start_date, end_date)
    spend_map = _market_spend_map(markets, start_date, end_date)

    total_open = sum(open_map.values())
    total_spend = round(sum(spend_map.values()), 2)
    total_cost = round(total_spend / total_open, 2) if total_open else None
    overview = {
        'total_open': total_open,
        'total_spend': total_spend,
        'total_open_cost': total_cost,
    }

    by_market = []
    for m in markets:
        oc = open_map.get(m, 0)
        sp = round(spend_map.get(m, 0), 2)
        by_market.append({
            'market': m,
            'open_count': oc,
            'spend': sp,
            'open_cost': round(sp / oc, 2) if oc else None,
        })
    by_market.sort(key=lambda x: -(x['open_count'] or 0))

    plans = _load_plans(markets)
    plan_ids = list({p['plan_id'] for p in plans})
    po_map, ps_map = _plan_level_maps(plan_ids, start_date, end_date)

    plan_detail = []
    for p in plans:
        pid = p['plan_id']
        oc = po_map.get(pid, 0)
        sp = round(ps_map.get(pid, 0), 2)
        cost = round(sp / oc, 2) if oc else None
        plan_detail.append({
            'plan_id': str(pid),
            'market': p['market'],
            'plan_name': p['plan_name'],
            'placement': p['placement'],
            'sub_placement': p['sub_placement'],
            'bid': p['bid'],
            'open_count': oc,
            'spend': sp,
            'open_cost': cost,
        })
    plan_detail.sort(key=lambda x: (-(x['open_count'] or 0), -(x['spend'] or 0)))

    placement_agg = {}
    for p in plan_detail:
        key = (p['placement'] or '未分类', p['sub_placement'] or '未分类')
        agg = placement_agg.setdefault(key, {'open_count': 0, 'spend': 0.0})
        agg['open_count'] += p['open_count']
        agg['spend'] += p['spend']
    by_placement = []
    for (pl, spl), agg in placement_agg.items():
        by_placement.append({
            'placement': pl,
            'sub_placement': spl,
            'open_count': agg['open_count'],
            'spend': round(agg['spend'], 2),
            'open_cost': round(agg['spend'] / agg['open_count'], 2) if agg['open_count'] else None,
        })
    by_placement.sort(key=lambda x: -(x['open_count'] or 0))

    return overview, plan_detail, by_placement, by_market


# ---------------------------------------------------------------------------
# 新增模块：按周开户量柱状图 + 按周分计划 + 分计划展开（周五起始周）
# ---------------------------------------------------------------------------
def _build_metrics(spend, impressions, clicks, downloads, activate, register,
                   id_card, bank_card, submit, success, ad_account):
    """由各阶段原始计数构建指标行（含步骤间转化率与广告开户成本）。"""
    return {
        '消耗': round(spend, 2),
        '展示': int(impressions),
        '点击': int(clicks),
        '点击率': _rate(clicks, impressions),
        '下载量': int(downloads),
        '下载率': _rate(downloads, clicks),
        '激活量': int(activate),
        '激活率': _rate(activate, downloads),
        '开户注册量': int(register),
        '开户注册率': _rate(register, activate),
        '身份证上传量': int(id_card),
        '身份证上传率': _rate(id_card, register),
        '银行卡上传量': int(bank_card),
        '银行卡上传率': _rate(bank_card, id_card),
        '开户提交量': int(submit),
        '开户提交率': _rate(submit, bank_card),
        '开户成功量': int(success),
        '开户成功率': _rate(success, submit),
        '广告开户量': int(ad_account),
        '广告开户率': _rate(ad_account, success),
        '广告开户成本': round(spend / ad_account, 2) if ad_account else None,
    }


def _weekly_open(markets, start_date, end_date):
    """按周（上周五~本周四）的广告开户量（per-market，便于前端按所选市场聚合）。

    每条记录含 market + week_start + open_count，前端按市场筛选后周内求和得到图表数据。
    """
    if not markets:
        return []
    fweek = make_friday_week_start_expr(FactConvAppmarket.资金账号创建完成时间).label('week_start')
    q = db.session.query(
        FactConvAppmarket.应用市场.label('market'),
        fweek,
        func.coalesce(
            func.sum(case((AD_ACCOUNT_CONDITIONS, 1), else_=0)), 0
        ).label('open_count'),
    ).filter(FactConvAppmarket.应用市场.in_(markets))
    if start_date:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 >= start_date)
    if end_date:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 <= end_date)
    q = q.group_by(FactConvAppmarket.应用市场, fweek).order_by(FactConvAppmarket.应用市场, fweek)

    out = []
    for r in q.all():
        ws = _ws_str(r.week_start)
        out.append({
            'market': r.market,
            'week_start': ws,
            'week_end': _week_end(ws),
            'open_count': int(r.open_count or 0),
        })
    return out


def _plan_week_analysis(markets, start_date, end_date, week_start):
    """按周分计划分析 + 分计划展开（周五起始周）。

    返回 (weeks, selected_week, week_plans, plan_week_detail)：
      - weeks: 可选周列表（降序，最新在前）
      - selected_week: 实际生效周（请求 week_start 无效时取最新一周）
      - week_plans: 所选周的各计划指标行（按该周消耗降序）
      - plan_week_detail: 各计划的汇总 + 逐周明细（周降序），计划按汇总消耗降序
    """
    plans = _load_plans(markets)
    plan_ids = list({p['plan_id'] for p in plans})
    agg_by, fact_by = {}, {}

    if plan_ids:
        # ---- fact_appmarket_plan_daily：消耗/展示/点击/下载（按 计划ID + 周五周） ----
        fweek = make_friday_week_start_expr(FactAppmarketPlanDaily.日期).label('week_start')
        agg_q = db.session.query(
            FactAppmarketPlanDaily.计划ID, fweek,
            func.coalesce(func.sum(FactAppmarketPlanDaily.花费), 0).label('spend'),
            func.coalesce(func.sum(FactAppmarketPlanDaily.展示量), 0).label('impressions'),
            func.coalesce(func.sum(FactAppmarketPlanDaily.点击量), 0).label('clicks'),
            func.coalesce(func.sum(FactAppmarketPlanDaily.下载量), 0).label('downloads'),
        ).filter(
            FactAppmarketPlanDaily.计划ID.in_(plan_ids),
            (FactAppmarketPlanDaily.花费 > 0)
            | (FactAppmarketPlanDaily.展示量 > 0)
            | (FactAppmarketPlanDaily.点击量 > 0)
            | (FactAppmarketPlanDaily.下载量 > 0),
        )
        if start_date:
            agg_q = agg_q.filter(FactAppmarketPlanDaily.日期 >= start_date)
        if end_date:
            agg_q = agg_q.filter(FactAppmarketPlanDaily.日期 <= end_date)
        agg_q = agg_q.group_by(FactAppmarketPlanDaily.计划ID, fweek)
        for r in agg_q.all():
            agg_by[(int(r.计划ID), _ws_str(r.week_start))] = {
                'spend': float(r.spend or 0),
                'impressions': float(r.impressions or 0),
                'clicks': float(r.clicks or 0),
                'downloads': float(r.downloads or 0),
            }

        # ---- fact_conv_appmarket：下载链路各阶段（按 广告计划ID + 周五周，去重设备号） ----
        fweek2 = make_friday_week_start_expr(FactConvAppmarket.资金账号创建完成时间).label('week_start')
        fact_q = db.session.query(
            FactConvAppmarket.广告计划ID, fweek2,
            _count_devices(FactConvAppmarket.是否激活APP == 1).label('activate'),
            _count_devices(FactConvAppmarket.是否开户注册 == 1).label('register'),
            _count_devices(FactConvAppmarket.是否注册身份证 == 1).label('id_card'),
            _count_devices(FactConvAppmarket.是否注册银行卡 == 1).label('bank_card'),
            _count_devices(FactConvAppmarket.是否提交开户 == 1).label('submit'),
            _count_devices(FactConvAppmarket.是否创建完资金账号 == 1).label('success'),
            _count_devices(AD_ACCOUNT_CONDITIONS).label('ad_account'),
        ).filter(
            FactConvAppmarket.广告计划ID.in_(plan_ids),
            FactConvAppmarket.渠道类型 == '互联网引流',
        )
        if start_date:
            fact_q = fact_q.filter(FactConvAppmarket.资金账号创建完成时间 >= start_date)
        if end_date:
            fact_q = fact_q.filter(FactConvAppmarket.资金账号创建完成时间 <= end_date)
        fact_q = fact_q.group_by(FactConvAppmarket.广告计划ID, fweek2)
        for r in fact_q.all():
            fact_by[(int(r.广告计划ID), _ws_str(r.week_start))] = {
                'activate': float(r.activate or 0),
                'register': float(r.register or 0),
                'id_card': float(r.id_card or 0),
                'bank_card': float(r.bank_card or 0),
                'submit': float(r.submit or 0),
                'success': float(r.success or 0),
                'ad_account': float(r.ad_account or 0),
            }

    # ---- 组装 各计划 × 周 ----
    plan_week_detail = []
    all_weeks = set()
    for p in plans:
        pid = p['plan_id']
        keys = {k for (pid_, k) in agg_by if pid_ == pid} | {k for (pid_, k) in fact_by if pid_ == pid}
        week_rows = []
        for wk in keys:
            a = agg_by.get((pid, wk), {})
            f = fact_by.get((pid, wk), {})
            m = _build_metrics(
                a.get('spend', 0), a.get('impressions', 0), a.get('clicks', 0),
                a.get('downloads', 0), f.get('activate', 0), f.get('register', 0),
                f.get('id_card', 0), f.get('bank_card', 0), f.get('submit', 0),
                f.get('success', 0), f.get('ad_account', 0),
            )
            m['week_start'] = wk
            m['week_end'] = _week_end(wk)
            week_rows.append(m)
            all_weeks.add(wk)
        week_rows.sort(key=lambda x: x['week_start'], reverse=True)

        sum_metrics = _build_metrics(
            sum(agg_by.get((pid, wk), {}).get('spend', 0) for wk in keys),
            sum(agg_by.get((pid, wk), {}).get('impressions', 0) for wk in keys),
            sum(agg_by.get((pid, wk), {}).get('clicks', 0) for wk in keys),
            sum(agg_by.get((pid, wk), {}).get('downloads', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('activate', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('register', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('id_card', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('bank_card', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('submit', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('success', 0) for wk in keys),
            sum(fact_by.get((pid, wk), {}).get('ad_account', 0) for wk in keys),
        )
        plan_week_detail.append({
            'plan_id': str(pid),
            'market': p['market'],
            'plan_name': p['plan_name'],
            'placement': p['placement'],
            'sub_placement': p['sub_placement'],
            'bid': p['bid'],
            'summary': sum_metrics,
            'weeks': week_rows,
        })

    plan_week_detail.sort(key=lambda x: -(x['summary'].get('消耗') or 0))
    weeks = sorted(all_weeks, reverse=True)
    selected = week_start if week_start in weeks else (weeks[0] if weeks else None)

    week_plans = []
    if selected:
        for pl in plan_week_detail:
            row = next((w for w in pl['weeks'] if w['week_start'] == selected), None)
            if row:
                week_plans.append({
                    'plan_id': pl['plan_id'],
                    'market': pl['market'],
                    'plan_name': pl['plan_name'],
                    'placement': pl['placement'],
                    'sub_placement': pl['sub_placement'],
                    **row,
                })
        week_plans.sort(key=lambda x: -(x.get('消耗') or 0))

    return weeks, selected, week_plans, plan_week_detail


@bp.route('/ad-plan-analysis', methods=['POST'])
@handle_exceptions
def ad_plan_analysis():
    """广告计划分析 — 开户概览 + 按周开户量 + 按周分计划 + 分计划展开 + 计划分析"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    platforms = filters.get('platforms') or []
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')
    week_start = filters.get('week_start')

    markets = _resolve_markets(platforms)
    available = list(ALLOWED_PLATFORMS)

    overview, plan_detail, by_placement, by_market = _overview_and_breakdown(
        markets, start_date, end_date
    )
    weekly_open = _weekly_open(markets, start_date, end_date)
    weeks, selected_week, week_plans, plan_week_detail = _plan_week_analysis(
        markets, start_date, end_date, week_start
    )

    return jsonify({
        'success': True,
        'data': {
            'platforms': available,
            'selected_platforms': platforms,
            'overview': overview,
            'plan_detail': plan_detail,
            'by_placement': by_placement,
            'by_market': by_market,
            'weekly_open': weekly_open,
            'weeks': weeks,
            'selected_week': selected_week,
            'week_plans': week_plans,
            'plan_week_detail': plan_week_detail,
        },
        'meta': _META,
    })
