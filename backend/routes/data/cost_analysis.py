# -*- coding: utf-8 -*-
"""
成本分析接口 - 成本分析、转化漏斗
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
bp = Blueprint('cost_analysis', __name__)

@bp.route('/cost-analysis', methods=['POST'])
def get_cost_analysis():
    """
    成本分析
    计算单线索成本、单客成本、单有效户成本
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 获取日级数据
        query = db.session.query(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.account_id,
            DailyMetricsUnified.account_name,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.clicks).label('total_clicks'),
            func.sum(DailyMetricsUnified.leads).label('total_leads'),
            func.sum(DailyMetricsUnified.new_accounts).label('total_new_accounts')
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

        # 分组：按账号
        query = query.group_by(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.account_id,
            DailyMetricsUnified.account_name,
            DailyMetricsUnified.date
        )

        results = query.all()

        # 聚合到账号级别
        account_stats = {}
        for row in results:
            key = f"{row.platform}_{row.agency}_{row.account_id}"

            if key not in account_stats:
                account_stats[key] = {
                    'platform': row.platform,
                    'agency': row.agency,
                    'account_id': row.account_id,
                    'account_name': row.account_name or '',
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': 0,
                    'new_accounts': 0
                }

            account_stats[key]['cost'] += float(row.total_cost) if row.total_cost else 0
            account_stats[key]['impressions'] += int(row.total_impressions) if row.total_impressions else 0
            account_stats[key]['clicks'] += int(row.total_clicks) if row.total_clicks else 0
            account_stats[key]['leads'] += int(row.total_leads) if row.total_leads else 0
            account_stats[key]['new_accounts'] += int(row.total_new_accounts) if row.total_new_accounts else 0

        # 转换为列表并计算成本指标
        cost_data = []
        for stat in account_stats.values():
            cost_per_lead = stat['cost'] / stat['leads'] if stat['leads'] > 0 else 0
            cost_per_account = stat['cost'] / stat['new_accounts'] if stat['new_accounts'] > 0 else 0
            cost_per_click = stat['cost'] / stat['clicks'] if stat['clicks'] > 0 else 0
            cpm = stat['cost'] / stat['impressions'] * 1000 if stat['impressions'] > 0 else 0

            cost_data.append({
                'platform': stat['platform'],
                'agency': stat['agency'],
                'account_id': stat['account_id'],
                'account_name': stat['account_name'],
                'metrics': {
                    'cost': stat['cost'],
                    'impressions': stat['impressions'],
                    'clicks': stat['clicks'],
                    'leads': stat['leads'],
                    'new_accounts': stat['new_accounts']
                },
                'cost_metrics': {
                    'cost_per_lead': cost_per_lead,
                    'cost_per_account': cost_per_account,
                    'cost_per_click': cost_per_click,
                    'cpm': cpm
                }
            })

        # 计算汇总统计
        total_cost = sum(item['metrics']['cost'] for item in cost_data)
        total_leads = sum(item['metrics']['leads'] for item in cost_data)
        total_accounts = sum(item['metrics']['new_accounts'] for item in cost_data)

        summary = {
            'total_cost': total_cost,
            'total_leads': total_leads,
            'total_accounts': total_accounts,
            'avg_cost_per_lead': total_cost / total_leads if total_leads > 0 else 0,
            'avg_cost_per_account': total_cost / total_accounts if total_accounts > 0 else 0
        }

        return jsonify({
            'data': cost_data,
            'summary': summary
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/conversion-funnel', methods=['POST'])
def get_conversion_funnel():
    """
    转化漏斗监测 (7层漏斗)
    使用 daily_metrics_unified 表数据

    7层漏斗定义:
    1. 曝光 (impressions) - 广告曝光量
    2. 点击人数 (click_users) - 去重点击人数
    3. 线索人数 (lead_users) - 去重线索人数
    4. 开口人数 (customer_mouth_users) - 去重开口人数
    5. 有效线索 (valid_lead_users) - 去重有效线索人数
    6. 开户人数 (opened_account_users) - 去重开户人数
    7. 有效户人数 (valid_customer_users) - 去重有效户人数

    请求参数:
    {
      "filters": {
        "platforms": ["腾讯", "抖音", "小红书"],
        "date_range": ["2025-01-01", "2025-01-15"],
        "agencies": ["量子", "众联"],
        "business_models": ["直播", "信息流"]
      }
    }
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 解析日期范围
        start_date = None
        end_date = None
        if 'date_range' in filters and filters['date_range']:
            start_date = filters['date_range'][0]
            end_date = filters['date_range'][1]

        # ===== 1. 从 daily_metrics_unified 聚合数据 =====
        query = db.session.query(
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.customer_mouth_users).label('total_customer_mouth_users'),
            func.sum(DailyMetricsUnified.valid_lead_users).label('total_valid_lead_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        )

        # 应用筛选条件
        if start_date and end_date:
            query = query.filter(
                and_(
                    DailyMetricsUnified.date >= start_date,
                    DailyMetricsUnified.date <= end_date
                )
            )

        if 'platforms' in filters and filters['platforms']:
            query = query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

        if 'agencies' in filters and filters['agencies']:
            query = query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

        if 'business_models' in filters and filters['business_models']:
            query = query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

        result = query.first()

        # 提取数据
        impressions = int(result.total_impressions) if result.total_impressions else 0
        click_users = int(result.total_click_users) if result.total_click_users else 0
        total_cost = float(result.total_cost) if result.total_cost else 0
        lead_users = int(result.total_lead_users) if result.total_lead_users else 0
        customer_mouth_users = int(result.total_customer_mouth_users) if result.total_customer_mouth_users else 0
        valid_lead_users = int(result.total_valid_lead_users) if result.total_valid_lead_users else 0
        opened_account_users = int(result.total_opened_account_users) if result.total_opened_account_users else 0
        valid_customer_users = int(result.total_valid_customer_users) if result.total_valid_customer_users else 0

        # ===== 2. 构建7层漏斗 =====
        # 计算每一层相对于上一层的转化率
        funnel_stages = [
            {
                'step': '广告曝光',
                'value': impressions,
                'label': '曝光量',
                'rate': 100.0  # 第一层是100%
            },
            {
                'step': '客户点击',
                'value': click_users,
                'label': '点击人数',
                'rate': (click_users / impressions * 100) if impressions > 0 else 0
            },
            {
                'step': '客户线索',
                'value': lead_users,
                'label': '线索人数',
                'rate': (lead_users / click_users * 100) if click_users > 0 else 0
            },
            {
                'step': '客户开口',
                'value': customer_mouth_users,
                'label': '开口人数',
                'rate': (customer_mouth_users / lead_users * 100) if lead_users > 0 else 0
            },
            {
                'step': '有效线索',
                'value': valid_lead_users,
                'label': '有效线索',
                'rate': (valid_lead_users / customer_mouth_users * 100) if customer_mouth_users > 0 else 0
            },
            {
                'step': '成功开户',
                'value': opened_account_users,
                'label': '开户人数',
                'rate': (opened_account_users / valid_lead_users * 100) if valid_lead_users > 0 else 0
            },
            {
                'step': '有效户',
                'value': valid_customer_users,
                'label': '有效户人数',
                'rate': (valid_customer_users / opened_account_users * 100) if opened_account_users > 0 else 0
            }
        ]

        # 计算总转化率（有效户 / 曝光）
        overall_conversion_rate = (valid_customer_users / impressions * 100) if impressions > 0 else 0

        # ===== 3. 核心指标数据 =====
        core_metrics = {
            'cost': round(total_cost, 2),
            'lead_users': lead_users,
            'opened_account_users': opened_account_users,
            'valid_customer_users': valid_customer_users
        }

        # ===== 4. 返回结果 =====
        return jsonify({
            'success': True,
            'data': {
                'funnel': funnel_stages,
                'core_metrics': core_metrics
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'details': traceback.format_exc()
        }), 500



