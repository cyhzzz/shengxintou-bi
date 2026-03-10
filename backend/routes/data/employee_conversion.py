# -*- coding: utf-8 -*-
"""
员工转化数据API路由

提供三个接口：
1. POST /api/v1/employee-conversion/analysis - 转化效果分析数据
2. POST /api/v1/employee-conversion/weekly - 转化周报数据
3. GET /api/v1/employee-conversion/employees - 服务人员列表
"""

from flask import Blueprint, request, jsonify
import logging
from backend.routes.data.employee_conversion_helpers import (
    get_employee_conversion_ranking,
    get_weekly_trend_data,
    get_employee_rate_trend,
    get_weekly_report_data,
    get_employee_list,
    get_platform_overview
)

logger = logging.getLogger(__name__)

# 创建Blueprint
bp = Blueprint('employee_conversion', __name__)


@bp.route('/employee-conversion/analysis', methods=['POST'])
def get_analysis_data():
    """
    获取转化效果分析数据

    Request:
        {
            "platforms": ["小红书", "腾讯"],
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
            "employees": ["张三", "李四"],  // 可选，空=全部
            "lead_type": "all"             // all/existing/new
        }

    Response:
        {
            "success": true,
            "data": {
                "core_metrics": {...},
                "platform_overview": {...},
                "conversion_trend": {...},
                "employee_rate_trend": {...},
                "ranking": [...]
            }
        }
    """
    try:
        data = request.get_json() or {}

        # 参数提取
        platforms = data.get('platforms', ['小红书', '腾讯', '抖音'])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        employees = data.get('employees', [])  # 空列表表示全部
        lead_type = data.get('lead_type', 'all')

        # 参数验证
        if not start_date or not end_date:
            return jsonify({
                'success': False,
                'error': 'MISSING_DATE',
                'message': '缺少日期参数'
            }), 400

        # 获取排行榜数据
        ranking = get_employee_conversion_ranking(
            platforms, start_date, end_date, lead_type,
            employees if employees else None
        )

        # 计算核心指标
        total_leads = sum(item['total_leads'] for item in ranking)
        total_opened = sum(item['opened_count'] for item in ranking)
        total_mouth = sum(item['mouth_count'] for item in ranking)
        total_valid_lead = sum(item['valid_lead_count'] for item in ranking)
        total_valid_customer = sum(item['valid_customer_count'] for item in ranking)
        total_assets = sum(item['total_assets'] for item in ranking)
        avg_opening_rate = round(total_opened * 100.0 / total_leads, 2) if total_leads > 0 else 0

        # 获取平台维度概览
        platform_overview = get_platform_overview(platforms, start_date, end_date)

        # 获取周度趋势
        conversion_trend = get_weekly_trend_data(
            platforms, start_date, end_date,
            employees if employees else None
        )

        # 获取员工转化率走势
        employee_rate_trend = get_employee_rate_trend(
            platforms, start_date, end_date,
            employees if employees else None
        )

        return jsonify({
            'success': True,
            'data': {
                'core_metrics': {
                    'total_leads': total_leads,
                    'total_mouth': total_mouth,
                    'total_valid_lead': total_valid_lead,
                    'total_opened': total_opened,
                    'total_valid_customer': total_valid_customer,
                    'avg_opening_rate': avg_opening_rate,
                    'total_assets': total_assets
                },
                'platform_overview': platform_overview,
                'conversion_trend': conversion_trend,
                'employee_rate_trend': employee_rate_trend,
                'ranking': ranking
            }
        })

    except Exception as e:
        import traceback
        logger.error(f"获取转化效果分析数据失败: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'QUERY_ERROR',
            'message': f'查询失败: {str(e)}'
        }), 500


@bp.route('/employee-conversion/weekly', methods=['POST'])
def get_weekly_data():
    """
    获取转化周报数据

    Request:
        {
            "start_date": "2026-02-24",  // 周一日期
            "end_date": "2026-03-02",    // 周日日期
            "platforms": ["小红书", "腾讯", "抖音"],
            "top_count": 10
        }

    Response:
        {
            "success": true,
            "data": {
                "period": {...},
                "overview": {...},
                "rankings": {...},
                "stars": {...}
            }
        }
    """
    try:
        data = request.get_json() or {}

        start_date = data.get('start_date')
        end_date = data.get('end_date')
        platforms = data.get('platforms', ['小红书', '腾讯', '抖音'])
        top_count = data.get('top_count', 10)

        if not start_date or not end_date:
            return jsonify({
                'success': False,
                'error': 'MISSING_DATE',
                'message': '缺少日期参数'
            }), 400

        result = get_weekly_report_data(start_date, end_date, platforms, top_count)

        return jsonify({
            'success': True,
            'data': result
        })

    except Exception as e:
        import traceback
        logger.error(f"获取转化周报数据失败: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'QUERY_ERROR',
            'message': f'查询失败: {str(e)}'
        }), 500


@bp.route('/employee-conversion/employees', methods=['GET'])
def get_employees():
    """
    获取服务人员列表（用于下拉筛选）

    Response:
        {
            "success": true,
            "data": ["张三", "李四", ...]
        }
    """
    try:
        employees = get_employee_list()

        return jsonify({
            'success': True,
            'data': employees
        })

    except Exception as e:
        import traceback
        logger.error(f"获取服务人员列表失败: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'QUERY_ERROR',
            'message': f'查询失败: {str(e)}'
        }), 500


@bp.route('/employee-conversion/filter-options', methods=['GET'])
def get_filter_options():
    """
    获取筛选器选项

    Response:
        {
            "success": true,
            "data": {
                "platforms": [...],
                "employees": [...],
                "lead_types": [...]
            }
        }
    """
    try:
        from backend.database import db
        from backend.models import BackendConversions

        # 获取所有平台来源
        platforms_query = db.session.query(
            BackendConversions.platform_source
        ).distinct().filter(
            BackendConversions.platform_source.isnot(None)
        ).all()

        # 构建平台选项（去重并规范化）
        platform_set = set()
        for p in platforms_query:
            source = p[0]
            if source in ['腾讯', 'yj', '高德']:
                platform_set.add('腾讯')
            elif source in ['抖音', 'douyin']:
                platform_set.add('抖音')
            elif source in ['小红书', 'xiaohongshu']:
                platform_set.add('小红书')
            else:
                platform_set.add(source)

        platforms = sorted(list(platform_set))

        # 获取服务人员列表
        employees = get_employee_list()

        # 线索类型选项
        lead_types = [
            {'value': 'all', 'label': '全部线索'},
            {'value': 'existing', 'label': '存量线索'},
            {'value': 'new', 'label': '新增线索'}
        ]

        return jsonify({
            'success': True,
            'data': {
                'platforms': platforms,
                'employees': employees,
                'lead_types': lead_types
            }
        })

    except Exception as e:
        import traceback
        logger.error(f"获取筛选器选项失败: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'QUERY_ERROR',
            'message': f'查询失败: {str(e)}'
        }), 500