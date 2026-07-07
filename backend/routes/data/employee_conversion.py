# -*- coding: utf-8 -*-
"""员工转化接口（v2）"""
from flask import Blueprint, request, jsonify
import logging
from backend.routes.data.employee_conversion_helpers import (
    get_employee_conversion_ranking, get_weekly_trend_data,
    get_employee_rate_trend, get_weekly_report_data,
    get_employee_list, get_platform_overview
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
            'conversion_trend': trend,
            'employee_rate_trend': rate_trend,
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
    return jsonify({
        'success': True,
        'data': {
            'rankings': {p: {
                'total': get_employee_conversion_ranking([p], start_date, end_date, 'all')[:10],
                'existing': get_employee_conversion_ranking([p], start_date, end_date, 'existing')[:10],
                'new': get_employee_conversion_ranking([p], start_date, end_date, 'new')[:10],
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
    return jsonify({
        'success': True,
        'data': {
            'platforms': ['小红书', '腾讯', '抖音'],
            'employees': get_employee_list(),
            'lead_types': [
                {'value': 'all', 'label': '全部线索'},
                {'value': 'existing', 'label': '存量线索'},
                {'value': 'new', 'label': '新增线索'},
            ]
        }
    })
