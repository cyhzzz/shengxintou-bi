# -*- coding: utf-8 -*-
"""
周报数据 API 路由

v3.1.31 起纯数据化改造：所有数据实时聚合，不依赖 weekly_reports 表。
- GET  /periods        周次选项列表
- POST /data           纯数据周报（本周 + 全年累计 + 上周环比 + 两堆叠图 + 互联网占比 + KPI）
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date as _date
import logging
import re

from backend.database import db
from backend.models_v2 import (
    AggVendorDaily, AggDailyChannelOpen, FactConvContent,
    FactConvAppmarket, FactPlanDaily, DimAdPlanClass, DimAnchorLiveType,
)
from backend.utils.weekly_utils import get_week_info, generate_week_options, validate_week_period, get_all_fridays_in_year
from backend.utils.decorators import handle_exceptions
from sqlalchemy import func, and_, case, distinct
# 复用主播聚类核心（复合来源均分口径与 /anchor-clusters 严格一致），避免两处实现漂移
from backend.routes.data.leads import _compute_anchor_cluster_items

logger = logging.getLogger(__name__)

bp = Blueprint('weekly_reports', __name__, url_prefix='/api/v1/reports/weekly')


@bp.route('/periods', methods=['GET'])
@handle_exceptions
def get_periods():
    """获取可选周次列表（纯生成，不查库）"""
    weeks_count = request.args.get('weeks_count', 12, type=int)
    options = generate_week_options(weeks_count)
    options.sort(key=lambda x: (x['report_year'], x['report_week']), reverse=True)
    return jsonify({
        'success': True,
        'data': options
    })


def _safe_div(num, den, pct=False):
    """安全除法，分母为 0 返回 0；pct=True 时返回百分比"""
    try:
        if not den:
            return 0.0
        r = float(num) / float(den)
        return round(r * 100, 2) if pct else round(r, 4)
    except (TypeError, ZeroDivisionError):
        return 0.0


# 应用市场渠道名称集合（与前端 CHANNEL_CATEGORY_MAP 一致；用于开户数按渠道大类拆分）
APP_MARKET_CHANNELS = ('华为', '荣耀', '小米', 'oppo', 'vivo', '苹果', '鸿蒙')


def _query_metrics(sd, ed):
    """查询某时间区间的核心指标

    1. 消耗金额 (agg_vendor_daily.花费)
    2. 品牌曝光 (agg_vendor_daily.展示量)
    3. 企微数   (fact_conv_content COUNT(*), 内容平台线索)
    4. APP激活数 (agg_vendor_daily.APP激活人数, 应用市场线索)
    5. 开户数   (agg_daily_channel_open.开户成功人数, 仅互联网引流)
       v3.3.10 起按渠道名称拆 3 行：
         - opens_app   应用市场开户数（华为/荣耀/小米/oppo/vivo/苹果/鸿蒙）
         - opens_other 其他渠道开户数（互联网引流 - 应用市场）
         - opens       合计新开户数（互联网引流合计）
    6. 新增有效户数 (agg_daily_channel_open.有效户数, 仅互联网引流)
    7. 新增客户资产 (agg_vendor_daily.客户资产 SUM)
       v3.2.3 起改走 DWS 预聚合字段，与 Dashboard /core-metrics 口径对齐
       （原 DWD 明细实时 SUM 与 ETL 预聚合有 ~16.75 万差异，DWS 更权威）
    """
    ad_r = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.APP激活人数), 0).label('leads_app'),
        func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
    ).filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed)).first()

    leads_wx = db.session.query(
        func.coalesce(func.count(FactConvContent.id), 0)
    ).filter(and_(
        FactConvContent.线索日期 >= sd,
        FactConvContent.线索日期 <= ed,
    )).scalar() or 0

    ch_r = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).first()

    # 应用市场开户数：互联网引流里渠道名称属于应用市场大类的部分
    opens_app = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0)
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.渠道名称.in_(APP_MARKET_CHANNELS),
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0

    opens_total = int(ch_r.opens or 0)
    opens_app_int = int(opens_app)
    opens_other_int = opens_total - opens_app_int

    return {
        'cost': float(ad_r.cost or 0),
        'impressions': int(ad_r.impressions or 0),
        'leads_wx': int(leads_wx),
        'leads_app': int(ad_r.leads_app or 0),
        'opens_app': opens_app_int,
        'opens_other': opens_other_int,
        'opens': opens_total,
        'valid': int(ch_r.valid or 0),
        'assets': float(ad_r.assets or 0),
    }


def _calc_wow(curr, prev):
    """计算环比百分比，prev=0 或不可比时返回 None"""
    if prev is None or prev == 0:
        return None
    return round((float(curr) - float(prev)) / float(prev) * 100, 2)


@bp.route('/data', methods=['POST'])
@handle_exceptions
def get_weekly_data():
    """纯数据周报端点（本周 + 全年累计 + 上周环比 + 两堆叠图 + 互联网占比 + KPI）

    输入: { report_year, report_week } 或 { start_date, end_date }
    """
    data = request.get_json() or {}
    report_year = data.get('report_year')
    report_week = data.get('report_week')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if report_year and report_week:
        if not validate_week_period(report_year, report_week):
            return jsonify({'success': False, 'error': f'无效的周次: {report_year}年第{report_week}周'}), 400
        fridays = get_all_fridays_in_year(report_year)
        if report_week - 1 >= len(fridays):
            return jsonify({'success': False, 'error': f'无效的周次: {report_year}年第{report_week}周'}), 400
        friday = fridays[report_week - 1]
        week_info = get_week_info(friday)
        sd = week_info['start_date']
        ed = week_info['end_date']
        report_name = week_info['report_name']
        report_sequence = week_info['report_sequence']
    elif start_date and end_date:
        sd = start_date
        ed = end_date
        report_year = int(sd[:4])
        report_week = int(sd[5:7])
        report_name = f'{report_year}年第{report_week}周'
        report_sequence = report_week
    else:
        return jsonify({'success': False, 'error': '需要 report_year+report_week 或 start_date+end_date'}), 400

    sd_dt = datetime.strptime(sd, '%Y-%m-%d')
    ed_dt = datetime.strptime(ed, '%Y-%m-%d')
    prev_sd = (sd_dt - timedelta(days=7)).strftime('%Y-%m-%d')
    prev_ed = (ed_dt - timedelta(days=7)).strftime('%Y-%m-%d')

    year_start = f'{report_year}-01-01'

    current_week = _query_metrics(sd, ed)
    year_to_date = _query_metrics(year_start, ed)
    prev_week = _query_metrics(prev_sd, prev_ed)

    week_over_week = {
        k: _calc_wow(current_week[k], prev_week[k]) for k in
        ['cost', 'impressions', 'leads_wx', 'leads_app',
         'opens_app', 'opens_other', 'opens', 'valid', 'assets']
    }

    opens_daily_rows = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        AggDailyChannelOpen.渠道名称.label('channel'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('val'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.时间区间, AggDailyChannelOpen.渠道名称).all()

    opens_yearly_rows = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        AggDailyChannelOpen.渠道名称.label('channel'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('val'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.时间区间, AggDailyChannelOpen.渠道名称).all()

    CHANNEL_CATEGORY_MAP = {
        '小红书': '内容平台', '腾讯': '内容平台', '抖音': '内容平台',
        '快手': '内容平台', '财联社': '内容平台', 'yj': '内容平台',
        '云极': '内容平台', '其他': '内容平台',
        '华为': '应用市场', '荣耀': '应用市场', '小米': '应用市场',
        'oppo': '应用市场', 'vivo': '应用市场', '苹果': '应用市场', '鸿蒙': '应用市场',
        '高德': '本地生活',
    }

    fridays = get_all_fridays_in_year(report_year)
    week_list = []
    for i, f in enumerate(fridays, 1):
        wi = get_week_info(f)
        wsd = wi['start_date']
        wed = wi['end_date']
        if wsd > ed:
            continue
        if wed > ed:
            wed = ed
        week_list.append({'week': f'W{i:02d}', 'sd': wsd, 'ed': wed})

    def _find_week(d_str):
        for w in week_list:
            if w['sd'] <= d_str <= w['ed']:
                return w['week']
        return None

    channel_set = {}
    for r in opens_yearly_rows:
        ch = r.channel or '未分类'
        channel_set[ch] = channel_set.get(ch, 0) + int(r.val or 0)

    CATEGORY_ORDER = {'内容平台': 0, '应用市场': 1, '本地生活': 2}
    channels = sorted(
        channel_set.keys(),
        key=lambda c: (CATEGORY_ORDER.get(CHANNEL_CATEGORY_MAP.get(c, '内容平台'), 99), -channel_set[c])
    )

    def _pivot_daily(rows):
        all_dates = sorted(set([r.date for r in rows]))
        m = {}
        for r in rows:
            d = r.date
            ch = r.channel or '未分类'
            if d not in m:
                m[d] = {'date': d}
            m[d][ch] = int(r.val or 0)
        return [m.get(d, {'date': d}) for d in all_dates]

    daily_opens_stacked = _pivot_daily(opens_daily_rows)

    def _pivot_weekly(rows):
        m = {}
        for r in rows:
            wk = _find_week(r.date)
            if not wk:
                continue
            ch = r.channel or '未分类'
            if wk not in m:
                m[wk] = {'week': wk}
            m[wk][ch] = m[wk].get(ch, 0) + int(r.val or 0)
        return [m.get(w['week'], {'week': w['week']}) for w in week_list]

    weekly_opens_stacked = _pivot_weekly(opens_yearly_rows)

    week_all_opens = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    week_all_valid = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    year_all_opens = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    year_all_valid = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0

    internet_ratio = {
        'opens_ratio': _safe_div(current_week['opens'], week_all_opens, pct=True) if week_all_opens else 0.0,
        'valid_ratio': _safe_div(current_week['valid'], week_all_valid, pct=True) if week_all_valid else 0.0,
        'year_opens_ratio': _safe_div(year_to_date['opens'], year_all_opens, pct=True) if year_all_opens else 0.0,
        'year_valid_ratio': _safe_div(year_to_date['valid'], year_all_valid, pct=True) if year_all_valid else 0.0,
    }

    year_total_days = (_date(report_year, 12, 31) - _date(report_year, 1, 1)).days + 1
    passed_days = (ed_dt.date() - _date(report_year, 1, 1)).days + 1
    time_progress = passed_days / year_total_days

    KPI_TARGETS = {
        'opens': 20000,
        'valid': 10000,
        'assets': 5_0000_0000,
    }

    def _kpi_rate(key):
        target = KPI_TARGETS[key]
        actual = year_to_date[key]
        expected = target * time_progress
        return _safe_div(actual, expected, pct=True) if expected else 0.0

    kpi = {
        'time_progress': round(time_progress * 100, 2),
        'opens': {
            'target': KPI_TARGETS['opens'],
            'actual': year_to_date['opens'],
            'rate': _kpi_rate('opens'),
        },
        'valid': {
            'target': KPI_TARGETS['valid'],
            'actual': year_to_date['valid'],
            'rate': _kpi_rate('valid'),
        },
        'assets': {
            'target': KPI_TARGETS['assets'],
            'actual': year_to_date['assets'],
            'rate': _kpi_rate('assets'),
        },
    }

    return jsonify({
        'success': True,
        'data': {
            'period': {
                'start_date': sd,
                'end_date': ed,
                'prev_start': prev_sd,
                'prev_end': prev_ed,
                'report_year': report_year,
                'report_week': report_week,
                'report_name': report_name,
                'report_sequence': report_sequence,
            },
            'current_week': current_week,
            'year_to_date': year_to_date,
            'prev_week': prev_week,
            'week_over_week': week_over_week,
            'daily_opens_stacked': daily_opens_stacked,
            'weekly_opens_stacked': weekly_opens_stacked,
            'channels': channels,
            'internet_ratio': internet_ratio,
            'kpi': kpi,
        }
    })


# ============================================================================
# 周报详细版（v4.2.x）：在"总数+走势"概览基础上，按渠道分类下钻细分分析
#   应用市场 -> 平台 -> 广告计划 -> 版位/子版位/出价
#   内容平台(小红书/腾讯/抖音) -> 平台 -> 厂商 -> 计划
#   直播 -> 主播（复合来源均分，复用 leads.py 的 _compute_anchor_cluster_items）
# ============================================================================
APP_MARKET_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']
# 内容平台：小红书/腾讯/抖音/yj/云极/快手；财联社不在此列（财联社数据均为直播场景，由直播聚合覆盖，避免重复计数）
CONTENT_PLATFORMS = ['小红书', '腾讯', '抖音', 'yj', '云极', '快手']
# 展示用内容平台列表：yj 与 云极 为同一平台的两种上游命名，查询保留双名，展示统一归并为「云极」
CONTENT_PLATFORMS_DISPLAY = ['小红书', '腾讯', '抖音', '云极', '快手']
# 本地生活渠道（独立板块，当前仅高德）
LOCAL_LIFE_CHANNELS = ('高德',)
# 广告开户复合条件（与 app_market_ad_plan.py / app_market_attribution.py 一致）
_AD_ACCOUNT_COND = (
    (FactConvAppmarket.是否创建完资金账号 == 1)
    & (FactConvAppmarket.渠道类型 == '互联网引流')
    & (FactConvAppmarket.是否新开户 == 1)
)
# 平台名归一：yj/云极 统一展示为「云极」（BI 侧临时口径，上游统一命名后可移除；仅查询层展示，不动底表）
_PLATFORM_ALIAS = {'yj': '云极'}
# 内容平台厂商白名单：白名单平台仅列内厂商独立展示，其余统一并入「未归因」；
# 未配置白名单的平台（云极/快手）不做归并。仅查询层展示口径，不动底表；上游数据修正后可移除。
_FACTORY_WHITELIST = {
    '小红书': {'绩牛', '量子', '美洋', '开始故事', '群众互动', '直投'},
    '抖音': {'量子', '风声', '众联', '蛋白'},
    '腾讯': {'众联', '两把刷子', '直投'},
}
# 无白名单平台（云极/快手）的全局归并集：上游归属异常厂商并入「未归因」（沿用此前全局口径）
_GLOBAL_FACTORY_MERGE = {'哇棒', '风声', '众联', 'kiwi'}


def _norm_platform(name):
    """平台名归一：yj/云极 统一为「云极」。"""
    p = (name or '').strip()
    return _PLATFORM_ALIAS.get(p.lower(), p)


def _norm_factory(platform, name):
    """厂商名归一：白名单平台列外厂商并入「未归因」；无白名单平台按全局归并集处理。"""
    n = (name or '').strip()
    allowed = _FACTORY_WHITELIST.get(platform)
    if allowed is not None:
        return n if n in allowed else '未归因'
    return '未归因' if n.lower() in _GLOBAL_FACTORY_MERGE else (n or '未归因')


# 直播线索识别（客户来源口径）— 与 leads.py _compute_anchor_cluster_items 的匹配逻辑保持一致：
# 客户来源按 [,，;；、] 拆分后，任一段命中「(平台)引流-主播」正则或 dim_anchor_live_type
# 纯人名 token（is_active），即归为直播线索。直播线索在 _live_detail 板块单独统计，
# 内容平台线索数须排除，避免两板块重复计数。
_ANCHOR_SRC_PATTERN = re.compile(r"^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$")
_ANCHOR_SRC_SPLIT = re.compile(r"[,，;；、]+")


def _load_live_plain_tokens():
    """加载 dim_anchor_live_type 中 is_active 的纯人名 token（不含 引流-/直播带货-）。"""
    rows = db.session.query(
        DimAnchorLiveType.source_token, DimAnchorLiveType.is_active,
    ).all()
    return {
        r.source_token for r in rows
        if r.is_active and '引流-' not in r.source_token and '直播带货-' not in r.source_token
    }


def _is_live_lead_source(src, plain_tokens):
    """判断客户来源是否命中直播线索口径（主播聚类可识别），复刻主播聚类匹配逻辑。"""
    for part in _ANCHOR_SRC_SPLIT.split((src or '').strip()):
        segment = part.strip()
        if not segment:
            continue
        if _ANCHOR_SRC_PATTERN.match(segment) or segment in plain_tokens:
            return True
    return False


def _resolve_week_range(data):
    """复用 /data 的周次解析，返回 (sd, ed, report_year, report_week, report_name, report_sequence)。

    支持 report_year+report_week 或 start_date+end_date；无效周次返回 (None, None, ...)。
    """
    report_year = data.get('report_year')
    report_week = data.get('report_week')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    if report_year and report_week:
        if not validate_week_period(report_year, report_week):
            return None
        fridays = get_all_fridays_in_year(report_year)
        if report_week - 1 >= len(fridays):
            return None
        friday = fridays[report_week - 1]
        wi = get_week_info(friday)
        return (wi['start_date'], wi['end_date'], report_year, report_week,
                wi['report_name'], wi['report_sequence'])
    if start_date and end_date:
        return (start_date, end_date, int(start_date[:4]), int(start_date[5:7]),
                f'{start_date[:4]}年第{int(start_date[5:7])}周', int(start_date[5:7]))
    return None


def _app_market_detail(sd, ed):
    """应用市场 -> 平台 -> 广告计划 -> 版位/子版位/出价（复用 app_market_ad_plan 口径）。

    计划口径：FactPlanDaily 按 计划ID 聚合 消耗/展示/点击/下载；
    版位/子版位/出价：dim_ad_plan_class 关联广告分组ID；
    开户：fact_conv_appmarket 按 广告计划ID 聚合广告开户（资金账号创建完成时间）。
    """
    # 计划维度（全渠道聚合，过滤 7 大市场；注意 FactPlanDaily 平台可能为大写/小写）
    plan_rows = db.session.query(
        FactPlanDaily.计划ID,
        FactPlanDaily.平台,
        FactPlanDaily.计划名称,
        func.coalesce(func.sum(FactPlanDaily.花费), 0).label('spend'),
        func.coalesce(func.sum(FactPlanDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(FactPlanDaily.点击量), 0).label('clicks'),
    ).filter(and_(
        FactPlanDaily.日期 >= sd,
        FactPlanDaily.日期 <= ed,
        FactPlanDaily.平台.in_(APP_MARKET_PLATFORMS),
    )).group_by(FactPlanDaily.计划ID, FactPlanDaily.平台, FactPlanDaily.计划名称).all()

    plan_ids = []
    plan_by_id = {}
    for r in plan_rows:
        pid = int(r.计划ID) if r.计划ID is not None else None
        plan_ids.append(pid)
        plan_by_id[pid] = {
            'platform': r.平台,
            'plan_name': r.计划名称,
            'spend': float(r.spend or 0),
            'impressions': int(r.impressions or 0),
            'clicks': int(r.clicks or 0),
        }

    # 版位/子版位/出价（dim_ad_plan_class 关联广告分组ID）
    plan_class = {}
    if plan_ids:
        pc_rows = db.session.query(DimAdPlanClass.广告分组ID, DimAdPlanClass).filter(
            DimAdPlanClass.广告分组ID.in_(plan_ids)
        ).all()
        for pid, r in pc_rows:
            plan_class.setdefault(int(pid), {'versions': set(), 'sub_versions': set(), 'bids': set()})
            if r.版位:
                plan_class[int(pid)]['versions'].add(r.版位)
            if r.子版位:
                plan_class[int(pid)]['sub_versions'].add(r.子版位)
            if r.出价:
                plan_class[int(pid)]['bids'].add(r.出价)

    # 各计划广告开户（资金账号创建完成时间）
    open_map = {}
    if plan_ids:
        oc_rows = db.session.query(
            FactConvAppmarket.广告计划ID,
            func.coalesce(func.sum(case((_AD_ACCOUNT_COND, 1), else_=0)), 0).label('open_cnt'),
        ).filter(and_(
            FactConvAppmarket.广告计划ID.in_(plan_ids),
            FactConvAppmarket.资金账号创建完成时间 >= sd,
            FactConvAppmarket.资金账号创建完成时间 <= ed,
        )).group_by(FactConvAppmarket.广告计划ID).all()
        for r in oc_rows:
            open_map[int(r.广告计划ID)] = int(r.open_cnt or 0)

    # 各计划下载激活（下载日期口径；量 = 去重设备号，与计划漏斗激活量口径一致）
    act_map = {}
    if plan_ids:
        act_rows = db.session.query(
            FactConvAppmarket.广告计划ID,
            func.count(distinct(FactConvAppmarket.设备号)).label('act_cnt'),
        ).filter(and_(
            FactConvAppmarket.广告计划ID.in_(plan_ids),
            FactConvAppmarket.是否激活APP == 1,
            FactConvAppmarket.下载日期 >= sd,
            FactConvAppmarket.下载日期 <= ed,
        )).group_by(FactConvAppmarket.广告计划ID).all()
        for r in act_rows:
            act_map[int(r.广告计划ID)] = int(r.act_cnt or 0)

    # 各计划客户资产（广告开户口径行 SUM(总资产)：与 open_map 同一批复合条件行）
    asset_map = {}
    if plan_ids:
        asset_rows = db.session.query(
            FactConvAppmarket.广告计划ID,
            func.coalesce(func.sum(FactConvAppmarket.总资产), 0).label('assets'),
        ).filter(and_(
            FactConvAppmarket.广告计划ID.in_(plan_ids),
            _AD_ACCOUNT_COND,
            FactConvAppmarket.资金账号创建完成时间 >= sd,
            FactConvAppmarket.资金账号创建完成时间 <= ed,
        )).group_by(FactConvAppmarket.广告计划ID).all()
        for r in asset_rows:
            asset_map[int(r.广告计划ID)] = float(r.assets or 0)

    # 组装 平台 -> 计划 列表
    plans = []
    for pid, info in plan_by_id.items():
        pc = plan_class.get(pid, {})
        spend = info['spend']
        oc = open_map.get(pid, 0)
        act = act_map.get(pid, 0)
        asset = asset_map.get(pid, 0.0)
        plans.append({
            'plan_id': str(pid),
            'platform': info['platform'],
            'plan_name': info['plan_name'],
            'versions': sorted(pc.get('versions', [])) or ['未分类'],
            'sub_versions': sorted(pc.get('sub_versions', [])) or ['未分类'],
            'bids': sorted(pc.get('bids', [])) or ['未分类'],
            'spend': round(spend, 2),
            'impressions': info['impressions'],
            'clicks': info['clicks'],
            'open_count': oc,
            'open_cost': round(spend / oc, 2) if oc else None,
            'activated': act,
            'assets': round(asset, 2),
        })
    plans.sort(key=lambda x: (x['open_count'], x['spend']), reverse=True)

    # 平台级汇总
    by_platform = {}
    for p in plans:
        by_platform.setdefault(p['platform'], {'plans': [], 'spend': 0.0, 'open_count': 0, 'activated': 0, 'assets': 0.0})
        by_platform[p['platform']]['plans'].append(p)
        by_platform[p['platform']]['spend'] += p['spend']
        by_platform[p['platform']]['open_count'] += p['open_count']
        by_platform[p['platform']]['activated'] += p['activated']
        by_platform[p['platform']]['assets'] += p['assets']

    result = []
    for pf in APP_MARKET_PLATFORMS:
        if pf not in by_platform:
            continue
        agg = by_platform[pf]
        result.append({
            'platform': pf,
            'spend': round(agg['spend'], 2),
            'open_count': agg['open_count'],
            'open_cost': round(agg['spend'] / agg['open_count'], 2) if agg['open_count'] else None,
            'activated': agg['activated'],
            'assets': round(agg['assets'], 2),
            'top_plans': agg['plans'][:10],
        })
    result.sort(key=lambda x: (x['open_count'], x['spend']), reverse=True)
    return result


def _content_platform_detail(sd, ed):
    """内容平台非直播(小红书/腾讯/抖音/yj/云极/快手) -> 平台 -> 厂商 -> 计划。

    开户数/花费：厂商×日底表 agg_vendor_daily 权威口径，仅取非直播（业务模式 != '直播'）；
    直播渠道(业务模式='直播')单独在 _live_detail 处理，避免重复计数。
    线索数：fact_conv_content 排除直播线索（客户来源命中主播聚类口径，见 _is_live_lead_source），
    与 _live_detail 主播板块不重不漏。
    计划级仅附 fact_plan_daily 的 消耗/展示/点击（底表为厂商×日粒度，无计划维度）。
    """
    # 1) 厂商级 开户/花费（agg_vendor_daily 权威底表，内容平台非直播）
    agg_rows = db.session.query(
        AggVendorDaily.平台,
        AggVendorDaily.厂商,
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('open_count'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('spend'),
    ).filter(and_(
        AggVendorDaily.日期 >= sd,
        AggVendorDaily.日期 <= ed,
        AggVendorDaily.平台.in_(CONTENT_PLATFORMS),
        AggVendorDaily.业务模式.isnot(None),
        AggVendorDaily.业务模式 != '直播',
    )).group_by(AggVendorDaily.平台, AggVendorDaily.厂商).all()

    # 2) 计划级 消耗/展示/点击（fact_plan_daily，按 厂商名称 挂到对应厂商）
    plan_rows = db.session.query(
        FactPlanDaily.平台,
        FactPlanDaily.厂商名称,
        FactPlanDaily.计划ID,
        FactPlanDaily.计划名称,
        func.coalesce(func.sum(FactPlanDaily.花费), 0).label('spend'),
        func.coalesce(func.sum(FactPlanDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(FactPlanDaily.点击量), 0).label('clicks'),
    ).filter(and_(
        FactPlanDaily.日期 >= sd,
        FactPlanDaily.日期 <= ed,
        FactPlanDaily.平台.in_(CONTENT_PLATFORMS),
    )).group_by(
        FactPlanDaily.平台, FactPlanDaily.厂商名称,
        FactPlanDaily.计划ID, FactPlanDaily.计划名称,
    ).all()

    plans_by_factory = {}
    for r in plan_rows:
        np = _norm_platform(r.平台)
        key = (np, _norm_factory(np, r.厂商名称))
        plans_by_factory.setdefault(key, []).append({
            'plan_id': str(r.计划ID) if r.计划ID is not None else None,
            'plan_name': r.计划名称,
            'spend': round(float(r.spend or 0), 2),
            'impressions': int(r.impressions or 0),
            'clicks': int(r.clicks or 0),
            'open_count': 0,  # 无计划维度开户，统一走厂商级底表口径
        })

    # 内容平台线索量（fact_conv_content，1 行=1 企微）
    # v4.x 口径：排除直播线索（客户来源命中主播聚类口径），直播线索在 _live_detail 单独板块统计
    lead_counts = {}
    if CONTENT_PLATFORMS:
        plain_tokens = _load_live_plain_tokens()
        lc_rows = db.session.query(
            FactConvContent.平台来源,
            FactConvContent.客户来源,
            func.coalesce(func.count(FactConvContent.id), 0).label('leads'),
        ).filter(and_(
            FactConvContent.线索日期 >= sd,
            FactConvContent.线索日期 <= ed,
            FactConvContent.平台来源.in_(CONTENT_PLATFORMS),
        )).group_by(FactConvContent.平台来源, FactConvContent.客户来源).all()
        for r in lc_rows:
            if _is_live_lead_source(r.客户来源, plain_tokens):
                continue
            # yj 归并入云极后可能产生同名键，累加避免覆盖
            np = _norm_platform(r.平台来源)
            lead_counts[np] = lead_counts.get(np, 0) + int(r.leads or 0)

    by_platform = {}
    for r in agg_rows:
        pf = _norm_platform(r.平台) or '未分类'
        factory_name = _norm_factory(pf, r.厂商)
        platform = by_platform.setdefault(pf, {'platform': pf, 'factories': {}})
        # 多个上游厂商并入同名（如「未归因」）时需累加而非覆盖
        fac = platform['factories'].setdefault(
            factory_name, {'factory': factory_name, 'spend': 0.0, 'open_count': 0})
        fac['spend'] += float(r.spend or 0)
        fac['open_count'] += int(r.open_count or 0)

    for platform in by_platform.values():
        for fac in platform['factories'].values():
            plans = plans_by_factory.get((platform['platform'], fac['factory']), [])
            plans.sort(key=lambda x: x['spend'], reverse=True)
            fac['spend'] = round(fac['spend'], 2)
            fac['plans'] = plans[:10]

    result = []
    for pf in CONTENT_PLATFORMS_DISPLAY:
        if pf not in by_platform:
            continue
        platform = by_platform[pf]
        factories = list(platform['factories'].values())
        factories.sort(key=lambda x: (x['open_count'], x['spend']), reverse=True)
        result.append({
            'platform': pf,
            'lead_count': lead_counts.get(pf, 0),
            'open_count': sum(f['open_count'] for f in factories),
            'factories': factories,
        })
    return result


def _live_detail(sd, ed):
    """直播 -> 主播（复用主播聚类核心，复合来源均分，口径与 /anchor-clusters 一致）。

    取全部主播前 top 200（按线索量降序），含直播类型/线索/开口/开户/有效户/资产。
    v4.1.4：30 → 200，避免「开户多但线索量小」的主播被截断导致云图直播板块漏主播名。
    """
    items = _compute_anchor_cluster_items(sd, ed, [], [], [])
    # items 已按 (leads, new_opened) 降序，截取头部
    out = []
    for i in items[:200]:
        out.append({
            'anchor_name': i['anchor'],
            'live_type': i['live_type'],
            'leads': i['leads'],
            'new_leads': i['new_leads'],
            'mouth': i['mouth'],
            'opened': i['opened'],
            'new_opened': i['new_opened'],
            'valid': i['valid'],
            'new_valid': i['new_valid'],
            'assets': i['assets'],
            'new_assets': i['new_assets'],
        })
    return out


def _weekly_opens_by_channels(week_list, channels, category='互联网引流'):
    """按周次聚合各渠道开户数（agg_daily_channel_open 权威底表）。

    week_list 为 /data 构建的周次列表（[{week, sd, ed}]）；返回
    [{week, 渠道1: opens, 渠道2: opens, ...}]，用于各渠道分周开户堆叠图。
    category 传 None 时不限渠道类别（本地生活高德的渠道类别实为「互联网引流」，按名称过滤即可）。
    """
    result = []
    for w in week_list:
        conds = [
            AggDailyChannelOpen.渠道名称.in_(channels),
            AggDailyChannelOpen.时间区间 >= w['sd'],
            AggDailyChannelOpen.时间区间 <= w['ed'],
        ]
        if category:
            conds.insert(0, AggDailyChannelOpen.渠道类别 == category)
        rows = db.session.query(
            AggDailyChannelOpen.渠道名称,
            func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        ).filter(and_(*conds)).group_by(AggDailyChannelOpen.渠道名称).all()
        row = {'week': w['week']}
        for r in rows:
            # yj 归并入云极后可能产生同名键，累加避免覆盖
            key = _norm_platform(r.渠道名称)
            row[key] = row.get(key, 0) + int(r.opens or 0)
        result.append(row)
    return result


def _live_weekly(week_list):
    """按周次聚合主播开户数（复用主播聚类核心，复合来源均分）。

    逐周调用 _compute_anchor_cluster_items，周区间内开户数>0 的主播作为该周数据点，
    返回 [{week, 主播1: opens, 主播2: opens, ...}]，供直播分周开户堆叠图使用。
    """
    result = []
    for w in week_list:
        items = _compute_anchor_cluster_items(w['sd'], w['ed'], [], [], [])
        row = {'week': w['week']}
        for i in items:
            if i['new_opened'] > 0:
                row[i['anchor']] = int(i['new_opened'])
        result.append(row)
    return result


def _local_life_detail(sd, ed):
    """本地生活（高德）开户数据 — 独立板块。

    agg_daily_channel_open 中高德的渠道类别实为「互联网引流」，故按渠道名称（高德，
    即 CHANNEL_CATEGORY_MAP 归为本地生活的渠道）过滤，供云图「本地生活」独立板块使用。
    """
    rows = db.session.query(
        AggDailyChannelOpen.渠道名称,
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('open_count'),
    ).filter(and_(
        AggDailyChannelOpen.渠道名称.in_(LOCAL_LIFE_CHANNELS),
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.渠道名称).all()
    return [{'platform': r.渠道名称 or '高德', 'open_count': int(r.open_count or 0)} for r in rows]


@bp.route('/detail', methods=['POST'])
@handle_exceptions
def get_weekly_detail():
    """周报详细版 — 三维细分数据（本周 + 全年累计）。

    输入: { report_year, report_week } 或 { start_date, end_date }（与 /data 相同周次规则）。
    返回: app_market(平台->计划->版位) / content_platform(平台->厂商->计划) / live(主播)。
    """
    data = request.get_json() or {}
    week = _resolve_week_range(data)
    if week is None:
        report_year = data.get('report_year')
        report_week = data.get('report_week')
        return jsonify({'success': False, 'error': f'无效的周次: {report_year}年第{report_week}周'}), 400

    sd, ed, report_year, report_week, report_name, report_sequence = week
    year_start = f'{report_year}-01-01'

    # 构建周次列表（与 /data 一致），供各渠道分周开户堆叠图使用
    fridays = get_all_fridays_in_year(report_year)
    week_list = []
    for i, f in enumerate(fridays, 1):
        wi = get_week_info(f)
        wsd = wi['start_date']
        wed = wi['end_date']
        if wsd > ed:
            continue
        if wed > ed:
            wed = ed
        week_list.append({'week': f'W{i:02d}', 'sd': wsd, 'ed': wed})

    app_market_weekly = _weekly_opens_by_channels(week_list, APP_MARKET_PLATFORMS)
    content_weekly = _weekly_opens_by_channels(week_list, CONTENT_PLATFORMS)
    live_weekly = _live_weekly(week_list)
    local_life_weekly = _weekly_opens_by_channels(week_list, LOCAL_LIFE_CHANNELS, category=None)

    def _scoped(sd_i, ed_i):
        return {
            'app_market': _app_market_detail(sd_i, ed_i),
            'content_platform': _content_platform_detail(sd_i, ed_i),
            'live': _live_detail(sd_i, ed_i),
            'local_life': _local_life_detail(sd_i, ed_i),
            'app_market_weekly': app_market_weekly,
            'content_weekly': content_weekly,
            'live_weekly': live_weekly,
            'local_life_weekly': local_life_weekly,
        }

    return jsonify({
        'success': True,
        'data': {
            'period': {
                'start_date': sd,
                'end_date': ed,
                'report_year': report_year,
                'report_week': report_week,
                'report_name': report_name,
                'report_sequence': report_sequence,
            },
            'current_week': _scoped(sd, ed),
            'year_to_date': _scoped(year_start, ed),
        }
    })
