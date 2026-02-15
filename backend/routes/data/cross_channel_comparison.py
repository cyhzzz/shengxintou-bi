# -*- coding: utf-8 -*-
"""
跨渠道对比接口
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models import DailyMetricsUnified
from backend.database import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('cross_channel_comparison', __name__)


@bp.route('/cross-channel-comparison/summary', methods=['POST'])
def get_summary():
    """
    获取各平台汇总数据
    请求参数:
    {
      "filters": {
        "platforms": ["腾讯", "抖音", "小红书"],
        "agencies": ["量子", "众联"],
        "business_models": ["直播", "信息流"],
        "date_range": ["2026-01-01", "2026-01-15"]
      },
      "metrics": ["cost", "lead_users", "valid_customer_users"]
    }
    """
    data = request.get_json()
    filters = data.get('filters', {})

    try:
        logger.info(f'[cross-channel-comparison] 获取汇总数据: {filters}')

        # 构建查询
        query = db.session.query(
            DailyMetricsUnified.platform,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

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

        # 分组
        query = query.group_by(DailyMetricsUnified.platform)

        results = query.all()

        # 转换数据
        platform_summary = []
        total_cost = 0
        total_leads = 0
        total_valid_customers = 0

        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            opened = int(row.total_opened_account_users) if row.total_opened_account_users else 0
            impressions = int(row.total_impressions) if row.total_impressions else 0
            clicks = int(row.total_click_users) if row.total_click_users else 0

            item = {
                'platform': row.platform,
                'cost': cost,
                'impressions': impressions,
                'click_users': clicks,
                'lead_users': leads,
                'opened_account_users': opened,
                'valid_customer_users': valid
            }
            platform_summary.append(item)

            total_cost += cost
            total_leads += leads
            total_valid_customers += valid

        # 计算衍生指标
        derived_metrics = []
        best_cost_platform = None
        best_conversion_platform = None
        min_cost_per_lead = float('inf')
        max_conversion_rate = 0

        for item in platform_summary:
            cost_per_lead = item['cost'] / item['lead_users'] if item['lead_users'] > 0 else 0
            cost_per_customer = item['cost'] / item['opened_account_users'] if item['opened_account_users'] > 0 else 0
            cost_per_valid = item['cost'] / item['valid_customer_users'] if item['valid_customer_users'] > 0 else 0
            click_rate = (item['click_users'] / item['impressions'] * 100) if item['impressions'] > 0 else 0
            lead_conversion = (item['lead_users'] / item['click_users'] * 100) if item['click_users'] > 0 else 0
            overall_conversion = (item['valid_customer_users'] / item['impressions'] * 100) if item['impressions'] > 0 else 0

            derived_metrics.append({
                'platform': item['platform'],
                'cost_per_lead': round(cost_per_lead, 2),
                'cost_per_customer': round(cost_per_customer, 2),
                'cost_per_valid': round(cost_per_valid, 2),
                'click_rate': round(click_rate, 2),
                'lead_conversion_rate': round(lead_conversion, 2),
                'overall_conversion_rate': round(overall_conversion, 4)
            })

            if cost_per_lead < min_cost_per_lead and cost_per_lead > 0:
                min_cost_per_lead = cost_per_lead
                best_cost_platform = item['platform']

            if overall_conversion > max_conversion_rate and overall_conversion > 0:
                max_conversion_rate = overall_conversion
                best_conversion_platform = item['platform']

        return jsonify({
            'success': True,
            'data': {
                'platform_summary': platform_summary,
                'derived_metrics': derived_metrics,
                'comparison_metrics': {
                    'best_cost_platform': best_cost_platform,
                    'best_conversion_platform': best_conversion_platform,
                    'total_cost': total_cost,
                    'total_leads': total_leads,
                    'total_valid_customers': total_valid_customers
                }
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[cross-channel-comparison] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/cross-channel-comparison/trend', methods=['POST'])
def get_trend():
    """
    获取趋势数据
    请求参数:
    {
      "filters": { ... },
      "metric": "cost_per_lead"  // cost, lead_users, valid_customer_users, cost_per_lead
    }
    """
    data = request.get_json()
    filters = data.get('filters', {})
    metric = data.get('metric', 'cost_per_lead')

    try:
        logger.info(f'[cross-channel-comparison] 获取趋势数据: metric={metric}')

        # 构建查询
        query = db.session.query(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

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

        # 分组
        query = query.group_by(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform
        ).order_by(DailyMetricsUnified.date)

        results = query.all()

        # 获取所有唯一日期
        dates = sorted(list(set([row.date.strftime('%Y-%m-%d') for row in results])))

        # 转换为按平台×日期的数据
        trend_data = {}
        for row in results:
            date = row.date.strftime('%Y-%m-%d')
            platform = row.platform

            if date not in trend_data:
                trend_data[date] = {}

            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            opened = int(row.total_opened_account_users) if row.total_opened_account_users else 0

            # 根据指标计算值
            if metric == 'cost':
                value = cost
            elif metric == 'lead_users':
                value = leads
            elif metric == 'valid_customer_users':
                value = valid
            elif metric == 'cost_per_lead':
                value = (cost / leads) if leads > 0 else 0
            elif metric == 'cost_per_valid':
                value = (cost / valid) if valid > 0 else 0
            elif metric == 'cost_per_customer':
                value = (cost / opened) if opened > 0 else 0
            else:
                value = 0

            trend_data[date][platform] = round(value, 2)

        return jsonify({
            'success': True,
            'data': {
                'dates': dates,
                'trend_data': trend_data
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[cross-channel-comparison] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/cross-channel-comparison/funnel', methods=['POST'])
def get_funnel():
    """
    获取漏斗对比数据
    返回每个平台的7层漏斗
    """
    data = request.get_json()
    filters = data.get('filters', {})

    try:
        logger.info(f'[cross-channel-comparison] 获取漏斗对比数据')

        # 构建查询
        query = db.session.query(
            DailyMetricsUnified.platform,
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

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

        # 分组
        query = query.group_by(DailyMetricsUnified.platform)

        results = query.all()

        # 转换为漏斗格式
        funnel_data = {}
        for row in results:
            platform = row.platform

            impressions = int(row.total_impressions) if row.total_impressions else 0
            click_users = int(row.total_click_users) if row.total_click_users else 0
            lead_users = int(row.total_lead_users) if row.total_lead_users else 0
            opened = int(row.total_opened_account_users) if row.total_opened_account_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0

            # 计算各层转化率
            click_rate = (click_users / impressions * 100) if impressions > 0 else 0
            lead_rate = (lead_users / click_users * 100) if click_users > 0 else 0
            open_rate = (opened / lead_users * 100) if lead_users > 0 else 0
            valid_rate = (valid / opened * 100) if opened > 0 else 0

            funnel_data[platform] = {
                'funnel_stages': [
                    {'step': '广告曝光', 'value': impressions, 'rate': 100.0},
                    {'step': '点击人数', 'value': click_users, 'rate': click_rate},
                    {'step': '线索人数', 'value': lead_users, 'rate': lead_rate},
                    {'step': '开户人数', 'value': opened, 'rate': open_rate},
                    {'step': '有效户人数', 'value': valid, 'rate': valid_rate}
                ],
                'overall_conversion_rate': (valid / impressions * 100) if impressions > 0 else 0
            }

        return jsonify({
            'success': True,
            'data': {
                'funnel_data': funnel_data
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[cross-channel-comparison] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/cross-channel-comparison/matrix', methods=['POST'])
def get_matrix():
    """
    获取平台×业务模式×代理商矩阵
    返回热力图数据
    """
    data = request.get_json()
    filters = data.get('filters', {})
    metric = data.get('metric', 'cost')  // cost, lead_users, valid_customer_users

    try:
        logger.info(f'[cross-channel-comparison] 获取矩阵数据: metric={metric}')

        # 构建查询
        query = db.session.query(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.business_model,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

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

        # 分组
        query = query.group_by(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.business_model
        )

        results = query.all()

        # 获取唯一值
        platforms = sorted(list(set([row.platform for row in results])))
        agencies = sorted(list(set([row.agency for row in results if row.agency])))
        business_models = sorted(list(set([row.business_model for row in results if row.business_model])))

        # 构建矩阵数据
        matrix_data = []
        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0

            # 根据指标选择值
            if metric == 'cost':
                value = cost
            elif metric == 'lead_users':
                value = leads
            elif metric == 'valid_customer_users':
                value = valid
            else:
                value = cost

            matrix_data.append({
                'platform': row.platform,
                'agency': row.agency,
                'business_model': row.business_model,
                'value': value
            })

        return jsonify({
            'success': True,
            'data': {
                'platforms': platforms,
                'agencies': agencies,
                'business_models': business_models,
                'matrix_data': matrix_data
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[cross-channel-comparison] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500
