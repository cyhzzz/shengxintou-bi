# -*- coding: utf-8 -*-
"""员工转化接口（v2）"""
from flask import Blueprint, request, jsonify
import logging
from backend.routes.data.employee_conversion_helpers import (
    get_employee_conversion_ranking, get_weekly_trend_data,
    get_employee_rate_trend, get_weekly_report_data,
    get_employee_list, get_platform_overview, get_latest_data_week_range
)
from backend.utils.decorators import handle_exceptions

logger = logging.getLogger(__name__)
bp = Blueprint('employee_conversion', __name__)


@bp.route('/employee-conversion/analysis', methods=['POST'])
@handle_exceptions
def get_analysis_data():
    data = request.get_json() or {}
    platforms = data.get('platforms', ['小红书', '腾讯', '抖音'])
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    employees = data.get('employees', [])
    lead_type = data.get('lead_type', 'all')

    if (start_date and not end_date) or (not start_date and end_date):
        return jsonify({'success': False, 'error': 'INVALID_DATE_RANGE', 'message': '开始/结束日期必须同时传或同时为空'}), 400

    ranking = get_employee_conversion_ranking(platforms, start_date, end_date, lead_type, employees)
    overview = get_platform_overview(platforms, start_date, end_date)
    trend = get_weekly_trend_data(platforms, start_date, end_date)
    rate_trend = get_employee_rate_trend(platforms, start_date, end_date)

    total_leads = sum(r['total_leads'] for r in ranking)
    total_opened = sum(r['opened_count'] for r in ranking)
    total_valid = sum(r['valid_customer_count'] for r in ranking)
    total_mouth = sum(r['mouth_count'] for r in ranking)
    total_assets = sum(r['total_assets'] for r in ranking)

    core = {
        'total_leads': total_leads,
        'total_mouth': total_mouth,
        'total_valid_lead': sum(r['valid_lead_count'] for r in ranking),
        'total_opened': total_opened,
        'total_valid_customer': total_valid,
        'avg_opening_rate': round(total_opened * 100.0 / total_leads, 2) if total_leads > 0 else 0,
        'total_assets': round(total_assets, 2),
    }

    return jsonify({
        'success': True,
        'data': {
            'core_metrics': core,
            'platform_overview': [{'platform': p, **v} for p, v in overview.items()],
            'conversion_trend': {'weeks': trend},
            'employee_rate_trend': {'periods': rate_trend},
            'ranking': ranking,
        }
    })


@bp.route('/employee-conversion/weekly', methods=['POST'])
@handle_exceptions
def get_weekly_data():
    data = request.get_json() or {}
    platforms = data.get('platforms', ['小红书', '腾讯', '抖音'])
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    # v3.1：接受前端 top_count（默认 10），不再硬编码 [:10]
    try:
        top_count = max(1, min(50, int(data.get('top_count') or 10)))
    except (TypeError, ValueError):
        top_count = 10
    return jsonify({
        'success': True,
        'data': {
            'top_count': top_count,
            'rankings': {p: {
                'total': get_employee_conversion_ranking([p], start_date, end_date, 'all')[:top_count],
                'existing': get_employee_conversion_ranking([p], start_date, end_date, 'existing')[:top_count],
                'new': get_employee_conversion_ranking([p], start_date, end_date, 'new')[:top_count],
            } for p in platforms},
            'overview': get_platform_overview(platforms, start_date, end_date),
            'trend': get_weekly_trend_data(platforms, start_date, end_date),
        }
    })


@bp.route('/employee-conversion/employees', methods=['GET'])
@handle_exceptions
def get_employees():
    return jsonify({'success': True, 'data': get_employee_list()})


@bp.route('/employee-conversion/filter-options', methods=['GET'])
@handle_exceptions
def get_filter_options():
    default_range = get_latest_data_week_range()
    return jsonify({
        'success': True,
        'data': {
            'platforms': ['小红书', '腾讯', '抖音'],
            'employees': get_employee_list(),
            'lead_types': [
                {'value': 'all', 'label': '全部线索'},
                {'value': 'existing', 'label': '存量线索'},
                {'value': 'new', 'label': '新增线索'},
            ],
            **default_range,
        }
    })


@bp.route('/employee-conversion/analysis-channel-overview', methods=['POST'])
@handle_exceptions
def get_employee_analysis_channel_overview():
    """v3.1: 员工转化 Analysis 顶部核心指标同时接入 agg_daily_channel_open

    按用户口径（v3.1 §四）：员工口径走 fact_conv_content（明细/员工维度）；
    渠道口径走 agg_daily_channel_open（独立数据源）。
    前端在核心指标旁展示两个口径并列，避免错位。
    """
    from backend.models_v2 import AggDailyChannelOpen, FactConvContent
    from backend.database import db
    from sqlalchemy import func, and_, or_
    data = request.get_json() or {}
    sd = data.get('start_date')
    ed = data.get('end_date')
    employees = data.get('employees') or []
    lead_type = data.get('lead_type', 'all')
    # v3.1 §四：analysis-channel-overview 接受 platforms，仅作用于 detail_caliber（渠道口径 agg_daily_channel_open 不存在"平台"字段，保留全量）
    platforms_param = data.get('platforms') or []
    if isinstance(platforms_param, str):
        platforms_param = [s for s in platforms_param.split(',') if s.strip()]

    # 员工明细口径（fact_conv_content）
    detail_q = db.session.query(
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
        func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
    ).filter(and_(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != ''))
    if sd and ed:
        detail_q = detail_q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if employees:
        detail_q = detail_q.filter(FactConvContent.添加员工姓名.in_([str(e) for e in employees]))
    if platforms_param:
        detail_q = detail_q.filter(FactConvContent.平台来源.in_([str(p) for p in platforms_param]))
    if lead_type == 'existing':
        detail_q = detail_q.filter(FactConvContent.是否为存量客户 == 1)
    elif lead_type == 'new':
        detail_q = detail_q.filter(or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)))
    dr = detail_q.first()

    # 渠道口径（agg_daily_channel_open，全量）
    chan_q = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposit'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    )
    if sd and ed:
        chan_q = chan_q.filter(and_(AggDailyChannelOpen.时间区间 >= sd, AggDailyChannelOpen.时间区间 <= ed))
    cr = chan_q.first()

    return jsonify({
        'success': True,
        'data': {
            'detail_caliber': {
                'source': 'fact_conv_content',
                'scope': '员工级（添加员工姓名 非空）',
                'leads': int(dr.leads or 0),
                'mouth': int(dr.mouth or 0),
                'valid_lead': int(dr.valid_lead or 0),
                'opened': int(dr.opened or 0),
                'valid': int(dr.valid or 0),
                'assets': round(float(dr.assets or 0), 2),
            },
            'channel_caliber': {
                'source': 'agg_daily_channel_open',
                'scope': '渠道级（4 大类全量，含合作/员工/自然/互联网引流）',
                'opens': int(cr.opens or 0),
                'deposit': int(cr.deposit or 0),
                'valid': int(cr.valid or 0),
            },
            'note': '两个口径数字不一致是正常的（按用户口径"独立数据源"），仅作参考并列展示。',
        },
    })



