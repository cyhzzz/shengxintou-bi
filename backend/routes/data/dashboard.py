# -*- coding: utf-8 -*-
"""
仪表盘数据接口 - 账号列表、核心指标、趋势数据
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, Integer, case, literal
from backend.models import (
    DailyMetricsUnified,
    AccountAgencyMapping,
    AgencyAbbreviationMapping,
    DailyNotesMetricsUnified,
    XhsNoteInfo
)
from backend.database import db
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('dashboard', __name__)


# ============================================================================
# Swagger 文档定义
# ============================================================================

# Dashboard Core Metrics API 文档
DASHBOARD_CORE_METRICS_DOC = """
获取数据概览核心指标
---
tags:
  - Dashboard
description: |
  获取数据概览页面的核心指标数据，包括：
  - 投入效果：总花费、总曝光、总点击
  - 业务成果：总线索、新开客户、新有效户
  - 客户资产：新客户资产、存量客户资产
  - 效率指标：线索成本、有效户成本

  支持环比数据计算（需提供日期范围）。
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
          description: 开始日期 (YYYY-MM-DD)
          example: "2025-01-01"
        end_date:
          type: string
          format: date
          description: 结束日期 (YYYY-MM-DD)
          example: "2025-01-31"
        platforms:
          type: array
          items:
            type: string
            enum: ["腾讯", "抖音", "小红书"]
          description: 平台筛选
          example: ["腾讯", "抖音"]
        agencies:
          type: array
          items:
            type: string
          description: 代理商筛选
        business_models:
          type: array
          items:
            type: string
            enum: ["直播", "信息流", "搜索"]
          description: 业务模式筛选
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
                new_customers:
                  type: integer
                  description: 新开客户数
                investment:
                  type: number
                  description: 总投入（元）
                new_valid_accounts:
                  type: integer
                  description: 新有效户数
                total_leads:
                  type: integer
                  description: 总线索数
                total_impressions:
                  type: integer
                  description: 总曝光数
                total_clicks:
                  type: integer
                  description: 总点击数
                customer_assets:
                  type: number
                  description: 新客户资产
                customer_contribution:
                  type: number
                  description: 客户贡献
                existing_customers_assets:
                  type: number
                  description: 存量客户资产
                cost_per_valid_account:
                  type: number
                  description: 有效户成本
                cost_per_lead:
                  type: number
                  description: 线索成本
            wow_changes:
              type: object
              description: 环比变化数据
              properties:
                investment:
                  type: object
                  properties:
                    value:
                      type: number
                    trend:
                      type: string
                      enum: ["up", "down"]
                    color:
                      type: string
                      enum: ["green", "red"]
  400:
    description: 请求参数错误
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
  500:
    description: 服务器错误
"""

DASHBOARD_TREND_DATA_DOC = """
获取趋势数据
---
tags:
  - Dashboard
description: |
  获取指定指标的趋势数据，用于绘制趋势图。

  支持的指标类型：
  - cost_per_lead: 线索成本趋势
  - cost_per_customer: 开户成本趋势
  - cost_per_valid_account: 有效户成本趋势
parameters:
  - name: body
    in: body
    required: true
    schema:
      type: object
      required:
        - start_date
        - end_date
      properties:
        start_date:
          type: string
          format: date
          description: 开始日期 (YYYY-MM-DD)
          example: "2025-01-01"
        end_date:
          type: string
          format: date
          description: 结束日期 (YYYY-MM-DD)
          example: "2025-01-31"
        platforms:
          type: array
          items:
            type: string
          description: 平台筛选
        agencies:
          type: array
          items:
            type: string
          description: 代理商筛选
        business_models:
          type: array
          items:
            type: string
          description: 业务模式筛选
        metric_type:
          type: string
          enum: ["cost_per_lead", "cost_per_customer", "cost_per_valid_account"]
          default: "cost_per_lead"
          description: 指标类型
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
            trend_data:
              type: array
              items:
                type: object
                properties:
                  date:
                    type: string
                    format: date
                  value:
                    type: number
            summary:
              type: object
              properties:
                cost_per_lead:
                  type: number
                cost_per_customer:
                  type: number
                cost_per_valid_account:
                  type: number
  400:
    description: 请求参数错误
  500:
    description: 服务器错误
