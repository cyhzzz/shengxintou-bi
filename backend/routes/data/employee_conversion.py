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
    获取员工转化效果分析数据
    ---
    tags:
      - Employee Conversion
    description: |
      获取员工转化效果分析数据，包括：
      - 核心指标：总线索数、开口数、有效线索数、开户数、有效户数等
      - 平台维度概览
      - 转化趋势
      - 员工转化率走势
      - 员工排行榜
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            platforms:
              type: array
              items:
                type: string
                enum: ["小红书", "腾讯", "抖音"]
              description: 平台筛选
              example: ["小红书", "腾讯"]
            start_date:
              type: string
              format: date
              description: 开始日期 (YYYY-MM-DD)
              example: "2026-02-01"
            end_date:
              type: string
              format: date
              description: 结束日期 (YYYY-MM-DD)
              example: "2026-02-28"
            employees:
              type: array
              items:
                type: string
              description: 员工姓名列表（空=全部）
              example: ["张三", "李四"]
            lead_type:
              type: string
              enum: ["all", "existing", "new"]
              default: "all"
              description: 线索类型（all=全部, existing=存量, new=新增）
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: object
              properties:
                core_metrics:
                  type: object
                  properties:
                    total_leads:
                      type: integer
                      description: 总线索数
                    total_mouth:
                      type: integer
                      description: 开口数
                    total_valid_lead:
                      type: integer
                      description: 有效线索数
                    total_opened:
                      type: integer
                      description: 开户数
                    total_valid_customer:
                      type: integer
                      description: 有效户数
                    avg_opening_rate:
                      type: number
                      description: 平均开户率
                    total_assets:
                      type: number
                      description: 总资产
                platform_overview:
                  type: array
                  description: 平台维度概览
                conversion_trend:
                  type: array
                  description: 转化趋势
                employee_rate_trend:
                  type: array
                  description: 员工转化率走势
                ranking:
                  type: array
                  description: 员工排行榜
      400:
        description: 请求参数错误
      500:
        description: 服务器错误
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
    包含周期概览、排行榜和明星员工
    ---
    tags:
      - Employee Conversion
    description: 获取员工转化周报数据，包含周期概览、排行榜和明星员工
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            start_date:
              type: string
              format: date
              description: 周一日期 (YYYY-MM-DD)
              example: "2026-02-24"
            end_date:
              type: string
              format: date
              description: 周日日期 (YYYY-MM-DD)
              example: "2026-03-02"
            platforms:
              type: array
              items:
                type: string
                enum: ["小红书", "腾讯", "抖音"]
              description: 平台筛选
              example: ["小红书", "腾讯", "抖音"]
            top_count:
              type: integer
              default: 10
              description: 排行榜显示人数
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: object
              properties:
                period:
                  type: object
                  description: 周期信息
                overview:
                  type: object
                  description: 概览数据
                rankings:
                  type: object
                  description: 排行榜数据
                stars:
                  type: object
                  description: 明星员工数据
      400:
        description: 请求参数错误
      500:
        description: 服务器错误
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
    获取服务人员列表
    用于下拉筛选
    ---
    tags:
      - Employee Conversion
    description: 获取所有服务人员姓名列表，用于前端筛选器下拉选项
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: array
              items:
                type: string
              example: ["张三", "李四", "王五"]
      500:
        description: 服务器错误
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
    返回平台、服务人员列表和线索类型选项
    ---
    tags:
      - Employee Conversion
    description: |
      获取员工转化报表筛选器所需的所有选项数据，包括：
      - 平台列表
      - 服务人员列表
      - 线索类型选项
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: object
              properties:
                platforms:
                  type: array
                  items:
                    type: string
                  example: ["小红书", "腾讯", "抖音"]
                employees:
                  type: array
                  items:
                    type: string
                  example: ["张三", "李四"]
                lead_types:
                  type: array
                  items:
                    type: object
                    properties:
                      value:
                        type: string
                      label:
                        type: string
                  example:
                    - value: "all"
                      label: "全部线索"
                    - value: "existing"
                      label: "存量线索"
                    - value: "new"
                      label: "新增线索"
      500:
        description: 服务器错误
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