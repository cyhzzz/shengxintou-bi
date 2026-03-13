# -*- coding: utf-8 -*-
"""
趋势数据接口 - 日级/周级/月级趋势分析
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, Integer, case
from backend.models import (
    DailyMetricsUnified,
    AccountAgencyMapping,
    AgencyAbbreviationMapping,
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    BackendConversions
)
from backend.database import db
from backend.utils.decorators import handle_exceptions
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('trend', __name__)

@bp.route('/trend', methods=['POST'])
@handle_exceptions
def get_trend():
    """
    获取趋势数据
    支持日级、周级、月级聚合
    ---
    tags:
      - Trend
    description: |
      获取趋势数据，支持日级、周级、月级聚合。

      **支持的粒度**：
      - daily: 按日期分组，返回格式 YYYY-MM-DD
      - weekly: 按ISO周分组，返回格式 YYYY-WWW (如 2025-W01)
      - monthly: 按年月分组，返回格式 YYYY-MM

      **支持的指标**：
      - cost: 花费
      - impressions: 曝光量
      - clicks: 点击量
      - leads / lead_users: 线索人数
      - new_accounts / opened_account_users: 开户人数
      - valid_customer_users: 有效户人数

      **返回格式**：
      - dates: 周期标签数组
      - series: 指标数据数组，每个指标一个对象
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
                date_range:
                  type: array
                  items:
                    type: string
                    format: date
                  description: 日期范围 [开始日期, 结束日期]
                  example: ["2025-01-01", "2025-01-31"]
                platforms:
                  type: array
                  items:
                    type: string
                    enum: ["腾讯", "抖音", "小红书"]
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
                    enum: ["直播", "信息流", "搜索"]
                  description: 业务模式筛选
            metrics:
              type: array
              items:
                type: string
                enum: ["cost", "impressions", "clicks", "leads", "lead_users", "new_accounts", "opened_account_users", "valid_customer_users"]
              description: 要查询的指标列表
              default: ["cost", "leads"]
              example: ["cost", "impressions", "clicks", "leads"]
            granularity:
              type: string
              enum: ["daily", "weekly", "monthly"]
              description: 聚合粒度
              default: "daily"
              example: "daily"
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
                dates:
                  type: array
                  items:
                    type: string
                  example: ["2025-01-01", "2025-01-02", "2025-01-03"]
                series:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                        example: "cost"
                      data:
                        type: array
                        items:
                          type: number
                        example: [1000.00, 1200.00, 1500.00]
      500:
        description: 服务器错误
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})
    metrics = data.get('metrics', ['cost', 'leads'])
    granularity = data.get('granularity', 'daily')  # daily, weekly, monthly

    try:
        # 根据请求的指标添加聚合列
        select_columns = []
        group_by_columns = []

        # 根据粒度选择分组列
        if granularity == 'daily':
            # 日级：按日期分组
            select_columns.append(DailyMetricsUnified.date.label('period'))
            group_by_columns.append(DailyMetricsUnified.date)
        elif granularity == 'weekly':
            # 周级：按ISO周分组 (年份+周数)，使用SQLite兼容的字符串拼接
            # 使用op方法确保生成SQLite的||操作符而非concat函数
            week_expr = func.strftime('%Y', DailyMetricsUnified.date).op('||')('-W').op('||')(func.strftime('%W', DailyMetricsUnified.date))
            select_columns.append(week_expr.label('period'))
            group_by_columns.append(week_expr)
        elif granularity == 'monthly':
            # 月级：按年月分组
            select_columns.append(
                func.strftime('%Y-%m', DailyMetricsUnified.date).label('period')
            )
            group_by_columns.append(
                func.strftime('%Y-%m', DailyMetricsUnified.date)
            )

        # 添加指标聚合列
        for metric in metrics:
            if metric == 'cost':
                select_columns.append(func.sum(DailyMetricsUnified.cost).label('cost'))
            elif metric == 'impressions':
                select_columns.append(func.sum(DailyMetricsUnified.impressions).label('impressions'))
            elif metric == 'clicks':
                select_columns.append(func.sum(DailyMetricsUnified.clicks).label('clicks'))
            elif metric == 'leads' or metric == 'lead_users':
                select_columns.append(func.sum(DailyMetricsUnified.lead_users).label('lead_users'))
            elif metric == 'new_accounts' or metric == 'opened_account_users':
                select_columns.append(func.sum(DailyMetricsUnified.opened_account_users).label('opened_account_users'))
            elif metric == 'valid_customer_users':
                select_columns.append(func.sum(DailyMetricsUnified.valid_customer_users).label('valid_customer_users'))

        query = db.session.query(*select_columns)

        # 应用筛选条件
        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                and_(
                    DailyMetricsUnified.date >= filters['date_range'][0],
                    DailyMetricsUnified.date <= filters['date_range'][1]
                )
            )

        if 'platforms' in filters and filters['platforms']:
            query = query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

        if 'agencies' in filters and filters['agencies']:
            query = query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

        if 'business_models' in filters and filters['business_models']:
            query = query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

        # 按粒度分组
        for group_col in group_by_columns:
            query = query.group_by(group_col)

        # 排序
        query = query.order_by(group_by_columns[0])

        results = query.all()

        # 转换结果
        output = {
            'dates': [],
            'series': []
        }

        # 提取周期标签
        for row in results:
            output['dates'].append(str(row.period))

        # 构建series
        for metric in metrics:
            series_data = []

            for row in results:
                if metric == 'cost' and hasattr(row, 'cost'):
                    series_data.append(float(row.cost) if row.cost else 0)
                elif metric == 'impressions' and hasattr(row, 'impressions'):
                    series_data.append(int(row.impressions) if row.impressions else 0)
                elif metric == 'clicks' and hasattr(row, 'clicks'):
                    series_data.append(int(row.clicks) if row.clicks else 0)
                elif (metric == 'leads' or metric == 'lead_users') and hasattr(row, 'lead_users'):
                    series_data.append(int(row.lead_users) if row.lead_users else 0)
                elif (metric == 'new_accounts' or metric == 'opened_account_users') and hasattr(row, 'opened_account_users'):
                    series_data.append(int(row.opened_account_users) if row.opened_account_users else 0)
                elif metric == 'valid_customer_users' and hasattr(row, 'valid_customer_users'):
                    series_data.append(int(row.valid_customer_users) if row.valid_customer_users else 0)
                else:
                    series_data.append(0)

            output['series'].append({
                'name': metric,
                'data': series_data
            })

        return jsonify({
            'success': True,
            'data': output
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}'
        }), 500



