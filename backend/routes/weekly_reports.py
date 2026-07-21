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

from backend.database import db
from backend.models_v2 import AggVendorDaily, AggDailyChannelOpen, FactConvContent
from backend.utils.weekly_utils import get_week_info, generate_week_options, validate_week_period, get_all_fridays_in_year
from backend.utils.decorators import handle_exceptions
from sqlalchemy import func, and_

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
