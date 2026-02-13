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
    XhsNoteInfo,
    BackendConversions
)
from backend.database import db
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('dashboard', __name__)

@bp.route('/dashboard/accounts', methods=['POST'])
def get_dashboard_accounts():
    """
    获取数据概览报表的账号列表
    请求体: {
        "filters": {
            "platforms": ["腾讯", "抖音"],
            "agencies": ["量子", "众联"]
        }
    }
    返回: {
        "success": true,
        "data": {
            "ad_accounts": [...],  # 投放账号
            "content_accounts": [...]  # 内容账号（如果需要区分）
        }
    }
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

        if not start_date or not end_date:
            return jsonify({'success': False, 'error': '日期范围不能为空'}), 400

        # 构建查询
        query = db.session.query(
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.click_users).label('total_clicks'),
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

        result = query.first()

        # 提取数据
        total_cost = float(result.total_cost) if result.total_cost else 0
        total_impressions = int(result.total_impressions) if result.total_impressions else 0
        total_clicks = int(result.total_clicks) if result.total_clicks else 0
        total_leads = int(result.total_leads) if result.total_leads else 0
        total_opened = int(result.total_opened) if result.total_opened else 0
        total_valid = int(result.total_valid) if result.total_valid else 0

        # ===== 查询客户资产数据（按 is_opened_account 分组） =====
        # 构建用户唯一标识
        user_identifier_expr = (
            func.concat(
                BackendConversions.platform_source, '|',
                func.coalesce(BackendConversions.wechat_nickname, ''), '|',
                func.coalesce(BackendConversions.capital_account, ''), '|',
                func.coalesce(BackendConversions.platform_user_id, '')
            )
        )

        # 新开客户资产（is_opened_account = True/1）
        new_customers_assets_query = db.session.query(
            func.sum(BackendConversions.assets).label('total_assets'),
            func.count(func.distinct(user_identifier_expr)).label('unique_users'),
            func.sum(BackendConversions.customer_contribution).label('total_contribution')
        ).filter(
            and_(
                BackendConversions.lead_date >= start_date,
                BackendConversions.lead_date <= end_date,
                BackendConversions.is_opened_account == True
            )
        )

        # 存量客户资产（is_opened_account = False 且有资产）
        existing_customers_assets_query = db.session.query(
            func.sum(BackendConversions.assets).label('total_assets'),
            func.count(func.distinct(user_identifier_expr)).label('unique_users')
        ).filter(
            and_(
                BackendConversions.lead_date >= start_date,
                BackendConversions.lead_date <= end_date,
                BackendConversions.is_opened_account == False,
                BackendConversions.assets.isnot(None),
                BackendConversions.assets > 0
            )
        )

        # 应用筛选条件到资产查询
        if platforms:
            new_customers_assets_query = new_customers_assets_query.filter(
                BackendConversions.platform_source.in_(platforms)
            )
            existing_customers_assets_query = existing_customers_assets_query.filter(
                BackendConversions.platform_source.in_(platforms)
            )

        new_assets_result = new_customers_assets_query.first()
        existing_assets_result = existing_customers_assets_query.first()

        # 提取资产数据
        customer_assets = float(new_assets_result.total_assets) if new_assets_result and new_assets_result.total_assets else 0
        customer_contribution = float(new_assets_result.total_contribution) if new_assets_result and new_assets_result.total_contribution else 0
        existing_customers_assets = float(existing_assets_result.total_assets) if existing_assets_result and existing_assets_result.total_assets else 0

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
            'existing_customers_assets': existing_customers_assets,
            'cost_per_valid_account': round(cost_per_valid_account, 2),
            'cost_per_lead': round(cost_per_lead, 2)
        }

        # 计算环比数据（与上一周期对比）
        days_diff = (datetime.strptime(end_date, '%Y-%m-%d').date() -
                     datetime.strptime(start_date, '%Y-%m-%d').date()).days + 1
        prev_start = (datetime.strptime(start_date, '%Y-%m-%d').date() -
                      timedelta(days=days_diff)).strftime('%Y-%m-%d')
        prev_end = (datetime.strptime(start_date, '%Y-%m-%d').date() -
                    timedelta(days=1)).strftime('%Y-%m-%d')

        # 查询上一周期数据
        prev_query = db.session.query(
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.lead_users).label('total_leads'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid')
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

        # ===== 查询上一周期客户资产数据 =====
        # 新开客户资产（is_opened_account = True）
        prev_new_customers_assets_query = db.session.query(
            func.sum(BackendConversions.assets).label('total_assets'),
            func.sum(BackendConversions.customer_contribution).label('total_contribution')
        ).filter(
            and_(
                BackendConversions.lead_date >= prev_start,
                BackendConversions.lead_date <= prev_end,
                BackendConversions.is_opened_account == True
            )
        )

        # 存量客户资产（is_opened_account = False 且有资产）
        prev_existing_customers_assets_query = db.session.query(
            func.sum(BackendConversions.assets).label('total_assets')
        ).filter(
            and_(
                BackendConversions.lead_date >= prev_start,
                BackendConversions.lead_date <= prev_end,
                BackendConversions.is_opened_account == False,
                BackendConversions.assets.isnot(None),
                BackendConversions.assets > 0
            )
        )

        # 应用筛选条件到资产查询
        if platforms:
            prev_new_customers_assets_query = prev_new_customers_assets_query.filter(
                BackendConversions.platform_source.in_(platforms)
            )
            prev_existing_customers_assets_query = prev_existing_customers_assets_query.filter(
                BackendConversions.platform_source.in_(platforms)
            )

        prev_new_assets_result = prev_new_customers_assets_query.first()
        prev_existing_assets_result = prev_existing_customers_assets_query.first()

        prev_customer_assets = float(prev_new_assets_result.total_assets) if prev_new_assets_result and prev_new_assets_result.total_assets else 0
        prev_customer_contribution = float(prev_new_assets_result.total_contribution) if prev_new_assets_result and prev_new_assets_result.total_contribution else 0
        prev_existing_customers_assets = float(prev_existing_assets_result.total_assets) if prev_existing_assets_result and prev_existing_assets_result.total_assets else 0

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
            'existing_customers_assets': calc_wow(existing_customers_assets, prev_existing_customers_assets, is_cost_metric=False),
            'cost_per_valid_account': calc_wow(cost_per_valid_account,
                                                (prev_cost / prev_valid) if prev_valid > 0 else 0,
                                                is_cost_metric=True),
            'cost_per_lead': calc_wow(cost_per_lead,
                                       (prev_cost / prev_leads) if prev_leads > 0 else 0,
                                       is_cost_metric=True)
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


