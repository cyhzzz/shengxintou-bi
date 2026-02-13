# -*- coding: utf-8 -*-
"""
趋势数据接口 - 日级/周级/月级趋势分析
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, Integer, case, literal
from backend.models import (
    DailyMetricsUnified,
    AccountAgencyMapping,
    AgencyAbbreviationMapping,
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    BackendConversions
)
from backend.database import db
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('trend', __name__)

@bp.route('/trend', methods=['POST'])
def get_trend():
    """
    获取趋势数据
    支持日级、周级、月级聚合
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
            # 周级：按ISO周分组 (年份+周数)
            select_columns.append(
                func.concat(
                    func.strftime('%Y', DailyMetricsUnified.date),
                    literal('-W'),
                    func.strftime('%W', DailyMetricsUnified.date)
                ).label('period')
            )
            group_by_columns.append(
                func.concat(
                    func.strftime('%Y', DailyMetricsUnified.date),
                    literal('-W'),
                    func.strftime('%W', DailyMetricsUnified.date)
                )
            )
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
            elif metric == 'clicks' or metric == 'click_users':
                select_columns.append(func.sum(DailyMetricsUnified.click_users).label('click_users'))
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
            metric_name = metric

            for row in results:
                if metric == 'cost' and hasattr(row, 'cost'):
                    series_data.append(float(row.cost) if row.cost else 0)
                elif metric == 'impressions' and hasattr(row, 'impressions'):
                    series_data.append(int(row.impressions) if row.impressions else 0)
                elif (metric == 'clicks' or metric == 'click_users') and hasattr(row, 'click_users'):
                    series_data.append(int(row.click_users) if row.click_users else 0)
                elif (metric == 'leads' or metric == 'lead_users') and hasattr(row, 'lead_users'):
                    series_data.append(int(row.lead_users) if row.lead_users else 0)
                elif (metric == 'new_accounts' or metric == 'opened_account_users') and hasattr(row, 'opened_account_users'):
                    series_data.append(int(row.opened_account_users) if row.opened_account_users else 0)
                elif metric == 'valid_customer_users' and hasattr(row, 'valid_customer_users'):
                    series_data.append(int(row.valid_customer_users) if row.valid_customer_users else 0)
                else:
                    series_data.append(0)

            output['series'].append({
                'name': metric_name,
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



