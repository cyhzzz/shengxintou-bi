# -*- coding: utf-8 -*-
"""
代理商分析接口 - 代理商投放数据分析和趋势
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
bp = Blueprint('agency_analysis', __name__)

@bp.route('/agency-analysis', methods=['POST'])
def get_agency_analysis():
    """
    代理商投放分析
    返回平台×业务模式×代理商的多维度数据
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 1. 获取平台×业务模式×代理商汇总数据
        summary_query = db.session.query(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.agency,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

        # 应用筛选条件
        if 'date_range' in filters and filters['date_range']:
            summary_query = summary_query.filter(
                and_(
                    DailyMetricsUnified.date >= filters['date_range'][0],
                    DailyMetricsUnified.date <= filters['date_range'][1]
                )
            )

        if 'platforms' in filters and filters['platforms']:
            summary_query = summary_query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

        if 'agencies' in filters and filters['agencies']:
            summary_query = summary_query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

        if 'business_models' in filters and filters['business_models']:
            summary_query = summary_query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

        # 分组
        summary_query = summary_query.group_by(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.agency
        )

        summary_results = summary_query.all()

        # 转换汇总数据
        summary_data = []
        platform_subtotals = {}  # 平台小计
        grand_total = {  # 全部合计
            'cost': 0,
            'impressions': 0,
            'click_users': 0,
            'lead_users': 0,
            'opened_account_users': 0,
            'valid_customer_users': 0
        }

        for row in summary_results:
            cost = float(row.total_cost) if row.total_cost else 0
            impressions = int(row.total_impressions) if row.total_impressions else 0
            click_users = int(row.total_click_users) if row.total_click_users else 0
            lead_users = int(row.total_lead_users) if row.total_lead_users else 0
            opened_account_users = int(row.total_opened_account_users) if row.total_opened_account_users else 0
            valid_customer_users = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0

            # 计算成本指标
            lead_cost = cost / lead_users if lead_users > 0 else 0
            account_cost = cost / opened_account_users if opened_account_users > 0 else 0

            item = {
                'platform': row.platform,
                'business_model': row.business_model,
                'agency': row.agency,
                'metrics': {
                    'cost': cost,
                    'impressions': impressions,
                    'click_users': click_users,
                    'lead_users': lead_users,
                    'opened_account_users': opened_account_users,
                    'valid_customer_users': valid_customer_users,
                    'lead_cost': round(lead_cost, 2),
                    'account_cost': round(account_cost, 2)
                }
            }
            summary_data.append(item)

            # 累加平台小计
            platform = row.platform
            if platform not in platform_subtotals:
                platform_subtotals[platform] = {
                    'cost': 0,
                    'impressions': 0,
                    'click_users': 0,
                    'lead_users': 0,
                    'opened_account_users': 0,
                    'valid_customer_users': 0
                }
            platform_subtotals[platform]['cost'] += cost
            platform_subtotals[platform]['impressions'] += impressions
            platform_subtotals[platform]['click_users'] += click_users
            platform_subtotals[platform]['lead_users'] += lead_users
            platform_subtotals[platform]['opened_account_users'] += opened_account_users
            platform_subtotals[platform]['valid_customer_users'] += valid_customer_users

            # 累加全部合计
            grand_total['cost'] += cost
            grand_total['impressions'] += impressions
            grand_total['click_users'] += click_users
            grand_total['lead_users'] += lead_users
            grand_total['opened_account_users'] += opened_account_users
            grand_total['valid_customer_users'] += valid_customer_users

        # 生成平台小计行
        platform_subtotal_rows = []
        for platform, metrics in platform_subtotals.items():
            lead_cost = metrics['cost'] / metrics['lead_users'] if metrics['lead_users'] > 0 else 0
            account_cost = metrics['cost'] / metrics['opened_account_users'] if metrics['opened_account_users'] > 0 else 0

            platform_subtotal_rows.append({
                'platform': platform,
                'business_model': '',
                'agency': '[小计]',
                'is_subtotal': True,
                'metrics': {
                    'cost': metrics['cost'],
                    'impressions': metrics['impressions'],
                    'click_users': metrics['click_users'],
                    'lead_users': metrics['lead_users'],
                    'opened_account_users': metrics['opened_account_users'],
                    'valid_customer_users': metrics['valid_customer_users'],
                    'lead_cost': round(lead_cost, 2),
                    'account_cost': round(account_cost, 2)
                }
            })

        # 生成全部合计行
        total_lead_cost = grand_total['cost'] / grand_total['lead_users'] if grand_total['lead_users'] > 0 else 0
        total_account_cost = grand_total['cost'] / grand_total['opened_account_users'] if grand_total['opened_account_users'] > 0 else 0

        grand_total_row = {
            'platform': '',
            'business_model': '',
            'agency': '[合计]',
            'is_total': True,
            'metrics': {
                'cost': grand_total['cost'],
                'impressions': grand_total['impressions'],
                'click_users': grand_total['click_users'],
                'lead_users': grand_total['lead_users'],
                'opened_account_users': grand_total['opened_account_users'],
                'valid_customer_users': grand_total['valid_customer_users'],
                'lead_cost': round(total_lead_cost, 2),
                'account_cost': round(total_account_cost, 2)
            }
        }

        # 合并数据：明细 + 平台小计 + 全部合计
        final_summary = summary_data + platform_subtotal_rows + [grand_total_row]

        # 2. 获取按日期的趋势数据
        trend_query = db.session.query(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.agency,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

        # 应用相同的筛选条件
        if 'date_range' in filters and filters['date_range']:
            trend_query = trend_query.filter(
                and_(
                    DailyMetricsUnified.date >= filters['date_range'][0],
                    DailyMetricsUnified.date <= filters['date_range'][1]
                )
            )

        if 'platforms' in filters and filters['platforms']:
            trend_query = trend_query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

        if 'agencies' in filters and filters['agencies']:
            trend_query = trend_query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

        if 'business_models' in filters and filters['business_models']:
            trend_query = trend_query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

        # 分组
        trend_query = trend_query.group_by(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.agency
        )
        trend_query = trend_query.order_by(DailyMetricsUnified.date)

        trend_results = trend_query.all()

        # 转换趋势数据为前端期望的格式
        series_data = []
        for row in trend_results:
            series_data.append({
                'date': row.date.strftime('%Y-%m-%d'),
                'platform': row.platform,
                'business_model': row.business_model,
                'agency': row.agency,
                'metrics': {
                    'cost': float(row.total_cost) if row.total_cost else 0,
                    'impressions': int(row.total_impressions) if row.total_impressions else 0,
                    'click_users': int(row.total_click_users) if row.total_click_users else 0,
                    'lead_users': int(row.total_lead_users) if row.total_lead_users else 0,
                    'opened_account_users': int(row.total_opened_account_users) if row.total_opened_account_users else 0,
                    'valid_customer_users': int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
                }
            })

        # 获取所有唯一日期
        dates = sorted(list(set([row.date.strftime('%Y-%m-%d') for row in trend_results])))

        return jsonify({
            'summary': final_summary,
            'trend': {
                'dates': dates,
                'series': series_data
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