"""

@bp.route('/dashboard/accounts', methods=['POST'])
def get_dashboard_accounts():
    """
    获取数据概览账号列表
    ---
    tags:
      - Dashboard
    description: 获取数据概览报表的账号列表，支持按平台和代理商筛选
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            filters:
              type: object
              properties:
                platforms:
                  type: array
                  items:
                    type: string
                    enum: ["腾讯", "抖音", "小红书"]
                  description: 平台筛选
                  example: ["腾讯", "抖音"]
                agencies:
                  type: array
                  items:
                    type: string
                  description: 代理商筛选
                  example: ["量子", "众联"]
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
                ad_accounts:
                  type: array
                  items:
                    type: object
                    properties:
                      platform:
                        type: string
                      account_id:
                        type: string
                      account_name:
                        type: string
                      agency:
                        type: string
                      business_model:
                        type: string
                total:
                  type: integer
      500:
        description: 服务器错误
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 构建查询
        query = db.session.query(
            AccountAgencyMapping.platform,
            AccountAgencyMapping.account_id,
            AccountAgencyMapping.account_name,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.business_model
        )

        # 应用筛选条件
        if 'platforms' in filters and filters['platforms']:
            query = query.filter(AccountAgencyMapping.platform.in_(filters['platforms']))

        if 'agencies' in filters and filters['agencies']:
            query = query.filter(AccountAgencyMapping.agency.in_(filters['agencies']))

        # 排序
        query = query.order_by(
            AccountAgencyMapping.platform,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.account_id
        )

        results = query.all()

        # 转换结果
        ad_accounts = []
        for row in results:
            ad_accounts.append({
                'platform': row.platform,
                'account_id': row.account_id,
                'account_name': row.account_name or f'账号{row.account_id}',
                'agency': row.agency,
                'business_model': row.business_model
            })

        return jsonify({
            'success': True,
            'data': {
                'ad_accounts': ad_accounts,
                'total': len(ad_accounts)
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询账号列表失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/dashboard/core-metrics', methods=['POST'])
def get_dashboard_core_metrics():
    """
    获取数据概览核心指标
    ---
    tags:
      - Dashboard
    description: 获取数据概览页面的核心指标数据，包括投入效果、业务成果、客户资产、效率指标等
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
              description: 开始日期
              example: "2025-01-01"
            end_date:
              type: string
              format: date
              description: 结束日期
              example: "2025-01-31"
            platforms:
              type: array
              items:
                type: string
              description: 平台筛选
            agencies:
              type: array
              items:
                type: string
              description: 代理商筛选
            business_models:
              type: array
              items:
                type: string
              description: 业务模式筛选
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
            data:
              type: object
              properties:
                core_metrics:
                  $ref: '#/definitions/CoreMetrics'
                wow_changes:
                  type: object
      400:
        description: 请求参数错误
      500:
        description: 服务器错误
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求体不能为空'}), 400

        platforms = data.get('platforms', [])
        agencies = data.get('agencies', [])
        business_models = data.get('business_models', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        # 日期可以为空，空表示查询所有数据（"全部"模式）
        # 构建查询 - 从 daily_metrics_unified 获取所有指标（包括资产）
        # 注意：字段名是 opened_account_assets，不是 customer_assets
        # customer_contribution 不在此表中，需要单独查询
        query = db.session.query(
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.clicks).label('total_clicks'),
            func.sum(DailyMetricsUnified.lead_users).label('total_leads'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid'),
            func.sum(DailyMetricsUnified.opened_account_assets).label('customer_assets'),
            func.sum(DailyMetricsUnified.existing_customer_assets).label('existing_customer_assets'),
            func.sum(DailyMetricsUnified.opened_account_contribution).label('customer_contribution')
        )

        # 只有当日期范围存在时才添加日期筛选
        if start_date and end_date:
            query = query.filter(
                and_(
                    DailyMetricsUnified.date >= start_date,
                    DailyMetricsUnified.date <= end_date
                )
            )

        # 应用筛选条件
        if platforms:
            query = query.filter(DailyMetricsUnified.platform.in_(platforms))
        if agencies:
            query = query.filter(DailyMetricsUnified.agency.in_(agencies))
        if business_models:
            query = query.filter(DailyMetricsUnified.business_model.in_(business_models))

        result = query.first()

        # 提取数据（从 daily_metrics_unified 聚合结果）
        total_cost = float(result.total_cost) if result.total_cost else 0
        total_impressions = int(result.total_impressions) if result.total_impressions else 0
        total_clicks = int(result.total_clicks) if result.total_clicks else 0
        total_leads = int(result.total_leads) if result.total_leads else 0
        total_opened = int(result.total_opened) if result.total_opened else 0
        total_valid = int(result.total_valid) if result.total_valid else 0
        customer_assets = float(result.customer_assets) if result.customer_assets else 0
        existing_customer_assets = float(result.existing_customer_assets) if result.existing_customer_assets else 0
        customer_contribution = float(result.customer_contribution) if result.customer_contribution else 0

        # 计算衍生指标
        cost_per_lead = (total_cost / total_leads) if total_leads > 0 else 0
        cost_per_valid_account = (total_cost / total_valid) if total_valid > 0 else 0
        cost_per_customer = (total_cost / total_opened) if total_opened > 0 else 0

        core_metrics = {
            'new_customers': total_opened,
            'investment': total_cost,
            'new_valid_accounts': total_valid,
            'total_leads': total_leads,
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'customer_assets': customer_assets,
            'customer_contribution': customer_contribution,
            'existing_customers_assets': existing_customer_assets,
            'cost_per_valid_account': round(cost_per_valid_account, 2),
            'cost_per_lead': round(cost_per_lead, 2)
        }

        # 计算环比数据（与上一周期对比）
        # 只有当有日期范围时才计算环比，"全部"模式不计算环比
        wow_changes = {}
        if start_date and end_date:
            days_diff = (datetime.strptime(end_date, '%Y-%m-%d').date() -
                         datetime.strptime(start_date, '%Y-%m-%d').date()).days + 1
            prev_start = (datetime.strptime(start_date, '%Y-%m-%d').date() -
                          timedelta(days=days_diff)).strftime('%Y-%m-%d')
            prev_end = (datetime.strptime(start_date, '%Y-%m-%d').date() -
                        timedelta(days=1)).strftime('%Y-%m-%d')

            # 查询上一周期数据（从 daily_metrics_unified 获取所有指标）
            prev_query = db.session.query(
                func.sum(DailyMetricsUnified.cost).label('total_cost'),
                func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
                func.sum(DailyMetricsUnified.lead_users).label('total_leads'),
                func.sum(DailyMetricsUnified.opened_account_users).label('total_opened'),
                func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid'),
                func.sum(DailyMetricsUnified.opened_account_assets).label('customer_assets'),
                func.sum(DailyMetricsUnified.existing_customer_assets).label('existing_customer_assets'),
                func.sum(DailyMetricsUnified.opened_account_contribution).label('customer_contribution')
            ).filter(
                and_(
                    DailyMetricsUnified.date >= prev_start,
                    DailyMetricsUnified.date <= prev_end
                )
            )

            # 应用相同的筛选条件
            if platforms:
                prev_query = prev_query.filter(DailyMetricsUnified.platform.in_(platforms))
            if agencies:
                prev_query = prev_query.filter(DailyMetricsUnified.agency.in_(agencies))
            if business_models:
                prev_query = prev_query.filter(DailyMetricsUnified.business_model.in_(business_models))

            prev_result = prev_query.first()

            prev_cost = float(prev_result.total_cost) if prev_result.total_cost else 0
            prev_impressions = int(prev_result.total_impressions) if prev_result.total_impressions else 0
            prev_leads = int(prev_result.total_leads) if prev_result.total_leads else 0
            prev_opened = int(prev_result.total_opened) if prev_result.total_opened else 0
            prev_valid = int(prev_result.total_valid) if prev_result.total_valid else 0
            prev_customer_assets = float(prev_result.customer_assets) if prev_result.customer_assets else 0
            prev_existing_customer_assets = float(prev_result.existing_customer_assets) if prev_result.existing_customer_assets else 0
            prev_customer_contribution = float(prev_result.customer_contribution) if prev_result.customer_contribution else 0

            # 计算环比
            def calc_wow(current, previous, is_cost_metric=False):
                if previous == 0:
                    return {'value': 0, 'trend': 'up', 'color': 'green'}

                percent = ((current - previous) / previous) * 100
                trend = 'up' if percent >= 0 else 'down'

                if is_cost_metric:
                    color = 'red' if percent >= 0 else 'green'
                else:
                    color = 'green' if percent >= 0 else 'red'

                return {'value': round(abs(percent), 2), 'trend': trend, 'color': color}

            wow_changes = {
                'new_customers': calc_wow(total_opened, prev_opened, is_cost_metric=False),
                'investment': calc_wow(total_cost, prev_cost, is_cost_metric=True),
                'new_valid_accounts': calc_wow(total_valid, prev_valid, is_cost_metric=False),
                'total_leads': calc_wow(total_leads, prev_leads, is_cost_metric=False),
                'total_impressions': calc_wow(total_impressions, prev_impressions, is_cost_metric=False),
                'total_clicks': calc_wow(total_clicks, 0, is_cost_metric=True),
                'customer_assets': calc_wow(customer_assets, prev_customer_assets, is_cost_metric=False),
                'customer_contribution': calc_wow(customer_contribution, prev_customer_contribution, is_cost_metric=False),
                'existing_customers_assets': calc_wow(existing_customer_assets, prev_existing_customer_assets, is_cost_metric=False),
                'cost_per_valid_account': calc_wow(cost_per_valid_account,
                                                    (prev_cost / prev_valid) if prev_valid > 0 else 0,
                                                    is_cost_metric=True),
                'cost_per_lead': calc_wow(cost_per_lead,
                                           (prev_cost / prev_leads) if prev_leads > 0 else 0,
                                           is_cost_metric=True)
            }
        else:
            # "全部"模式：不计算环比，返回默认值
            wow_changes = {
                'new_customers': {'value': 0, 'trend': 'up', 'color': 'green'},
                'investment': {'value': 0, 'trend': 'up', 'color': 'green'},
                'new_valid_accounts': {'value': 0, 'trend': 'up', 'color': 'green'},
                'total_leads': {'value': 0, 'trend': 'up', 'color': 'green'},
                'total_impressions': {'value': 0, 'trend': 'up', 'color': 'green'},
                'total_clicks': {'value': 0, 'trend': 'up', 'color': 'green'},
                'customer_assets': {'value': 0, 'trend': 'up', 'color': 'green'},
                'customer_contribution': {'value': 0, 'trend': 'up', 'color': 'green'},
                'existing_customers_assets': {'value': 0, 'trend': 'up', 'color': 'green'},
                'cost_per_valid_account': {'value': 0, 'trend': 'up', 'color': 'green'},
                'cost_per_lead': {'value': 0, 'trend': 'up', 'color': 'green'}
            }

        return jsonify({
            'success': True,
            'data': {
                'core_metrics': core_metrics,
                'wow_changes': wow_changes
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/dashboard/trend-data', methods=['POST'])
def get_dashboard_trend_data():
    """
    获取趋势数据
    ---
    tags:
      - Dashboard
    description: 获取指定指标的趋势数据，支持线索成本、开户成本、有效户成本等指标
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - start_date
            - end_date
          properties:
            start_date:
              type: string
              format: date
              description: 开始日期
              example: "2025-01-01"
            end_date:
              type: string
              format: date
              description: 结束日期
              example: "2025-01-31"
            platforms:
              type: array
              items:
                type: string
              description: 平台筛选
            agencies:
              type: array
              items:
                type: string
              description: 代理商筛选
            business_models:
              type: array
              items:
                type: string
              description: 业务模式筛选
            metric_type:
              type: string
              enum: ["cost_per_lead", "cost_per_customer", "cost_per_valid_account"]
              default: "cost_per_lead"
              description: 指标类型
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
            data:
              type: object
              properties:
                trend_data:
                  type: array
                  items:
                    type: object
                    properties:
                      date:
                        type: string
                        format: date
                      value:
                        type: number
                summary:
                  type: object
                  properties:
                    cost_per_lead:
                      type: number
                    cost_per_customer:
                      type: number
                    cost_per_valid_account:
                      type: number
      400:
        description: 请求参数错误
      500:
        description: 服务器错误
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求体不能为空'}), 400

        platforms = data.get('platforms', [])
        agencies = data.get('agencies', [])
        business_models = data.get('business_models', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        metric_type = data.get('metric_type', 'cost_per_lead')

        if not start_date or not end_date:
            return jsonify({'success': False, 'error': '日期范围不能为空'}), 400

        # 构建查询 - 按日期聚合
        query = db.session.query(
            DailyMetricsUnified.date,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.lead_users).label('total_leads'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid')
        ).filter(
            and_(
                DailyMetricsUnified.date >= start_date,
                DailyMetricsUnified.date <= end_date
            )
        )

        # 应用筛选条件
        if platforms:
            query = query.filter(DailyMetricsUnified.platform.in_(platforms))
        if agencies:
            query = query.filter(DailyMetricsUnified.agency.in_(agencies))
        if business_models:
            query = query.filter(DailyMetricsUnified.business_model.in_(business_models))

        # 分组
        query = query.group_by(DailyMetricsUnified.date).order_by(DailyMetricsUnified.date)

        results = query.all()

        # 构建趋势数据
        trend_data = []
        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_leads) if row.total_leads else 0
            opened = int(row.total_opened) if row.total_opened else 0
            valid = int(row.total_valid) if row.total_valid else 0

            # 根据指标类型计算值
            if metric_type == 'cost_per_lead':
                value = (cost / leads) if leads > 0 else 0
            elif metric_type == 'cost_per_customer':
                value = (cost / opened) if opened > 0 else 0
            elif metric_type == 'cost_per_valid_account':
                value = (cost / valid) if valid > 0 else 0
            else:
                value = 0

            trend_data.append({
                'date': row.date.strftime('%Y-%m-%d'),
                'value': round(value, 2)
            })

        # 计算汇总数据
        total_cost = 0
        total_leads_all = 0
        total_opened_all = 0
        total_valid_all = 0

        for r in results:
            cost = float(r.total_cost) if r.total_cost else 0
            leads = int(r.total_leads) if r.total_leads else 0
            opened = int(r.total_opened) if r.total_opened else 0
            valid = int(r.total_valid) if r.total_valid else 0
            total_cost += cost
            total_leads_all += leads
            total_opened_all += opened
            total_valid_all += valid

        summary = {
            'cost_per_lead': round((total_cost / total_leads_all) if total_leads_all > 0 else 0, 2),
            'cost_per_customer': round((total_cost / total_opened_all) if total_opened_all > 0 else 0, 2),
            'cost_per_valid_account': round((total_cost / total_valid_all) if total_valid_all > 0 else 0, 2)
        }

        return jsonify({
            'success': True,
            'data': {
                'trend_data': trend_data,
                'summary': summary
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


