# -*- coding: utf-8 -*-
"""
外部数据分析接口
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
bp = Blueprint('external_analysis', __name__)

@bp.route('/external-data-analysis', methods=['POST'])
@handle_exceptions
def get_external_data_analysis():
    """
    外部数据分析
    提供高级分析和对比洞察
    ---
    tags:
      - External Analysis
    description: |
      获取高级分析和对比洞察数据，包括：
      - platform_comparison: 平台对比分析
      - agency_ranking: 代理商排名（按综合评分排序）
      - business_model_analysis: 业务模式分析
      - roi_analysis: ROI分析（投资回报率）
      - trend_insights: 趋势洞察和建议
      - performance_matrix: 平台×代理商性能矩阵

      **计算指标**：
      - ctr: 点击率 = 点击量 / 曝光量 * 100
      - lead_rate: 线索率 = 线索量 / 点击量 * 100
      - account_rate: 开户率 = 开户量 / 线索量 * 100
      - cost_per_lead: 单线索成本 = 花费 / 线索量
      - cost_per_account: 单开户成本 = 花费 / 开户量
      - roi: 投资回报率 = (开户量 * 10000 - 花费) / 花费 * 100
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
                  example: ["量子", "众联"]
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
            platform_comparison:
              type: array
              description: 平台对比分析
              items:
                type: object
                properties:
                  platform:
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
                      ctr:
                        type: number
                      lead_rate:
                        type: number
                      account_rate:
                        type: number
                      cost_per_lead:
                        type: number
                      cost_per_account:
                        type: number
            agency_ranking:
              type: array
              description: 代理商排名（按score降序）
              items:
                type: object
                properties:
                  agency:
                    type: string
                  metrics:
                    type: object
                  score:
                    type: number
                    description: 综合评分
            business_model_analysis:
              type: array
              description: 业务模式分析
              items:
                type: object
                properties:
                  business_model:
                    type: string
                  metrics:
                    type: object
            roi_analysis:
              type: object
              description: ROI分析
              properties:
                total_investment:
                  type: number
                total_returns:
                  type: number
                roi:
                  type: number
                break_even_accounts:
                  type: number
                current_accounts:
                  type: integer
                profit_loss:
                  type: number
                metrics:
                  type: object
            trend_insights:
              type: object
              description: 趋势洞察
              properties:
                dates:
                  type: array
                  items:
                    type: string
                cost_trend:
                  type: number
                ctr_trend:
                  type: number
                insights:
                  type: array
                  items:
                    type: string
                recommendations:
                  type: array
                  items:
                    type: string
            performance_matrix:
              type: array
              description: 平台×代理商性能矩阵
              items:
                type: object
                properties:
                  platform:
                    type: string
                  agency:
                    type: string
                  metrics:
                    type: object
      500:
        description: 服务器错误
    """
    from backend.database import db

    try:
        data = request.get_json()
        filters = data.get('filters', {})

        # 解析日期范围
        start_date = None
        end_date = None
        if 'date_range' in filters and filters['date_range']:
            start_date = filters['date_range'][0]
            end_date = filters['date_range'][1]

        # 构建基础查询
        query = db.session.query(DailyMetricsUnified)

        # 应用日期筛选
        if start_date and end_date:
            query = query.filter(
                and_(
                    DailyMetricsUnified.date >= start_date,
                    DailyMetricsUnified.date <= end_date
                )
            )

        # 应用其他筛选条件
        if 'platforms' in filters and filters['platforms']:
            query = query.filter(DailyMetricsUnified.platform.in_(filters['platforms']))
        if 'agencies' in filters and filters['agencies']:
            query = query.filter(DailyMetricsUnified.agency.in_(filters['agencies']))
        if 'business_models' in filters and filters['business_models']:
            query = query.filter(DailyMetricsUnified.business_model.in_(filters['business_models']))

        # 获取所有数据
        records = query.all()

        if not records:
            return jsonify({
                'platform_comparison': [],
                'agency_ranking': [],
                'business_model_analysis': [],
                'roi_analysis': {},
                'trend_insights': {},
                'performance_matrix': []
            })

        # 1. 平台对比分析
        platform_comparison = []
        platform_stats = {}
        for record in records:
            platform = record.platform
            if platform not in platform_stats:
                platform_stats[platform] = {
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': 0,
                    'new_accounts': 0
                }
            platform_stats[platform]['cost'] += record.cost or 0
            platform_stats[platform]['impressions'] += record.impressions or 0
            platform_stats[platform]['clicks'] += record.clicks or 0
            platform_stats[platform]['leads'] += record.lead_users or 0
            platform_stats[platform]['new_accounts'] += record.opened_account_users or 0

        for platform, stats in platform_stats.items():
            cost = stats['cost']
            impressions = stats['impressions']
            clicks = stats['clicks']
            leads = stats['leads']
            new_accounts = stats['new_accounts']

            platform_comparison.append({
                'platform': platform,
                'metrics': {
                    'cost': cost,
                    'impressions': impressions,
                    'clicks': clicks,
                    'leads': leads,
                    'new_accounts': new_accounts,
                    'ctr': (clicks / impressions * 100) if impressions > 0 else 0,
                    'lead_rate': (leads / clicks * 100) if clicks > 0 else 0,
                    'account_rate': (new_accounts / leads * 100) if leads > 0 else 0,
                    'cost_per_lead': (cost / leads) if leads > 0 else 0,
                    'cost_per_account': (cost / new_accounts) if new_accounts > 0 else 0
                }
            })

        # 2. 代理商排名
        agency_ranking = []
        agency_stats = {}
        for record in records:
            agency = record.agency
            if agency not in agency_stats:
                agency_stats[agency] = {
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': 0,
                    'new_accounts': 0
                }
            agency_stats[agency]['cost'] += record.cost or 0
            agency_stats[agency]['impressions'] += record.impressions or 0
            agency_stats[agency]['clicks'] += record.clicks or 0
            agency_stats[agency]['leads'] += record.lead_users or 0
            agency_stats[agency]['new_accounts'] += record.opened_account_users or 0

        for agency, stats in agency_stats.items():
            cost = stats['cost']
            impressions = stats['impressions']
            clicks = stats['clicks']
            leads = stats['leads']
            new_accounts = stats['new_accounts']

            # 计算综合评分 (权重: 成本效率30%, 转化效果40%, 规模30%)
            cost_score = 100 if cost == 0 else min(100, 1000000 / cost)  # 成本越低越好
            conversion_score = ((clicks / impressions * 100) if impressions > 0 else 0) * 2 + \
                              ((leads / clicks * 100) if clicks > 0 else 0) * 5 + \
                              ((new_accounts / leads * 100) if leads > 0 else 0) * 10
            scale_score = min(100, new_accounts / 10)

            overall_score = cost_score * 0.3 + conversion_score * 0.4 + scale_score * 0.3

            agency_ranking.append({
                'agency': agency,
                'metrics': {
                    'cost': cost,
                    'impressions': impressions,
                    'clicks': clicks,
                    'leads': leads,
                    'new_accounts': new_accounts,
                    'ctr': (clicks / impressions * 100) if impressions > 0 else 0,
                    'lead_rate': (leads / clicks * 100) if clicks > 0 else 0,
                    'account_rate': (new_accounts / leads * 100) if leads > 0 else 0,
                    'cost_per_lead': (cost / leads) if leads > 0 else 0,
                    'cost_per_account': (cost / new_accounts) if new_accounts > 0 else 0
                },
                'score': round(overall_score, 2)
            })

        # 按评分排序
        agency_ranking.sort(key=lambda x: x['score'], reverse=True)

        # 3. 业务模式分析
        business_model_analysis = []
        bm_stats = {}
        for record in records:
            bm = record.business_model or '未知'
            if bm not in bm_stats:
                bm_stats[bm] = {
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': 0,
                    'new_accounts': 0
                }
            bm_stats[bm]['cost'] += record.cost or 0
            bm_stats[bm]['impressions'] += record.impressions or 0
            bm_stats[bm]['clicks'] += record.clicks or 0
            bm_stats[bm]['leads'] += record.lead_users or 0
            bm_stats[bm]['new_accounts'] += record.opened_account_users or 0

        for bm, stats in bm_stats.items():
            cost = stats['cost']
            impressions = stats['impressions']
            clicks = stats['clicks']
            leads = stats['leads']
            new_accounts = stats['new_accounts']

            business_model_analysis.append({
                'business_model': bm,
                'metrics': {
                    'cost': cost,
                    'impressions': impressions,
                    'clicks': clicks,
                    'leads': leads,
                    'new_accounts': new_accounts,
                    'ctr': (clicks / impressions * 100) if impressions > 0 else 0,
                    'lead_rate': (leads / clicks * 100) if clicks > 0 else 0,
                    'account_rate': (new_accounts / leads * 100) if leads > 0 else 0,
                    'roi': ((new_accounts * 10000 - cost) / cost * 100) if cost > 0 else 0  # 假设每个客户价值10000元
                }
            })

        # 4. ROI分析
        total_cost = sum(r.cost or 0 for r in records)
        total_impressions = sum(r.impressions or 0 for r in records)
        total_clicks = sum(r.clicks or 0 for r in records)
        total_leads = sum(r.lead_users or 0 for r in records)
        total_accounts = sum(r.opened_account_users or 0 for r in records)

        roi_analysis = {
            'total_investment': total_cost,
            'total_returns': total_accounts * 10000,  # 假设每个客户价值10000元
            'roi': ((total_accounts * 10000 - total_cost) / total_cost * 100) if total_cost > 0 else 0,
            'break_even_accounts': (total_cost / 10000) if total_cost > 0 else 0,
            'current_accounts': total_accounts,
            'profit_loss': (total_accounts * 10000 - total_cost) if total_accounts > 0 else -total_cost,
            'metrics': {
                'cost_per_impression': (total_cost / total_impressions) if total_impressions > 0 else 0,
                'cost_per_click': (total_cost / total_clicks) if total_clicks > 0 else 0,
                'cost_per_lead': (total_cost / total_leads) if total_leads > 0 else 0,
                'cost_per_account': (total_cost / total_accounts) if total_accounts > 0 else 0,
                'revenue_per_account': 10000,  # 假设值
                'ltv_ratio': 5  # 假设LTV是CAC的5倍
            }
        }

        # 5. 趋势洞察
        # 按日期分组
        from collections import defaultdict
        daily_stats = defaultdict(lambda: {
            'cost': 0,
            'impressions': 0,
            'clicks': 0,
            'leads': 0,
            'new_accounts': 0
        })

        for record in records:
            daily_stats[record.date]['cost'] += record.cost or 0
            daily_stats[record.date]['impressions'] += record.impressions or 0
            daily_stats[record.date]['clicks'] += record.clicks or 0
            daily_stats[record.date]['leads'] += record.lead_users or 0
            daily_stats[record.date]['new_accounts'] += record.opened_account_users or 0

        sorted_dates = sorted(daily_stats.keys())

        # 计算趋势
        if len(sorted_dates) >= 2:
            first_half = sorted_dates[:len(sorted_dates)//2]
            second_half = sorted_dates[len(sorted_dates)//2:]

            first_half_avg_cost = sum(daily_stats[d]['cost'] for d in first_half) / len(first_half)
            second_half_avg_cost = sum(daily_stats[d]['cost'] for d in second_half) / len(second_half)

            cost_trend = ((second_half_avg_cost - first_half_avg_cost) / first_half_avg_cost * 100) if first_half_avg_cost > 0 else 0

            first_half_avg_ctr = sum(daily_stats[d]['clicks'] / daily_stats[d]['impressions'] * 100
                                   if daily_stats[d]['impressions'] > 0 else 0
                                   for d in first_half) / len(first_half)
            second_half_avg_ctr = sum(daily_stats[d]['clicks'] / daily_stats[d]['impressions'] * 100
                                    if daily_stats[d]['impressions'] > 0 else 0
                                    for d in second_half) / len(second_half)

            ctr_trend = ((second_half_avg_ctr - first_half_avg_ctr) / first_half_avg_ctr * 100) if first_half_avg_ctr > 0 else 0
        else:
            cost_trend = 0
            ctr_trend = 0

        trend_insights = {
            'dates': sorted_dates,
            'cost_trend': round(cost_trend, 2),
            'ctr_trend': round(ctr_trend, 2),
            'insights': [
                f"{'成本上升' if cost_trend > 0 else '成本下降'}了 {abs(cost_trend):.2f}%",
                f"{'点击率提升' if ctr_trend > 0 else '点击率下降'}了 {abs(ctr_trend):.2f}%",
                f"平均每日成本: {total_cost / len(sorted_dates) / 10000:.2f}万元" if sorted_dates else "无数据"
            ],
            'recommendations': []
        }

        # 生成建议
        if cost_trend > 20:
            trend_insights['recommendations'].append("成本上升趋势明显，建议优化投放策略")
        if ctr_trend < -10:
            trend_insights['recommendations'].append("点击率下降，建议优化素材和定向")
        if total_leads > 0 and (total_cost / total_leads) > 500:
            trend_insights['recommendations'].append("线索成本偏高，建议优化转化链路")

        # 6. 性能矩阵 (平台 x 代理商)
        performance_matrix = []
        matrix_stats = {}
        for record in records:
            key = (record.platform, record.agency)
            if key not in matrix_stats:
                matrix_stats[key] = {
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': 0,
                    'new_accounts': 0
                }
            matrix_stats[key]['cost'] += record.cost or 0
            matrix_stats[key]['impressions'] += record.impressions or 0
            matrix_stats[key]['clicks'] += record.clicks or 0
            matrix_stats[key]['leads'] += record.lead_users or 0
            matrix_stats[key]['new_accounts'] += record.opened_account_users or 0

        for (platform, agency), stats in matrix_stats.items():
            cost = stats['cost']
            impressions = stats['impressions']
            clicks = stats['clicks']
            leads = stats['leads']
            new_accounts = stats['new_accounts']

            performance_matrix.append({
                'platform': platform,
                'agency': agency,
                'metrics': {
                    'cost': cost,
                    'impressions': impressions,
                    'clicks': clicks,
                    'leads': leads,
                    'new_accounts': new_accounts,
                    'ctr': (clicks / impressions * 100) if impressions > 0 else 0,
                    'lead_rate': (leads / clicks * 100) if clicks > 0 else 0,
                    'account_rate': (new_accounts / leads * 100) if leads > 0 else 0,
                    'cost_per_account': (cost / new_accounts) if new_accounts > 0 else 0
                }
            })

        return jsonify({
            'platform_comparison': platform_comparison,
            'agency_ranking': agency_ranking,
            'business_model_analysis': business_model_analysis,
            'roi_analysis': roi_analysis,
            'trend_insights': trend_insights,
            'performance_matrix': performance_matrix
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



