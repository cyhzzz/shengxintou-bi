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
from backend.utils.decorators import handle_exceptions
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('cost_analysis', __name__)

@bp.route('/cost-analysis', methods=['POST'])
@handle_exceptions
def get_cost_analysis():
    """
    成本分析
    ---
    tags:
      - Cost Analysis
    description: |
      计算单线索成本、单客成本、单有效户成本。

      **返回数据**：
      - data: 账号级别的成本数据列表
      - summary: 汇总统计（总花费、总线索、总开户、平均成本）

      **计算指标**：
      - cost_per_lead: 单线索成本 = 花费 / 线索数
      - cost_per_account: 单开户成本 = 花费 / 开户数
      - cost_per_click: 单点击成本 = 花费 / 点击数
      - cpm: 千次曝光成本
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
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                type: object
                properties:
                  platform:
                    type: string
                  agency:
                    type: string
                  account_id:
                    type: string
                  account_name:
                    type: string
                  metrics:
                    type: object
                    properties:
                      cost:
                        type: number
                      impressions:
                        type: integer
                      clicks:
                        type: integer
                      leads:
                        type: integer
                      new_accounts:
                        type: integer
                  cost_metrics:
                    type: object
                    properties:
                      cost_per_lead:
                        type: number
                      cost_per_account:
                        type: number
                      cost_per_click:
                        type: number
                      cpm:
                        type: number
            summary:
              type: object
              properties:
                total_cost:
                  type: number
                total_leads:
                  type: integer
                total_accounts:
                  type: integer
                avg_cost_per_lead:
                  type: number
                avg_cost_per_account:
                  type: number
      500:
        description: 服务器错误
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
@handle_exceptions
def get_conversion_funnel():
    """
    获取转化漏斗数据
    ---
    tags:
      - Conversion Funnel
    description: |
      获取转化漏斗数据，支持两种模式：

      **模式1: 广告投放漏斗（7层）** - 无员工筛选时
      1. 曝光 (impressions) - 广告曝光量
      2. 点击次数 (clicks) - 点击次数
      3. 线索人数 (lead_users) - 去重线索人数
      4. 开口人数 (customer_mouth_users) - 去重开口人数
      5. 有效线索 (valid_lead_users) - 去重有效线索人数
      6. 开户人数 (opened_account_users) - 去重开户人数
      7. 有效户人数 (valid_customer_users) - 去重有效户人数

      **模式2: 服务人员漏斗（5层）** - 有员工筛选时
      1. 线索人数 (lead_users) - 该员工服务的线索人数
      2. 开口人数 (customer_mouth_users) - 去重开口人数
      3. 有效线索 (valid_lead_users) - 去重有效线索人数
      4. 开户人数 (opened_account_users) - 去重开户人数
      5. 有效户人数 (valid_customer_users) - 去重有效户人数
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
                date_range:
                  type: array
                  items:
                    type: string
                    format: date
                  description: 日期范围 [开始日期, 结束日期]
                  example: ["2025-01-01", "2025-01-31"]
                agencies:
                  type: array
                  items:
                    type: string
                  description: 代理商筛选
                  example: ["量子", "众联"]
                business_models:
                  type: array
                  items:
                    type: string
                    enum: ["直播", "信息流", "搜索"]
                  description: 业务模式筛选
                employees:
                  type: array
                  items:
                    type: string
                  description: 员工号列表（用于服务人员漏斗模式）
                  example: ["E001", "E002"]
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
                funnel:
                  type: array
                  items:
                    $ref: '#/definitions/FunnelStage'
                core_metrics:
                  type: object
                  properties:
                    cost:
                      type: number
                      description: 总花费
                    impressions:
                      type: integer
                      description: 总曝光
                    click_users:
                      type: integer
                      description: 点击人数
                    lead_users:
                      type: integer
                      description: 线索人数
                    customer_mouth_users:
                      type: integer
                      description: 开口人数
                    valid_lead_users:
                      type: integer
                      description: 有效线索人数
                    opened_account_users:
                      type: integer
                      description: 开户人数
                    valid_customer_users:
                      type: integer
                      description: 有效户人数
                is_employee_mode:
                  type: boolean
                  description: 是否为服务人员漏斗模式
      400:
        description: 请求参数错误
      500:
        description: 服务器错误
    """
    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 解析日期范围
        start_date = None
        end_date = None
        if 'date_range' in filters and filters['date_range']:
            start_date = filters['date_range'][0]
            end_date = filters['date_range'][1]

        # 检查是否有员工筛选
        has_employee_filter = 'employees' in filters and filters['employees']

        # ===== 根据模式选择不同的数据查询逻辑 =====
        if has_employee_filter:
            # ===== 模式2: 服务人员漏斗（5层）=====
            # 从 backend_conversions 表直接查询，不需要广告数据

            conv_query = db.session.query(
                func.count(func.distinct(BackendConversions.id)).label('total_leads'),
                func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('total_mouth'),
                func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),
                func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened'),
                func.sum(case((BackendConversions.is_valid_customer == True, 1), else_=0)).label('total_valid')
            ).filter(
                BackendConversions.add_employee_no.in_(filters['employees'])
            )

            # 应用日期筛选
            if start_date and end_date:
                conv_query = conv_query.filter(
                    and_(
                        BackendConversions.lead_date >= start_date,
                        BackendConversions.lead_date <= end_date
                    )
                )

            # 应用平台筛选
            if 'platforms' in filters and filters['platforms']:
                conv_query = conv_query.filter(BackendConversions.platform_source.in_(filters['platforms']))

            conv_result = conv_query.first()

            lead_users = int(conv_result.total_leads) if conv_result.total_leads else 0
            customer_mouth_users = int(conv_result.total_mouth) if conv_result.total_mouth else 0
            valid_lead_users = int(conv_result.total_valid_leads) if conv_result.total_valid_leads else 0
            opened_account_users = int(conv_result.total_opened) if conv_result.total_opened else 0
            valid_customer_users = int(conv_result.total_valid) if conv_result.total_valid else 0

            # 构建5层漏斗（从客户线索开始）
            funnel_stages = [
                {
                    'step': '客户线索',
                    'value': lead_users,
                    'label': '线索人数',
                    'rate': 100.0  # 第一层是100%
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

            # 计算总转化率（有效户 / 线索）
            overall_conversion_rate = (valid_customer_users / lead_users * 100) if lead_users > 0 else 0

            # 核心指标数据（服务人员模式没有广告花费）
            core_metrics = {
                'cost': 0,  # 服务人员模式下无广告花费
                'lead_users': lead_users,
                'opened_account_users': opened_account_users,
                'valid_customer_users': valid_customer_users
            }

        else:
            # ===== 模式1: 广告投放漏斗（7层）=====
            # 从 daily_metrics_unified 获取广告指标
            ad_query = db.session.query(
                func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
                func.sum(DailyMetricsUnified.cost).label('total_cost'),
                func.sum(DailyMetricsUnified.clicks).label('total_clicks')
            )

            # 应用筛选条件
            if start_date and end_date:
                ad_query = ad_query.filter(
                    and_(
                        DailyMetricsUnified.date >= start_date,
                        DailyMetricsUnified.date <= end_date
                    )
                )

            if 'platforms' in filters and filters['platforms']:
                ad_query = ad_query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

            if 'agencies' in filters and filters['agencies']:
                ad_query = ad_query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

            if 'business_models' in filters and filters['business_models']:
                ad_query = ad_query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

            ad_result = ad_query.first()

            # 提取广告数据
            impressions = int(ad_result.total_impressions) if ad_result.total_impressions else 0
            clicks = int(ad_result.total_clicks) if ad_result.total_clicks else 0
            total_cost = float(ad_result.total_cost) if ad_result.total_cost else 0

            # 从聚合表查询转化指标
            conv_query = db.session.query(
                func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
                func.sum(DailyMetricsUnified.customer_mouth_users).label('total_customer_mouth_users'),
                func.sum(DailyMetricsUnified.valid_lead_users).label('total_valid_lead_users'),
                func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
                func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')
            )

            # 应用筛选条件
            if start_date and end_date:
                conv_query = conv_query.filter(
                    and_(
                        DailyMetricsUnified.date >= start_date,
                        DailyMetricsUnified.date <= end_date
                    )
                )

            if 'platforms' in filters and filters['platforms']:
                conv_query = conv_query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))

            if 'agencies' in filters and filters['agencies']:
                conv_query = conv_query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))

            if 'business_models' in filters and filters['business_models']:
                conv_query = conv_query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

            conv_result = conv_query.first()

            lead_users = int(conv_result.total_lead_users) if conv_result.total_lead_users else 0
            customer_mouth_users = int(conv_result.total_customer_mouth_users) if conv_result.total_customer_mouth_users else 0
            valid_lead_users = int(conv_result.total_valid_lead_users) if conv_result.total_valid_lead_users else 0
            opened_account_users = int(conv_result.total_opened_account_users) if conv_result.total_opened_account_users else 0
            valid_customer_users = int(conv_result.total_valid_customer_users) if conv_result.total_valid_customer_users else 0

            # 构建7层漏斗
            funnel_stages = [
                {
                    'step': '广告曝光',
                    'value': impressions,
                    'label': '曝光量',
                    'rate': 100.0  # 第一层是100%
                },
                {
                    'step': '客户点击',
                    'value': clicks,
                    'label': '点击次数',
                    'rate': (clicks / impressions * 100) if impressions > 0 else 0
                },
                {
                    'step': '客户线索',
                    'value': lead_users,
                    'label': '线索人数',
                    'rate': (lead_users / clicks * 100) if clicks > 0 else 0
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

            # 核心指标数据
            core_metrics = {
                'cost': round(total_cost, 2),
                'lead_users': lead_users,
                'opened_account_users': opened_account_users,
                'valid_customer_users': valid_customer_users
            }

        # ===== 返回结果 =====
        return jsonify({
            'success': True,
            'data': {
                'funnel': funnel_stages,
                'core_metrics': core_metrics,
                'is_employee_mode': has_employee_filter
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'details': traceback.format_exc()
        }), 500



