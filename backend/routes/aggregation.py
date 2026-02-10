# -*- coding: utf-8 -*-
"""
省心投 BI - 聚合表管理API

提供聚合表的手动更新、状态查询等功能
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import sqlalchemy as sa

from backend.database import db
from backend.models import DailyMetricsUnified

bp = Blueprint('aggregation', __name__)


@bp.route('/api/v1/aggregation/update', methods=['POST'])
def update_aggregation():
    """
    手动触发聚合表更新

    请求参数:
        start_date: 开始日期 (可选，格式: YYYY-MM-DD，默认为最早数据日期)
        end_date: 结束日期 (可选，格式: YYYY-MM-DD，默认为最新数据日期)

    返回:
        success: 是否成功
        message: 提示消息
        data: 更新统计
    """
    try:
        # 获取日期参数
        data = request.get_json() or {}
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        # 如果没有指定日期，更新所有数据
        if not start_date or not end_date:
            # 获取聚合表的日期范围
            result = db.session.query(
                sa.func.min(DailyMetricsUnified.date).label('min_date'),
                sa.func.max(DailyMetricsUnified.date).label('max_date')
            ).first()

            # 扩展到更早的日期（确保覆盖所有底表数据）
            start_date = '2024-01-01'  # 设置一个足够早的日期
            end_date = datetime.now().strftime('%Y-%m-%d')
        else:
            # 验证日期格式
            try:
                datetime.strptime(start_date, '%Y-%m-%d')
                datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'INVALID_DATE_FORMAT',
                    'message': '日期格式错误，应为 YYYY-MM-DD'
                }), 400

        # 获取更新前的记录数
        count_before = DailyMetricsUnified.query.count()

        # 延迟导入以避免循环导入
        from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics

        # 执行聚合更新
        update_daily_metrics(start_date, end_date)

        # 获取更新后的记录数
        count_after = DailyMetricsUnified.query.count()

        # 获取日期范围
        date_range = db.session.query(
            sa.func.min(DailyMetricsUnified.date).label('min_date'),
            sa.func.max(DailyMetricsUnified.date).label('max_date')
        ).first()

        return jsonify({
            'success': True,
            'message': '聚合表更新成功',
            'data': {
                'start_date': str(date_range.min_date),
                'end_date': str(date_range.max_date),
                'total_records': count_after,
                'records_added': count_after - count_before
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'AGGREGATION_ERROR',
            'message': f'聚合表更新失败: {str(e)}'
        }), 500


@bp.route('/api/v1/aggregation/status', methods=['GET'])
def get_aggregation_status():
    """
    获取聚合表状态信息

    返回:
        success: 是否成功
        data: 聚合表状态
            - total_records: 总记录数
            - date_range: 日期范围
            - platforms: 各平台记录数
            - last_updated: 最后更新时间
    """
    try:
        # 总记录数
        total = DailyMetricsUnified.query.count()

        # 日期范围
        date_range = db.session.query(
            sa.func.min(DailyMetricsUnified.date).label('min_date'),
            sa.func.max(DailyMetricsUnified.date).label('max_date')
        ).first()

        # 各平台记录数
        platforms = db.session.query(
            DailyMetricsUnified.platform,
            sa.func.count(DailyMetricsUnified.id).label('count')
        ).group_by(DailyMetricsUnified.platform).all()

        # 最后更新时间
        last_updated = db.session.query(
            sa.func.max(DailyMetricsUnified.updated_at)
        ).scalar()

        # 数据汇总
        summary = db.session.query(
            sa.func.sum(DailyMetricsUnified.cost).label('total_cost'),
            sa.func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            sa.func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
            sa.func.sum(DailyMetricsUnified.lead_users).label('total_leads'),
            sa.func.sum(DailyMetricsUnified.opened_account_users).label('total_opened')
        ).first()

        return jsonify({
            'success': True,
            'data': {
                'total_records': total,
                'date_range': {
                    'start': str(date_range.min_date),
                    'end': str(date_range.max_date)
                },
                'platforms': [
                    {'platform': p, 'count': c}
                    for p, c in platforms
                ],
                'last_updated': str(last_updated) if last_updated else None,
                'summary': {
                    'total_cost': float(summary.total_cost or 0),
                    'total_impressions': int(summary.total_impressions or 0),
                    'total_click_users': int(summary.total_click_users or 0),
                    'total_leads': int(summary.total_leads or 0),
                    'total_opened': int(summary.total_opened or 0)
                }
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'QUERY_ERROR',
            'message': f'查询聚合表状态失败: {str(e)}'
        }), 500
