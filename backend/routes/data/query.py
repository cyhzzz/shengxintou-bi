# -*- coding: utf-8 -*-
"""
数据查询API接口 - 通用查询、汇总、转化数据测试
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
bp = Blueprint('query', __name__)

@bp.route('/query', methods=['POST'])
def query_data():
    """
    通用数据查询接口
    支持多维度聚合查询

    请求体:
    {
        "dimensions": ["date", "platform", "agency", "business_model"],
        "metrics": ["cost", "impressions", "clicks", "leads", "new_accounts"],
        "filters": {
            "date_range": ["2025-01-01", "2025-01-31"],
            "platforms": ["腾讯", "抖音"],
            "agencies": ["量子", "众联"],
            "business_models": ["直播", "信息流"]
        },
        "granularity": "daily",  # daily/summary
        "order_by": {"date": "asc"},
        "limit": 1000
    }
    """
    from backend.database import db

    # 获取请求参数
    data = request.get_json()

    if not data:
        return jsonify({'error': '请求体不能为空'}), 400

    dimensions = data.get('dimensions', [])
    metrics = data.get('metrics', ['cost', 'impressions', 'clicks', 'leads', 'new_accounts'])
    filters = data.get('filters', {})
    granularity = data.get('granularity', 'daily')
    limit = data.get('limit', 1000)

    # 检查是否请求资产和客户贡献指标
    needs_conversion_data = 'customer_assets' in metrics or 'customer_contribution' in metrics

    # 添加调试日志
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f'[query_data] 请求的metrics: {metrics}')
    logger.info(f'[query_data] needs_conversion_data: {needs_conversion_data}')

    # 构建基础查询
    query = db.session.query(
        DailyMetricsUnified
    )

    # 应用筛选条件
    if 'date_range' in filters and filters['date_range']:
        start_date = filters['date_range'][0]
        end_date = filters['date_range'][1]
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

    # 根据粒度聚合
    if granularity == 'summary':
        # 汇总查询：按维度聚合
        group_by_columns = []

        if 'platform' in dimensions:
            group_by_columns.append(DailyMetricsUnified.platform)
        if 'agency' in dimensions:
            group_by_columns.append(DailyMetricsUnified.agency)
        if 'business_model' in dimensions:
            group_by_columns.append(DailyMetricsUnified.business_model)

        # 构建聚合选择
        aggregations = []
        if 'platform' in dimensions:
            aggregations.append(DailyMetricsUnified.platform)
        if 'agency' in dimensions:
            aggregations.append(DailyMetricsUnified.agency)
        if 'business_model' in dimensions:
            aggregations.append(DailyMetricsUnified.business_model)

        # 添加指标聚合
        for metric in metrics:
            if hasattr(DailyMetricsUnified, metric):
                aggregations.append(func.sum(getattr(DailyMetricsUnified, metric)).label(metric))

        # 重建查询
        query = db.session.query(*aggregations)

        # 重新应用筛选条件（因为重建了查询）
        if 'date_range' in filters and filters['date_range']:
            start_date = filters['date_range'][0]
            end_date = filters['date_range'][1]
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

        # 分组（如果有维度）
        if group_by_columns:
            query = query.group_by(*group_by_columns)

    # 执行查询
    try:
        results = query.limit(limit).all()

        # 查询客户资产和客户贡献（总是查询，支持前端显示）
        conversion_metrics = {}

        logger.info(f'[query_data] 开始查询客户资产和客户贡献数据...')

        try:
            # SQLite使用||操作符连接字符串
            # 构建用户唯一标识符用于去重
            user_identifier_expr = (
                BackendConversions.platform_source + '|' +
                func.coalesce(BackendConversions.wechat_nickname, '') + '|' +
                func.coalesce(BackendConversions.capital_account, '') + '|' +
                func.coalesce(BackendConversions.platform_user_id, '')
            ).label('user_identifier')

            # 构建转化数据查询 - 分别统计新开客户和存量客户
            # 新开客户（is_opened_account=1）
            new_customers_query = db.session.query(
                func.sum(BackendConversions.assets).label('total_assets'),
                func.sum(BackendConversions.customer_contribution).label('total_contribution'),
                func.count(func.distinct(user_identifier_expr)).label('unique_users')
            ).filter(
                BackendConversions.lead_date.isnot(None),
                BackendConversions.is_opened_account == True
            )

            # 存量客户（is_opened_account=0）
            existing_customers_query = db.session.query(
                func.sum(BackendConversions.assets).label('total_assets'),
                func.count(func.distinct(user_identifier_expr)).label('unique_users')
            ).filter(
                BackendConversions.lead_date.isnot(None),
                BackendConversions.is_opened_account == False,
                BackendConversions.assets.isnot(None),
                BackendConversions.assets > 0
            )

            logger.info(f'[query_data] 转化基础查询构建完成，开始应用筛选条件...')

            # 应用日期筛选条件
            if 'date_range' in filters and filters['date_range']:
                start_date = filters['date_range'][0]
                end_date = filters['date_range'][1]
                new_customers_query = new_customers_query.filter(
                    and_(
                        BackendConversions.lead_date >= start_date,
                        BackendConversions.lead_date <= end_date
                    )
                )
                existing_customers_query = existing_customers_query.filter(
                    and_(
                        BackendConversions.lead_date >= start_date,
                        BackendConversions.lead_date <= end_date
                    )
                )
                logger.info(f'[query_data] 应用日期筛选: {start_date} 到 {end_date}')

            # 应用平台筛选条件
            if 'platforms' in filters and filters['platforms']:
                new_customers_query = new_customers_query.filter(
                    BackendConversions.platform_source.in_(filters['platforms'])
                )
                existing_customers_query = existing_customers_query.filter(
                    BackendConversions.platform_source.in_(filters['platforms'])
                )
                logger.info(f'[query_data] 应用平台筛选: {filters["platforms"]}')

            # 应用代理商筛选条件
            if 'agencies' in filters and filters['agencies']:
                new_customers_query = new_customers_query.filter(
                    BackendConversions.agency.in_(filters['agencies'])
                )
                existing_customers_query = existing_customers_query.filter(
                    BackendConversions.agency.in_(filters['agencies'])
                )
                logger.info(f'[query_data] 应用代理商筛选: {filters["agencies"]}')

            logger.info(f'[query_data] 筛选条件应用完成')

        except Exception as e:
            logger.error(f'[query_data] 构建转化查询时出错: {str(e)}')
            import traceback
            logger.error(f'[query_data] 错误堆栈: {traceback.format_exc()}')
            raise

        # 执行查询
        try:
            logger.info(f'[query_data] 准备执行新开客户数据查询...')
            new_customers_result = new_customers_query.first()
            logger.info(f'[query_data] 新开客户查询完成')

            logger.info(f'[query_data] 准备执行存量客户数据查询...')
            existing_customers_result = existing_customers_query.first()
            logger.info(f'[query_data] 存量客户查询完成')
        except Exception as e:
            logger.error(f'[query_data] 执行转化数据查询时出错: {str(e)}')
            import traceback
            logger.error(f'[query_data] 错误堆栈: {traceback.format_exc()}')
            raise

        # 处理新开客户数据
        if new_customers_result:
            conversion_metrics = {
                'customer_assets': float(new_customers_result.total_assets) if new_customers_result.total_assets else 0,
                'customer_contribution': float(new_customers_result.total_contribution) if new_customers_result.total_contribution else 0,
                'unique_users': int(new_customers_result.unique_users) if new_customers_result.unique_users else 0
            }
            logger.info(f'[query_data] ✓ 新开客户数据查询成功: customer_assets={conversion_metrics["customer_assets"]}, customer_contribution={conversion_metrics["customer_contribution"]}')
        else:
            logger.warning('[query_data] ✗ 新开客户数据查询结果为空，已设置为0')
            conversion_metrics = {
                'customer_assets': 0,
                'customer_contribution': 0,
                'unique_users': 0
            }

        # 处理存量客户资产数据
        if existing_customers_result:
            conversion_metrics['existing_customers_assets'] = float(existing_customers_result.total_assets) if existing_customers_result.total_assets else 0
            conversion_metrics['existing_customers_users'] = int(existing_customers_result.unique_users) if existing_customers_result.unique_users else 0
            logger.info(f'[query_data] ✓ 存量客户资产查询成功: existing_customers_assets={conversion_metrics["existing_customers_assets"]}, existing_customers_users={conversion_metrics["existing_customers_users"]}')
        else:
            conversion_metrics['existing_customers_assets'] = 0
            conversion_metrics['existing_customers_users'] = 0
            logger.warning('[query_data] ✗ 存量客户资产查询结果为空，已设置为0')

        # 转换结果为JSON
        output = []
        for row in results:
            item = {}

            if granularity == 'daily':
                # 日级数据
                item = {
                    'date': row.date.strftime('%Y-%m-%d') if row.date else None,
                    'platform': row.platform,
                    'account_id': row.account_id,
                    'account_name': row.account_name,
                    'agency': row.agency,
                    'business_model': row.business_model,
                    'metrics': {
                        'cost': float(row.cost) if row.cost else 0,
                        'impressions': int(row.impressions) if row.impressions else 0,
                        'clicks': int(row.clicks) if row.clicks else 0,
                        'leads': int(row.leads) if row.leads else 0,
                        'new_accounts': int(row.new_accounts) if row.new_accounts else 0
                    }
                }
            elif granularity == 'summary':
                # 汇总数据
                item = {}

                # 添加维度字段（如果有）
                if 'platform' in dimensions:
                    item['platform'] = row.platform
                if 'agency' in dimensions:
                    item['agency'] = row.agency
                if 'business_model' in dimensions:
                    item['business_model'] = row.business_model

                # 添加指标
                item['metrics'] = {}
                for metric in metrics:
                    if hasattr(row, metric):
                        val = getattr(row, metric)
                        item['metrics'][metric] = float(val) if val else 0

                # 如果是汇总且无维度（单一结果行），添加客户资产、客户贡献和存量客户资产
                if not dimensions:
                    item['metrics']['customer_assets'] = conversion_metrics.get('customer_assets', 0)
                    item['metrics']['customer_contribution'] = conversion_metrics.get('customer_contribution', 0)
                    item['metrics']['existing_customers_assets'] = conversion_metrics.get('existing_customers_assets', 0)
                    logger.info(f'[query_data] ✓ 已添加客户资产、贡献和存量资产到metrics: customer_assets={item["metrics"]["customer_assets"]}, customer_contribution={item["metrics"]["customer_contribution"]}, existing_customers_assets={item["metrics"]["existing_customers_assets"]}')

            output.append(item)

        # 添加调试日志
        if needs_conversion_data:
            logger.info(f'[query_data] 返回数据 (包含转化指标): total={len(output)}, first_item_metrics={output[0]["metrics"] if output else "N/A"}')

        return jsonify({
            'success': True,
            'data': output,
            'total': len(output),
            'query': data  # 返回查询参数用于调试
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}'
        }), 500



@bp.route('/test/conversion-data', methods=['GET'])
def test_conversion_data():
    """
    测试接口：查询客户资产和客户贡献数据
    返回原始数据用于调试
    """
    from backend.database import db
    from sqlalchemy import func

    try:
        # 查询总资产和总贡献（SQLite使用||连接字符串）
        result = db.session.query(
            func.sum(BackendConversions.assets).label('total_assets'),
            func.sum(BackendConversions.customer_contribution).label('total_contribution'),
            func.count(func.distinct(
                BackendConversions.platform_source + '|' +
                func.coalesce(BackendConversions.wechat_nickname, '') + '|' +
                func.coalesce(BackendConversions.capital_account, '') + '|' +
                func.coalesce(BackendConversions.platform_user_id, '')
            )).label('unique_users'),
            func.count().label('total_records')
        ).first()

        # 查询有资产的记录数（SQLite使用||连接字符串）
        with_assets = db.session.query(
            func.count(func.distinct(
                BackendConversions.platform_source + '|' +
                func.coalesce(BackendConversions.wechat_nickname, '') + '|' +
                func.coalesce(BackendConversions.capital_account, '') + '|' +
                func.coalesce(BackendConversions.platform_user_id, '')
            )).label('unique_users')
        ).filter(
            BackendConversions.assets.isnot(None),
            BackendConversions.assets > 0
        ).scalar()

        # 查询有贡献的记录数（SQLite使用||连接字符串）
        with_contribution = db.session.query(
            func.count(func.distinct(
                BackendConversions.platform_source + '|' +
                func.coalesce(BackendConversions.wechat_nickname, '') + '|' +
                func.coalesce(BackendConversions.capital_account, '') + '|' +
                func.coalesce(BackendConversions.platform_user_id, '')
            )).label('unique_users')
        ).filter(
            BackendConversions.customer_contribution.isnot(None),
            BackendConversions.customer_contribution > 0
        ).scalar()

        # 返回结果
        return jsonify({
            'success': True,
            'data': {
                'total_assets': float(result.total_assets) if result.total_assets else 0,
                'total_contribution': float(result.total_contribution) if result.total_contribution else 0,
                'unique_users_with_assets': int(with_assets) if with_assets else 0,
                'unique_users_with_contribution': int(with_contribution) if with_contribution else 0,
                'total_records': int(result.total_records) if result.total_records else 0,
                'unique_users_total': int(result.unique_users) if result.unique_users else 0
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/summary', methods=['POST'])
def get_summary():
    """
    获取汇总数据
    按平台、代理商、业务模式汇总
    """
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 构建查询
        query = db.session.query(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.business_model,
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

        # 分组
        query = query.group_by(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.business_model
        )

        results = query.all()

        # 转换结果
        output = []
        for row in results:
            output.append({
                'platform': row.platform,
                'agency': row.agency,
                'business_model': row.business_model,
                'metrics': {
                    'cost': float(row.total_cost) if row.total_cost else 0,
                    'impressions': int(row.total_impressions) if row.total_impressions else 0,
                    'clicks': int(row.total_clicks) if row.total_clicks else 0,
                    'leads': int(row.total_leads) if row.total_leads else 0,
                    'new_accounts': int(row.total_new_accounts) if row.total_new_accounts else 0
                }
            })

        return jsonify({
            'data': output,
            'total': len(output)
        })

    except Exception as e:
        return jsonify({
            'error': f'查询失败: {str(e)}'
        }), 500



