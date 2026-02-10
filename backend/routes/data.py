# -*- coding: utf-8 -*-
"""
省心投 BI - 数据查询API接口
提供数据聚合查询功能
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
from datetime import datetime, date, timedelta

bp = Blueprint('data', __name__)


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


@bp.route('/xhs-notes-analysis', methods=['POST'])
def get_xhs_notes_analysis():
    """
    小红书笔记分析
    返回笔记互动数据和趋势
    """
    from backend.database import db
    from backend.models import XhsNotesDaily

    data = request.get_json()
    filters = data.get('filters', {})
    page = data.get('page', 1)
    page_size = data.get('page_size', 50)

    try:
        # 构建基础查询
        query = db.session.query(XhsNotesDaily)

        # 应用筛选条件
        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                and_(
                    XhsNotesDaily.date >= filters['date_range'][0],
                    XhsNotesDaily.date <= filters['date_range'][1]
                )
            )

        # 获取总数
        total = query.count()

        # 分页查询
        notes = query.order_by(
            XhsNotesDaily.date.desc(),
            XhsNotesDaily.cost.desc()
        ).limit(page_size).offset((page - 1) * page_size).all()

        # 转换结果
        notes_data = []
        for note in notes:
            notes_data.append({
                'date': note.date.strftime('%Y-%m-%d') if note.date else None,
                'note_id': note.note_id,
                'note_url': note.note_url,
                'delivery_mode': note.delivery_mode,
                'metrics': {
                    'cost': float(note.cost) if note.cost else 0,
                    'impressions': int(note.impressions) if note.impressions else 0,
                    'clicks': int(note.clicks) if note.clicks else 0,
                    'likes': int(note.likes) if note.likes else 0,
                    'comments': int(note.comments) if note.comments else 0,
                    'favorites': int(note.favorites) if note.favorites else 0,
                    'shares': int(note.shares) if note.shares else 0,
                    'total_interactions': int(note.total_interactions) if note.total_interactions else 0,
                    'action_button_clicks': int(note.action_button_clicks) if note.action_button_clicks else 0
                },
                'rates': {
                    'click_rate': float(note.click_rate) if note.click_rate else 0,
                    'avg_click_cost': float(note.avg_click_cost) if note.avg_click_cost else 0,
                    'avg_cpm': float(note.avg_cpm) if note.avg_cpm else 0,
                    'avg_interaction_cost': float(note.avg_interaction_cost) if note.avg_interaction_cost else 0
                }
            })

        # 获取汇总数据
        summary_query = db.session.query(
            func.sum(XhsNotesDaily.cost).label('total_cost'),
            func.sum(XhsNotesDaily.impressions).label('total_impressions'),
            func.sum(XhsNotesDaily.clicks).label('total_clicks'),
            func.sum(XhsNotesDaily.total_interactions).label('total_interactions'),
            func.sum(XhsNotesDaily.action_button_clicks).label('total_conversions'),
            func.count(XhsNotesDaily.note_id).label('total_notes')
        )

        if 'date_range' in filters and filters['date_range']:
            summary_query = summary_query.filter(
                and_(
                    XhsNotesDaily.date >= filters['date_range'][0],
                    XhsNotesDaily.date <= filters['date_range'][1]
                )
            )

        summary = summary_query.first()

        summary_data = {
            'total_cost': float(summary.total_cost) if summary.total_cost else 0,
            'total_impressions': int(summary.total_impressions) if summary.total_impressions else 0,
            'total_clicks': int(summary.total_clicks) if summary.total_clicks else 0,
            'total_interactions': int(summary.total_interactions) if summary.total_interactions else 0,
            'total_conversions': int(summary.total_conversions) if summary.total_conversions else 0,
            'total_notes': int(summary.total_notes) if summary.total_notes else 0,
            'avg_cost_per_note': (float(summary.total_cost) / int(summary.total_notes)) if summary.total_notes > 0 else 0,
            'avg_interaction_rate': ((int(summary.total_clicks) / int(summary.total_impressions)) * 100) if summary.total_impressions > 0 else 0,
            'avg_conversion_cost': (float(summary.total_cost) / int(summary.total_conversions)) if summary.total_conversions > 0 else 0
        }

        return jsonify({
            'notes': notes_data,
            'summary': summary_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/xhs-notes-list', methods=['POST'])
def get_xhs_notes_list():
    """
    小红书笔记列表 (使用聚合表 DailyNotesMetricsUnified)
    返回分页的笔记数据，支持筛选

    聚合逻辑：
    - 按 note_id 分组，将多日期数据聚合为笔记级数据
    - 数值字段求和：cost, impressions, clicks, interactions, lead_users等
    - 维度字段取最大值：note_title, creator_name, producer, ad_strategy等

    更新说明:
    - 使用 daily_notes_metrics_unified 聚合表
    - 支持笔记级数据（每个笔记一条记录，多日期聚合）
    - 支持转化数据（加粉量、开户量等）
    - 支持总量/投放量/自然量拆分
    """
    from backend.database import db
    from sqlalchemy import func

    data = request.get_json()
    filters = data.get('filters', {})
    page = data.get('page', 1)
    page_size = data.get('page_size', 50)

    print('=== [DEBUG] 小红书笔记列表 API ===')
    print(f'[DEBUG] 接收到的筛选条件: {filters}')
    print(f'[DEBUG] 分页参数: page={page}, page_size={page_size}')

    try:
        # 构建基础查询（应用筛选条件）
        base_query = db.session.query(DailyNotesMetricsUnified)

        # 应用筛选条件
        # 数据时间筛选（data_date）
        if 'date_range' in filters and filters['date_range']:
            base_query = base_query.filter(
                and_(
                    DailyNotesMetricsUnified.date >= filters['date_range'][0],
                    DailyNotesMetricsUnified.date <= filters['date_range'][1]
                )
            )

        # 发布时间筛选（note_publish_time）
        if 'publish_date_range' in filters and filters['publish_date_range']:
            base_query = base_query.filter(
                and_(
                    func.date(DailyNotesMetricsUnified.note_publish_time) >= filters['publish_date_range'][0],
                    func.date(DailyNotesMetricsUnified.note_publish_time) <= filters['publish_date_range'][1]
                )
            )

        # 创作者筛选（只使用 producer）
        if 'creator' in filters and filters['creator'] and filters['creator'] != 'all':
            base_query = base_query.filter(
                DailyNotesMetricsUnified.producer == filters['creator']
            )

        # 创作者多选筛选（creators）
        if 'creators' in filters and filters['creators'] and isinstance(filters['creators'], list) and len(filters['creators']) > 0:
            base_query = base_query.filter(
                DailyNotesMetricsUnified.producer.in_(filters['creators'])
            )

        # 广告策略多选筛选（ad_strategies）
        if 'ad_strategies' in filters and filters['ad_strategies'] and isinstance(filters['ad_strategies'], list) and len(filters['ad_strategies']) > 0:
            base_query = base_query.filter(
                DailyNotesMetricsUnified.ad_strategy.in_(filters['ad_strategies'])
            )

        # 内容类型多选筛选（content_types）
        if 'content_types' in filters and filters['content_types'] and isinstance(filters['content_types'], list) and len(filters['content_types']) > 0:
            base_query = base_query.filter(
                DailyNotesMetricsUnified.note_type.in_(filters['content_types'])
            )

        # 笔记账号筛选（account）
        if 'account' in filters and filters['account'] and filters['account'] != '全部':
            base_query = base_query.filter(
                DailyNotesMetricsUnified.publish_account == filters['account']
            )

        # 投放类型筛选（通过 cost > 0 判断是否有投放）
        if 'is_ad' in filters and filters['is_ad'] and filters['is_ad'] != 'all':
            if filters['is_ad'] == 'true':
                base_query = base_query.filter(DailyNotesMetricsUnified.cost > 0)
            else:
                base_query = base_query.filter(DailyNotesMetricsUnified.cost == 0)

        # 笔记级聚合查询（按 note_id 分组）
        aggregated_query = base_query.with_entities(
            DailyNotesMetricsUnified.note_id,
            # 维度字段取最大值
            func.max(DailyNotesMetricsUnified.note_title).label('note_title'),
            func.max(DailyNotesMetricsUnified.producer).label('producer'),
            func.max(DailyNotesMetricsUnified.publish_account).label('publish_account'),
            func.max(DailyNotesMetricsUnified.ad_strategy).label('ad_strategy'),
            func.max(DailyNotesMetricsUnified.note_type).label('note_type'),
            func.max(DailyNotesMetricsUnified.note_publish_time).label('note_publish_time'),
            func.max(DailyNotesMetricsUnified.note_url).label('note_url'),
            # 数值字段求和
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.total_impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.total_clicks).label('total_clicks'),
            func.sum(DailyNotesMetricsUnified.total_interactions).label('total_interactions'),
            func.sum(DailyNotesMetricsUnified.total_likes).label('total_likes'),
            func.sum(DailyNotesMetricsUnified.total_comments).label('total_comments'),
            func.sum(DailyNotesMetricsUnified.total_favorites).label('total_favorites'),
            func.sum(DailyNotesMetricsUnified.total_shares).label('total_shares'),
            func.sum(DailyNotesMetricsUnified.total_private_messages).label('total_private_messages'),
            # 投放量拆分（求和）
            func.sum(DailyNotesMetricsUnified.ad_impressions).label('ad_impressions'),
            func.sum(DailyNotesMetricsUnified.organic_impressions).label('organic_impressions'),
            func.sum(DailyNotesMetricsUnified.ad_clicks).label('ad_clicks'),
            func.sum(DailyNotesMetricsUnified.organic_clicks).label('organic_clicks'),
            func.sum(DailyNotesMetricsUnified.ad_interactions).label('ad_interactions'),
            func.sum(DailyNotesMetricsUnified.organic_interactions).label('organic_interactions'),
            # 转化指标（求和）
            func.sum(DailyNotesMetricsUnified.lead_users).label('lead_users'),
            func.sum(DailyNotesMetricsUnified.customer_mouth_users).label('customer_mouth_users'),
            func.sum(DailyNotesMetricsUnified.valid_lead_users).label('valid_lead_users'),
            func.sum(DailyNotesMetricsUnified.opened_account_users).label('opened_account_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('valid_customer_users'),
            func.sum(DailyNotesMetricsUnified.customer_assets_users).label('customer_assets_users'),
            func.sum(DailyNotesMetricsUnified.customer_assets_amount).label('customer_assets_amount')
        ).group_by(DailyNotesMetricsUnified.note_id)

        # 获取总数（先查询不分组的基础记录，然后统计唯一笔记数）
        from sqlalchemy import distinct
        total_query = base_query.with_entities(func.count(distinct(DailyNotesMetricsUnified.note_id)))
        total = total_query.scalar()

        # 分页查询（按总花费降序排序）
        notes = aggregated_query.order_by(
            func.sum(DailyNotesMetricsUnified.cost).desc()
        ).limit(page_size).offset((page - 1) * page_size).all()

        # 转换结果
        notes_data = []
        for note in notes:
            # 判断是否为投放笔记
            is_ad = note.total_cost and note.total_cost > 0

            # 计算点击率
            click_rate = 0
            if note.total_impressions and note.total_impressions > 0:
                click_rate = round(float(note.total_clicks) / float(note.total_impressions) * 100, 2)

            # 计算推广点击率
            ad_click_rate = 0
            if note.ad_impressions and note.ad_impressions > 0:
                ad_click_rate = round(float(note.ad_clicks) / float(note.ad_impressions) * 100, 2)

            # 计算加微成本（添加企微人数=开口量，简化处理）
            # TODO: 需要确认添加企微人数的字段来源
            add_wechat_cost = 0
            if note.customer_mouth_users and note.customer_mouth_users > 0:
                add_wechat_cost = round(float(note.total_cost) / float(note.customer_mouth_users), 2)

            # 计算开户成本
            open_account_cost = 0
            if note.opened_account_users and note.opened_account_users > 0:
                open_account_cost = round(float(note.total_cost) / float(note.opened_account_users), 2)

            notes_data.append({
                'note_id': note.note_id,
                'note_name': note.note_title or '未知笔记',
                # 笔记类型（内容类型：图文笔记/视频笔记）
                'note_type': note.note_type or '未知',
                # 内容类型（与note_type相同）
                'content_type': note.note_type or '未知',
                # 广告策略（品宣/开户权益/基础知识投教）
                'ad_strategy': note.ad_strategy or '未知',
                'producer': note.producer or '未知',
                'publish_account': note.publish_account or '',
                'publish_time': note.note_publish_time.strftime('%Y-%m-%d %H:%M') if note.note_publish_time else '',
                # 使用总量（投放+自然）
                'exposure': int(note.total_impressions) if note.total_impressions else 0,
                'reads': int(note.total_clicks) if note.total_clicks else 0,
                'interactions': int(note.total_interactions) if note.total_interactions else 0,
                'ad_spend': float(note.total_cost) if note.total_cost else 0,
                'is_ad': is_ad,
                'note_link': note.note_url,
                # 互动指标
                'likes': int(note.total_likes) if note.total_likes else 0,
                'comments': int(note.total_comments) if note.total_comments else 0,
                'favorites': int(note.total_favorites) if note.total_favorites else 0,
                'shares': int(note.total_shares) if note.total_shares else 0,
                'click_rate': click_rate,
                # 私信指标
                'private_messages': int(note.total_private_messages) if note.total_private_messages else 0,
                # 转化指标（新增，来自 backend_conversions）
                'lead_users': int(note.lead_users) if note.lead_users else 0,  # 加微量（添加企微人数）
                'customer_mouth_users': int(note.customer_mouth_users) if note.customer_mouth_users else 0,  # 开口量（企微成功添加人数）
                'valid_lead_users': int(note.valid_lead_users) if note.valid_lead_users else 0,  # 有效线索量
                'opened_account_users': int(note.opened_account_users) if note.opened_account_users else 0,  # 开户量
                'valid_customer_users': int(note.valid_customer_users) if note.valid_customer_users else 0,  # 有效户量
                'customer_assets_users': int(note.customer_assets_users) if note.customer_assets_users else 0,  # 有资产人数
                'customer_assets_amount': float(note.customer_assets_amount) if note.customer_assets_amount else 0,  # 资产总量
                # 拆分数据（投放 vs 自然）
                'ad_impressions': int(note.ad_impressions) if note.ad_impressions else 0,
                'organic_impressions': int(note.organic_impressions) if note.organic_impressions else 0,
                'ad_clicks': int(note.ad_clicks) if note.ad_clicks else 0,
                'organic_clicks': int(note.organic_clicks) if note.organic_clicks else 0,
                'ad_interactions': int(note.ad_interactions) if note.ad_interactions else 0,
                'organic_interactions': int(note.organic_interactions) if note.organic_interactions else 0,
                # 计算字段
                'ad_click_rate': ad_click_rate,  # 推广点击率
                'add_wechat_cost': add_wechat_cost,  # 加微成本
                'open_account_cost': open_account_cost  # 开户成本
            })

        # 获取筛选选项（从聚合表获取，应用同样的筛选条件）
        # 创作者/生产者列表（使用 producer 字段）
        producers_query = base_query.with_entities(
            DailyNotesMetricsUnified.producer
        ).filter(
            DailyNotesMetricsUnified.producer.isnot(None),
            DailyNotesMetricsUnified.producer != ''
        ).distinct().all()
        creators = [p[0] for p in producers_query]
        producers = creators  # 使用相同的列表

        # 投放策略列表
        types_query = base_query.with_entities(
            DailyNotesMetricsUnified.ad_strategy
        ).filter(
            DailyNotesMetricsUnified.ad_strategy.isnot(None),
            DailyNotesMetricsUnified.ad_strategy != ''
        ).distinct().all()
        note_types = [t[0] for t in types_query if t[0] and t[0] != '未知']

        # 笔记类型列表（图文/视频）
        content_types_query = base_query.with_entities(
            DailyNotesMetricsUnified.note_type
        ).filter(
            DailyNotesMetricsUnified.note_type.isnot(None),
            DailyNotesMetricsUnified.note_type != ''
        ).distinct().all()
        content_types = [ct[0] for ct in content_types_query if ct[0]]

        # 发布账号列表（新增）
        accounts_query = base_query.with_entities(
            DailyNotesMetricsUnified.publish_account
        ).filter(
            DailyNotesMetricsUnified.publish_account.isnot(None),
            DailyNotesMetricsUnified.publish_account != ''
        ).distinct().all()
        publish_accounts = [acc[0] for acc in accounts_query if acc[0]]

        return jsonify({
            'success': True,
            'notes': notes_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            },
            'filters': {
                'creators': creators,
                'producers': producers,
                'note_types': note_types,
                'content_types': content_types,
                'publish_accounts': publish_accounts  # 新增：发布账号列表
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


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


@bp.route('/external-data-analysis', methods=['POST'])
def get_external_data_analysis():
    """
    外部数据分析
    提供高级分析和对比洞察
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
            platform_stats[platform]['leads'] += record.leads or 0
            platform_stats[platform]['new_accounts'] += record.new_accounts or 0

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
            agency_stats[agency]['leads'] += record.leads or 0
            agency_stats[agency]['new_accounts'] += record.new_accounts or 0

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
            bm_stats[bm]['leads'] += record.leads or 0
            bm_stats[bm]['new_accounts'] += record.new_accounts or 0

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
        total_leads = sum(r.leads or 0 for r in records)
        total_accounts = sum(r.new_accounts or 0 for r in records)

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
            daily_stats[record.date]['leads'] += record.leads or 0
            daily_stats[record.date]['new_accounts'] += record.new_accounts or 0

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
            matrix_stats[key]['leads'] += record.leads or 0
            matrix_stats[key]['new_accounts'] += record.new_accounts or 0

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


@bp.route('/leads-detail', methods=['GET'])
def get_leads_detail():
    """
    获取线索明细数据
    返回backend_conversions表的线索数据，支持分页和多维度筛选

    筛选参数:
    - page: 页码
    - page_size: 每页数量
    - start_date: 开始日期 (YYYY-MM-DD)，可选，不传则查询全部
    - end_date: 结束日期 (YYYY-MM-DD)，可选，不传则查询全部
    - platforms: 平台列表（逗号分隔），可选
    - agencies: 代理商列表（逗号分隔），可选
    """
    from backend.database import db
    from backend.models import BackendConversions

    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        platforms = request.args.get('platforms', '').split(',') if request.args.get('platforms') else []
        agencies = request.args.get('agencies', '').split(',') if request.args.get('agencies') else []

        # 获取代理商简称映射（全称 -> 简称）
        # 前端传递的是全称（如"量子"），数据库存储的是简称（如"lz"）
        abbreviation_mappings = db.session.query(AgencyAbbreviationMapping).filter(
            AgencyAbbreviationMapping.is_active == True,
            AgencyAbbreviationMapping.mapping_type == 'agency'
        ).all()

        # 创建全称 -> 简称的反向映射
        full_name_to_abbreviation = {}
        for mapping in abbreviation_mappings:
            display_name = mapping.display_name or mapping.full_name
            if display_name:
                full_name_to_abbreviation[display_name] = mapping.abbreviation
            if mapping.full_name and mapping.full_name != display_name:
                full_name_to_abbreviation[mapping.full_name] = mapping.abbreviation

        # 转换代理商全称为简称（用于查询数据库）
        agency_abbreviations = []
        for agency in agencies:
            if agency == '申万宏源直投':
                # 特殊处理：申万宏源直投
                agency_abbreviations.append(agency)
            elif agency in full_name_to_abbreviation:
                # 转换为简称
                agency_abbreviations.append(full_name_to_abbreviation[agency])
            else:
                # 没有找到映射，保持原样
                agency_abbreviations.append(agency)

        # 构建基础查询
        query = db.session.query(BackendConversions)

        # 应用筛选条件
        if start_date:
            query = query.filter(BackendConversions.lead_date >= start_date)
        if end_date:
            query = query.filter(BackendConversions.lead_date <= end_date)

        if platforms and platforms[0]:
            query = query.filter(BackendConversions.platform_source.in_(platforms))

        if agency_abbreviations and agency_abbreviations[0]:
            # 处理"申万宏源直投"（空值）的筛选
            if '申万宏源直投' in agency_abbreviations:
                # 如果包含"申万宏源直投"，需要特殊处理空值
                other_agencies = [a for a in agency_abbreviations if a != '申万宏源直投']
                if other_agencies:
                    # 有其他代理商，使用OR条件：(agency IN (other_agencies) OR agency IS NULL)
                    query = query.filter(
                        or_(
                            BackendConversions.agency.in_(other_agencies),
                            BackendConversions.agency == '',
                            BackendConversions.agency.is_(None)
                        )
                    )
                else:
                    # 只选择了"申万宏源直投"，查询空值
                    query = query.filter(
                        or_(
                            BackendConversions.agency == '',
                            BackendConversions.agency.is_(None)
                        )
                    )
            else:
                # 正常代理商筛选（使用简称）
                query = query.filter(BackendConversions.agency.in_(agency_abbreviations))

        # 获取总数
        total = query.count()

        # 分页查询
        results = query.order_by(
            BackendConversions.lead_date.desc(),
            BackendConversions.platform_source,
            BackendConversions.agency
        ).limit(page_size).offset((page - 1) * page_size).all()

        # 创建简称 -> 全称的映射（用于显示）
        # 复用前面查询到的 abbreviation_mappings，避免重复查询
        agency_map = {}  # 简称 -> 全称
        for mapping in abbreviation_mappings:
            agency_map[mapping.abbreviation.lower()] = mapping.display_name or mapping.full_name or mapping.abbreviation

        # 转换结果（返回所有40个字段，与Excel 0119.xlsx格式保持一致）
        def format_datetime(dt):
            """格式化日期时间"""
            if dt is None:
                return None
            if isinstance(dt, datetime):
                return dt.strftime('%Y-%m-%d %H:%M:%S')
            return str(dt)

        def format_date(d):
            """格式化日期"""
            if d is None:
                return None
            if isinstance(d, date):
                return d.strftime('%Y-%m-%d')
            return str(d)

        def format_agency(agency_code):
            """格式化代理商：将简称转换为全称"""
            if not agency_code or agency_code == '-':
                return '-'
            agency_lower = agency_code.lower()
            return agency_map.get(agency_lower, agency_code)

        data = []
        for row in results:
            data.append({
                # 基本信息 (1-4)
                'wechat_nickname': row.wechat_nickname or '-',
                'capital_account': row.capital_account or '-',
                'opening_branch': row.opening_branch or '-',
                'customer_gender': row.customer_gender or '-',

                # 平台和流量信息 (5-7)
                'platform_source': row.platform_source or '-',
                'traffic_type': row.traffic_type or '-',
                'customer_source': row.customer_source or '-',

                # 布尔字段 (8-16)
                'is_customer_mouth': row.is_customer_mouth or False,
                'is_valid_lead': row.is_valid_lead or False,
                'is_open_account_interrupted': row.is_open_account_interrupted or False,
                'open_account_interrupted_date': format_date(row.open_account_interrupted_date),
                'is_opened_account': row.is_opened_account or False,
                'is_valid_customer': row.is_valid_customer or False,
                'is_existing_customer': row.is_existing_customer or False,
                'is_existing_valid_customer': row.is_existing_valid_customer or False,
                'is_delete_enterprise_wechat': row.is_delete_enterprise_wechat or False,

                # 时间字段 (17-27)
                'lead_date': format_date(row.lead_date),
                'first_contact_time': format_datetime(row.first_contact_time),
                'last_contact_time': format_datetime(row.last_contact_time),
                'account_opening_time': format_datetime(row.account_opening_time),
                'wechat_verify_status': row.wechat_verify_status or '-',
                'wechat_verify_time': format_datetime(row.wechat_verify_time),
                'valid_customer_time': format_datetime(row.valid_customer_time),
                'ad_click_date': format_date(row.ad_click_date),

                # 数值字段 (28-29)
                'interaction_count': row.interaction_count or 0,
                'sales_interaction_count': row.sales_interaction_count or 0,
                'assets': float(row.assets) if row.assets else 0,
                'customer_contribution': float(row.customer_contribution) if row.customer_contribution else 0,

                # 人员信息 (30-31)
                'add_employee_no': row.add_employee_no or '-',
                'add_employee_name': row.add_employee_name or '-',

                # 广告投放信息 (32-35)
                'ad_account': row.ad_account or '-',
                'agency': format_agency(row.agency),  # 转换为全称
                'ad_id': row.ad_id or '-',
                'creative_id': row.creative_id or '-',

                # 小红书笔记信息 (36-37)
                'note_id': row.note_id or '-',
                'note_title': row.note_title or '-',

                # 平台用户信息 (38-39)
                'platform_user_id': row.platform_user_id or '-',
                'platform_user_nickname': row.platform_user_nickname or '-',

                # 其他信息 (40)
                'producer': row.producer or '-',
                'enterprise_wechat_tags': row.enterprise_wechat_tags or '-'
            })

        return jsonify({
            'success': True,
            'data': data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size if total > 0 else 1
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/leads-detail/filter-options', methods=['GET'])
def get_leads_detail_filter_options():
    """
    获取线索明细筛选器选项
    返回平台和代理商的简称与全称映射关系
    """
    from backend.database import db
    from backend.models import BackendConversions, AgencyAbbreviationMapping

    try:
        # 获取所有平台来源
        platforms = db.session.query(
            BackendConversions.platform_source
        ).distinct().filter(
            BackendConversions.platform_source.isnot(None)
        ).order_by(BackendConversions.platform_source).all()

        # 获取所有代理商
        agencies = db.session.query(
            BackendConversions.agency
        ).distinct().filter(
            BackendConversions.agency.isnot(None),
            BackendConversions.agency != ''
        ).order_by(BackendConversions.agency).all()

        # 获取简称映射
        abbreviation_mappings = db.session.query(AgencyAbbreviationMapping).filter(
            AgencyAbbreviationMapping.is_active == True
        ).all()

        # 创建映射字典
        platform_map = {}  # 简称 -> 全称
        agency_map = {}     # 简称 -> 全称

        for mapping in abbreviation_mappings:
            if mapping.mapping_type == 'platform':
                platform_map[mapping.abbreviation.lower()] = {
                    'full_name': mapping.full_name,
                    'display_name': mapping.display_name or mapping.full_name
                }
            elif mapping.mapping_type == 'agency':
                agency_map[mapping.abbreviation.lower()] = {
                    'full_name': mapping.full_name,
                    'display_name': mapping.display_name or mapping.full_name
                }

        # 构建平台选项
        platform_options = []
        for p in platforms:
            code = p[0]
            code_lower = code.lower()

            # 尝试从映射表获取全称
            if code_lower in platform_map:
                display_name = platform_map[code_lower]['display_name']
            else:
                display_name = code

            platform_options.append({
                'value': code,
                'label': display_name
            })

        # 构建代理商选项
        agency_options = []
        for a in agencies:
            code = a[0]
            code_lower = code.lower()

            # 尝试从映射表获取全称
            if code_lower in agency_map:
                display_name = agency_map[code_lower]['display_name']
            else:
                display_name = code

            agency_options.append({
                'value': code,
                'label': display_name
            })

        # 添加"申万宏源直投"选项（用于筛选空值）
        agency_options.append({
            'value': '申万宏源直投',
            'label': '申万宏源直投'
        })

        return jsonify({
            'success': True,
            'data': {
                'platforms': platform_options,
                'agencies': agency_options
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/account-mapping', methods=['GET'])
def get_account_mapping():
    """
    获取账号代理商映射数据
    """
    from backend.database import db

    try:
        # 查询所有映射数据（包含所有字段）
        mappings = db.session.query(AccountAgencyMapping).order_by(
            AccountAgencyMapping.platform,
            AccountAgencyMapping.agency
        ).all()

        # 转换结果
        data = []
        for row in mappings:
            data.append({
                'platform': row.platform,
                'account_id': row.account_id,
                'account_name': row.account_name,
                'main_account_id': row.main_account_id,
                'sub_account_name': row.sub_account_name,
                'agency': row.agency,
                'business_model': row.business_model
            })

        return jsonify({
            'data': data,
            'total': len(data)
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/account-agency-mapping', methods=['GET'])
def get_account_agency_mapping():
    """
    获取账号代理商映射数据（别名路由，与前端API调用保持一致）
    """
    return get_account_mapping()


@bp.route('/account-mapping', methods=['POST'])
def create_account_mapping():
    """
    创建新的账号代理商映射（v2.2 - 支持小红书字段）
    请求体: {
        "platform": "腾讯/抖音/小红书",
        "account_id": "123456",  // 腾讯/抖音必填，小红书可选（直投时为null）
        "account_name": "测试账号",
        "main_account_id": "66b0686c000000001d020d1f",  // 小红书必填
        "sub_account_name": "代理商子账户名称",  // 小红书可选
        "agency": "众联",
        "business_model": "信息流"
    }
    """
    from backend.database import db

    try:
        data = request.get_json()

        # 验证必填字段
        if 'platform' not in data or not data['platform']:
            return jsonify({'error': '缺少必填字段: platform'}), 400
        if 'agency' not in data or not data['agency']:
            return jsonify({'error': '缺少必填字段: agency'}), 400

        platform = data['platform']

        # 小红书特殊验证
        if platform == '小红书':
            if 'main_account_id' not in data or not data['main_account_id']:
                return jsonify({'error': '小红书账号必填字段: main_account_id'}), 400
        else:
            # 腾讯/抖音必填 account_id
            if 'account_id' not in data or not data['account_id']:
                return jsonify({'error': '腾讯/抖音账号必填字段: account_id'}), 400

        # 检查是否已存在
        existing_query = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform
        )

        # 如果有 account_id，通过 account_id 检查
        if data.get('account_id'):
            existing_query = existing_query.filter(
                AccountAgencyMapping.account_id == str(data['account_id'])
            )
        else:
            # 小红书直投：通过 main_account_id 检查
            existing_query = existing_query.filter(
                AccountAgencyMapping.main_account_id == data['main_account_id'],
                AccountAgencyMapping.account_id.is_(None)
            )

        existing = existing_query.first()

        if existing:
            return jsonify({'error': '该账号映射已存在'}), 400

        # 创建新映射
        mapping = AccountAgencyMapping(
            platform=platform,
            account_id=str(data['account_id']) if data.get('account_id') else None,
            account_name=data.get('account_name', ''),
            main_account_id=data.get('main_account_id'),
            sub_account_name=data.get('sub_account_name'),
            agency=data['agency'],
            business_model=data.get('business_model', '信息流')
        )

        db.session.add(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '创建成功',
            'data': {
                'platform': mapping.platform,
                'account_id': mapping.account_id,
                'account_name': mapping.account_name,
                'agency': mapping.agency,
                'business_model': mapping.business_model
            }
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'创建失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['PUT'])
def update_account_mapping(platform, account_id):
    """
    更新账号代理商映射（v2.2 - 支持小红书字段）
    请求体: {
        "account_name": "新账号名称",
        "agency": "新代理商",
        "business_model": "直播",
        "main_account_id": "66b0686c000000001d020d1f",  // 小红书字段
        "sub_account_name": "代理商子账户名称"  // 小红书字段
    }
    """
    from backend.database import db

    try:
        data = request.get_json()

        # 查找现有映射
        # 处理 account_id 为特殊值的情况（小红书直投）
        if account_id in ['null', '', 'None', 'undefined']:
            # 对于小红书直投，account_id在URL中可能为特殊值
            # 需要通过main_account_id来查找
            main_account_id = data.get('main_account_id')
            if not main_account_id:
                return jsonify({'error': '小红书直投账号必须提供main_account_id'}), 400

            mapping = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == platform,
                AccountAgencyMapping.main_account_id == main_account_id,
                AccountAgencyMapping.account_id.is_(None)
            ).first()
        else:
            # 正常通过account_id查找
            mapping = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == platform,
                AccountAgencyMapping.account_id == account_id
            ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        # 更新字段
        if 'account_name' in data:
            mapping.account_name = data['account_name']
        if 'agency' in data:
            mapping.agency = data['agency']
        if 'business_model' in data:
            mapping.business_model = data['business_model']
        if 'main_account_id' in data:
            mapping.main_account_id = data['main_account_id']
        if 'sub_account_name' in data:
            mapping.sub_account_name = data['sub_account_name']

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '更新成功',
            'data': {
                'platform': mapping.platform,
                'account_id': mapping.account_id,
                'account_name': mapping.account_name,
                'main_account_id': mapping.main_account_id,
                'sub_account_name': mapping.sub_account_name,
                'agency': mapping.agency,
                'business_model': mapping.business_model
            }
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'更新失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['DELETE'])
def delete_account_mapping(platform, account_id):
    """
    删除账号代理商映射
    """
    from backend.database import db

    try:
        # 查找现有映射
        mapping = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform,
            AccountAgencyMapping.account_id == account_id
        ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        db.session.delete(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '删除成功'
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/account-mapping/<string:platform>/main/<string:main_account_id>', methods=['DELETE'])
def delete_account_mapping_by_main(platform, main_account_id):
    """
    通过主账号ID删除账号代理商映射（用于小红书直投账号）
    """
    from backend.database import db
    from sqlalchemy import or_

    try:
        # 查找现有映射（account_id为NULL，通过main_account_id查找）
        mapping = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform,
            AccountAgencyMapping.main_account_id == main_account_id,
            AccountAgencyMapping.account_id.is_(None)
        ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        db.session.delete(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '删除成功'
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/xhs-notes-operation-analysis', methods=['POST'])
def get_xhs_notes_operation_analysis():
    """
    小红书运营分析报表 (使用聚合表 DailyNotesMetricsUnified)
    返回7个模块的数据：
    1. 核心运营数据（6个指标卡片）
    2. 创作者维度数据（双表格）
    3. 内容运营数据（双图表）
    4. 优秀笔记排行榜
    5. 创作者年度排行榜
    6. 代理商数据
    7. 转化趋势数据（双图表+表格）

    更新说明:
    - 使用 daily_notes_metrics_unified 聚合表
    - 支持转化数据（加粉量、开户量、有效户量等）
    - 使用 SQL 聚合提升性能

    请求体:
    {
        "filters": {
            "date_range": ["2025-01-01", "2025-01-31"],  # 主筛选器（用于其他模块）
            "top_notes_date_range": ["2025-01-01", "2025-01-31"]  # 优秀笔记排行榜独立筛选器（可选）
        }
    }
    """
    from backend.database import db
    from sqlalchemy import func
    import traceback

    try:
        data = request.get_json()
        filters = data.get('filters', {})
        date_range = filters.get('date_range', [])
        top_notes_date_range = filters.get('top_notes_date_range', [])  # 优秀笔记排行榜独立时间筛选器
        creator_annual_date_range = filters.get('creator_annual_date_range', [])  # 创作者年度排行榜独立时间筛选器

        # 基础查询，使用聚合表
        query = db.session.query(DailyNotesMetricsUnified)

        # 应用日期筛选
        if date_range and len(date_range) == 2:
            query = query.filter(
                and_(
                    DailyNotesMetricsUnified.date >= date_range[0],
                    DailyNotesMetricsUnified.date <= date_range[1]
                )
            )

        # 获取所有数据
        notes_data = query.all()

        # ========== 创作者年度排行榜独立查询 ==========
        # 如果提供了 creator_annual_date_range，则使用独立的时间范围
        # 注意：这里应该按 note_publish_time（笔记发布时间）筛选，而不是按 date（数据日期）筛选
        if creator_annual_date_range and len(creator_annual_date_range) == 2:
            creator_annual_query = db.session.query(DailyNotesMetricsUnified).filter(
                and_(
                    # 排除 note_publish_time 为 NULL 的记录
                    DailyNotesMetricsUnified.note_publish_time.isnot(None),
                    # 按 note_publish_time 筛选（笔记发布日期在指定范围内）
                    DailyNotesMetricsUnified.note_publish_time >= creator_annual_date_range[0],
                    DailyNotesMetricsUnified.note_publish_time <= creator_annual_date_range[1] + ' 23:59:59'
                )
            )
            creator_annual_data = creator_annual_query.all()
        else:
            # 如果没有提供独立筛选器，使用主数据
            creator_annual_data = notes_data

        # ========== 模块1: 核心运营数据（7个指标卡片）==========
        # 1. 新增笔记数：从 daily_notes_metrics_unified 表统计 note_publish_time 在筛选器日期区间内的唯一 note_id 数量
        # 2. 投放笔记数：从 xhs_notes_daily 表统计 date 在筛选器日期区间内的唯一 note_id 数量

        # 统计新增笔记数（按 note_publish_time 筛选）
        from backend.models import XhsNotesDaily

        new_notes_query = db.session.query(
            func.count(DailyNotesMetricsUnified.note_id.distinct())
        )

        if date_range and len(date_range) == 2:
            new_notes_query = new_notes_query.filter(
                and_(
                    DailyNotesMetricsUnified.note_publish_time >= date_range[0],
                    DailyNotesMetricsUnified.note_publish_time <= date_range[1] + ' 23:59:59'  # 包含当天全天
                )
            )

        new_notes_count = new_notes_query.scalar() or 0

        # 统计投放笔记数（从 xhs_notes_daily 表，按 date 筛选）
        ad_notes_query = db.session.query(
            func.count(XhsNotesDaily.note_id.distinct())
        )

        if date_range and len(date_range) == 2:
            ad_notes_query = ad_notes_query.filter(
                and_(
                    XhsNotesDaily.date >= date_range[0],
                    XhsNotesDaily.date <= date_range[1]
                )
            )

        ad_notes_count = ad_notes_query.scalar() or 0

        # 其他核心指标
        total_cost = sum(float(note.cost or 0) for note in notes_data)
        total_impressions = sum(note.total_impressions or 0 for note in notes_data)
        total_clicks = sum(note.total_clicks or 0 for note in notes_data)
        total_interactions = sum(note.total_interactions or 0 for note in notes_data)

        # 核心转化指标
        total_private_messages = sum(note.total_private_messages or 0 for note in notes_data)  # 总私信进线数
        total_lead_users = sum(note.lead_users or 0 for note in notes_data)  # 总加企微数
        total_opened_accounts = sum(note.opened_account_users or 0 for note in notes_data)  # 总开户数

        # 计算新的6个核心指标
        # 1. 曝光点击率 = total_clicks / total_impressions × 100%
        impression_click_rate = round(total_clicks / total_impressions * 100, 2) if total_impressions > 0 else 0

        # 2. 点击互动率 = total_interactions / total_clicks × 100%
        click_interaction_rate = round(total_interactions / total_clicks * 100, 2) if total_clicks > 0 else 0

        # 3. 点击进线率 = total_private_messages / total_clicks × 100%
        click_lead_rate = round(total_private_messages / total_clicks * 100, 2) if total_clicks > 0 else 0

        # 4. 私信进线成本 = total_cost / total_private_messages (元/条)
        cost_per_private_message = round(total_cost / total_private_messages, 2) if total_private_messages > 0 else 0

        # 5. 单企微成本 = total_cost / total_lead_users (元/人)
        cost_per_lead_user = round(total_cost / total_lead_users, 2) if total_lead_users > 0 else 0

        # 6. 单开户成本 = total_cost / total_opened_accounts (元/户)
        cost_per_opened_account = round(total_cost / total_opened_accounts, 2) if total_opened_accounts > 0 else 0

        # 新增：进线加微率 = total_lead_users / total_private_messages × 100%
        lead_to_wechat_rate = round(total_lead_users / total_private_messages * 100, 2) if total_private_messages > 0 else 0

        # 新增：线索开户率 = total_opened_accounts / total_lead_users × 100%
        wechat_to_account_rate = round(total_opened_accounts / total_lead_users * 100, 2) if total_lead_users > 0 else 0

        # 新增：千次曝光成本 = total_cost / total_impressions × 1000 (元/千次)
        cost_per_mille = round(total_cost / total_impressions * 1000, 2) if total_impressions > 0 else 0

        # 新增：点击成本 = total_cost / total_clicks (元/次)
        cost_per_click = round(total_cost / total_clicks, 2) if total_clicks > 0 else 0

        core_metrics = {
            'new_notes_count': new_notes_count,  # 新增笔记数
            'ad_notes_count': ad_notes_count,    # 投放笔记数
            'total_cost': round(total_cost, 2),
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'total_interactions': total_interactions,
            'total_private_messages': total_private_messages,  # 总私信进线数
            'total_lead_users': total_lead_users,  # 总加企微数
            'total_opened_accounts': total_opened_accounts,  # 总开户数
            # 转化率指标（4个）
            'impression_click_rate': impression_click_rate,  # 曝光点击率 (%)
            'click_lead_rate': click_lead_rate,  # 点击进线率 (%)
            'lead_to_wechat_rate': lead_to_wechat_rate,  # 进线加微率 (%)
            'wechat_to_account_rate': wechat_to_account_rate,  # 线索开户率 (%)
            # 成本指标（4个）
            'cost_per_mille': cost_per_mille,  # 千次曝光成本 (元/千次)
            'cost_per_click': cost_per_click,  # 点击成本 (元/次)
            'cost_per_lead_user': cost_per_lead_user,  # 单企微成本 (元/人)
            'cost_per_opened_account': cost_per_opened_account  # 单开户成本 (元/户)
        }

        # ========== 模块2: 创作者维度数据（双表格）==========
        # 内容数据表格
        creator_content_data = {}
        # 业务转化数据表格
        creator_conversion_data = {}
        # 用于统计唯一笔记数
        creator_note_ids = {}

        for note in notes_data:
            # 严格使用 producer（创作者姓名），不为空时显示"未知创作者"
            # 不再使用 creator_name（账号名称）作为创作者维度
            creator = note.producer if note.producer else '未知创作者'

            # 初始化创作者数据
            if creator not in creator_content_data:
                creator_content_data[creator] = {
                    'producer': creator,
                    'note_count': 0,
                    'total_impressions': 0,
                    'total_clicks': 0,
                    'total_interactions': 0,
                    'total_cost': 0
                }

            # 内容数据聚合
            creator_content_data[creator]['total_impressions'] += note.total_impressions or 0
            creator_content_data[creator]['total_clicks'] += note.total_clicks or 0
            creator_content_data[creator]['total_interactions'] += note.total_interactions or 0
            creator_content_data[creator]['total_cost'] += float(note.cost or 0)

            # 统计唯一笔记数（使用集合去重）
            if creator not in creator_note_ids:
                creator_note_ids[creator] = set()
            creator_note_ids[creator].add(note.note_id)

            # 业务转化数据聚合（使用聚合表的转化指标）
            if creator not in creator_conversion_data:
                creator_conversion_data[creator] = {
                    'producer': creator,
                    'private_messages': 0,  # 私信数
                    'lead_users': 0,  # 加微数
                    'customer_mouth_users': 0,  # 开口量
                    'valid_lead_users': 0,  # 有效线索量
                    'opened_account_users': 0,  # 开户数
                    'valid_customer_users': 0  # 有效户量
                }

            creator_conversion_data[creator]['private_messages'] += note.total_private_messages or 0
            creator_conversion_data[creator]['lead_users'] += note.lead_users or 0
            creator_conversion_data[creator]['customer_mouth_users'] += note.customer_mouth_users or 0
            creator_conversion_data[creator]['valid_lead_users'] += note.valid_lead_users or 0
            creator_conversion_data[creator]['opened_account_users'] += note.opened_account_users or 0
            creator_conversion_data[creator]['valid_customer_users'] += note.valid_customer_users or 0

        # 使用唯一笔记ID集合设置正确的笔记数
        for creator in creator_content_data:
            if creator in creator_note_ids:
                creator_content_data[creator]['note_count'] = len(creator_note_ids[creator])

        # 计算平均指标
        creator_content_list = []
        for data in creator_content_data.values():
            data['avg_click_rate'] = round(data['total_clicks'] / data['total_impressions'] * 100, 2) if data['total_impressions'] > 0 else 0
            data['avg_interaction_rate'] = round(data['total_interactions'] / data['total_impressions'] * 100, 2) if data['total_impressions'] > 0 else 0
            creator_content_list.append(data)

        # 按笔记数倒序排序（PRD要求）
        creator_content_list.sort(key=lambda x: x['note_count'], reverse=True)

        # 按开户数倒序排序（PRD要求）
        creator_conversion_list = list(creator_conversion_data.values())
        creator_conversion_list.sort(key=lambda x: x['opened_account_users'], reverse=True)

        # ========== 创作者年度排行榜独立聚合 ==========
        # 使用 creator_annual_data 进行创作者维度聚合
        creator_annual_data_aggregated = {}
        creator_annual_note_ids = {}

        for note in creator_annual_data:
            creator = note.producer if note.producer else '未知创作者'

            # 初始化创作者年度数据
            if creator not in creator_annual_data_aggregated:
                creator_annual_data_aggregated[creator] = {
                    'producer': creator,
                    'total_cost': 0,
                    'total_impressions': 0,
                    'total_clicks': 0,
                    'total_private_messages': 0,
                    'lead_users': 0,
                    'opened_account_users': 0
                }

            # 聚合指标
            creator_annual_data_aggregated[creator]['total_cost'] += float(note.cost or 0)
            creator_annual_data_aggregated[creator]['total_impressions'] += note.total_impressions or 0
            creator_annual_data_aggregated[creator]['total_clicks'] += note.total_clicks or 0
            creator_annual_data_aggregated[creator]['total_private_messages'] += note.total_private_messages or 0
            creator_annual_data_aggregated[creator]['lead_users'] += note.lead_users or 0
            creator_annual_data_aggregated[creator]['opened_account_users'] += note.opened_account_users or 0

            # 统计唯一笔记数
            if creator not in creator_annual_note_ids:
                creator_annual_note_ids[creator] = set()
            creator_annual_note_ids[creator].add(note.note_id)

        # 设置笔记数
        for creator in creator_annual_data_aggregated:
            if creator in creator_annual_note_ids:
                creator_annual_data_aggregated[creator]['note_count'] = len(creator_annual_note_ids[creator])

        # 转换为列表并排序（按消耗金额降序）
        creator_annual_ranking = list(creator_annual_data_aggregated.values())
        creator_annual_ranking.sort(key=lambda x: x['total_cost'], reverse=True)

        # ========== 模块3: 内容运营数据（双图表）==========
        # 使用 xhs_note_info 表统计基于 publish_time 的每日创作笔记数
        daily_creation_query = db.session.query(
            func.date(XhsNoteInfo.publish_time).label('date'),
            func.count(XhsNoteInfo.note_id).label('note_count')
        )

        # 应用日期筛选（基于 publish_time）
        if date_range and len(date_range) == 2:
            daily_creation_query = daily_creation_query.filter(
                and_(
                    XhsNoteInfo.publish_time >= date_range[0],
                    XhsNoteInfo.publish_time <= date_range[1] + ' 23:59:59'
                )
            )

        daily_creation_query = daily_creation_query.group_by(
            func.date(XhsNoteInfo.publish_time)
        ).order_by(
            func.date(XhsNoteInfo.publish_time)
        )

        daily_creation_results = daily_creation_query.all()

        # 构建创作量趋势数据（基于 publish_time）
        creation_trend = {
            'dates': [str(row.date) for row in daily_creation_results],
            'note_counts': [row.note_count for row in daily_creation_results]
        }

        # 互动量趋势仍然使用 daily_notes_metrics_unified 聚合表的数据
        daily_interaction_data = {}
        for note in notes_data:
            date_str = str(note.date)
            if date_str not in daily_interaction_data:
                daily_interaction_data[date_str] = {
                    'date': date_str,
                    'total_impressions': 0,
                    'total_interactions': 0,
                    'total_cost': 0
                }

            daily_interaction_data[date_str]['total_impressions'] += note.total_impressions or 0
            daily_interaction_data[date_str]['total_interactions'] += note.total_interactions or 0
            daily_interaction_data[date_str]['total_cost'] += float(note.cost or 0)

        # 转换为列表并排序
        daily_interaction_list = sorted(daily_interaction_data.values(), key=lambda x: x['date'])

        # 合并数据到 creation_trend（用于互动量趋势图）
        creation_trend['impression_series'] = [item['total_impressions'] for item in daily_interaction_list]
        creation_trend['interaction_series'] = [item['total_interactions'] for item in daily_interaction_list]
        creation_trend['cost_series'] = [item['total_cost'] for item in daily_interaction_list]

        # ========== 模块4: 优秀笔记排行榜 ==========
        # 使用独立时间筛选器（按 note_publish_time 过滤），默认使用主筛选器
        if top_notes_date_range and len(top_notes_date_range) == 2:
            # 从数据库重新查询，使用 note_publish_time 过滤
            top_notes_query = db.session.query(
                DailyNotesMetricsUnified.note_id,
                DailyNotesMetricsUnified.note_title,
                DailyNotesMetricsUnified.note_publish_time,
                DailyNotesMetricsUnified.note_url,
                DailyNotesMetricsUnified.producer,
                DailyNotesMetricsUnified.ad_strategy,
                func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
                func.sum(DailyNotesMetricsUnified.total_impressions).label('total_impressions'),
                func.sum(DailyNotesMetricsUnified.total_clicks).label('total_clicks'),
                func.sum(DailyNotesMetricsUnified.total_private_messages).label('total_private_messages'),
                func.sum(DailyNotesMetricsUnified.lead_users).label('lead_users'),
                func.sum(DailyNotesMetricsUnified.opened_account_users).label('opened_account_users')
            ).filter(
                and_(
                    DailyNotesMetricsUnified.note_publish_time >= top_notes_date_range[0],
                    DailyNotesMetricsUnified.note_publish_time <= top_notes_date_range[1] + ' 23:59:59'
                )
            ).group_by(
                DailyNotesMetricsUnified.note_id,
                DailyNotesMetricsUnified.note_title,
                DailyNotesMetricsUnified.note_publish_time,
                DailyNotesMetricsUnified.note_url,
                DailyNotesMetricsUnified.producer,
                DailyNotesMetricsUnified.ad_strategy
            )

            # 执行查询
            top_notes_result = top_notes_query.all()

            # 构建数据结构
            note_stats = {}
            for row in top_notes_result:
                if row.note_id not in note_stats:
                    note_stats[row.note_id] = {
                        'note_id': row.note_id,
                        'note_title': row.note_title or '',
                        'note_publish_time': row.note_publish_time.strftime('%Y-%m-%d') if row.note_publish_time else '',
                        'note_url': row.note_url or '',
                        'producer': row.producer or '未知',
                        'ad_strategy': row.ad_strategy or '未知',
                        'total_cost': 0,
                        'total_impressions': 0,
                        'total_clicks': 0,
                        'total_private_messages': 0,
                        'lead_users': 0,
                        'opened_account_users': 0
                    }

                note_stats[row.note_id]['total_cost'] += float(row.total_cost or 0)
                note_stats[row.note_id]['total_impressions'] += int(row.total_impressions or 0)
                note_stats[row.note_id]['total_clicks'] += int(row.total_clicks or 0)
                note_stats[row.note_id]['total_private_messages'] += int(row.total_private_messages or 0)
                note_stats[row.note_id]['lead_users'] += int(row.lead_users or 0)
                note_stats[row.note_id]['opened_account_users'] += int(row.opened_account_users or 0)
        else:
            # 使用主筛选器的数据（原有逻辑）
            note_stats = {}
            for note in notes_data:
                if note.note_id not in note_stats:
                    note_stats[note.note_id] = {
                        'note_id': note.note_id,
                        'note_title': note.note_title or '',
                        'note_publish_time': note.note_publish_time.strftime('%Y-%m-%d') if note.note_publish_time else '',
                        'note_url': note.note_url or '',
                        'producer': note.producer or '未知',
                        'ad_strategy': note.ad_strategy or '未知',
                        'total_cost': 0,
                        'total_impressions': 0,
                        'total_clicks': 0,
                        'total_private_messages': 0,
                        'lead_users': 0,
                        'opened_account_users': 0
                    }

                note_stats[note.note_id]['total_cost'] += float(note.cost or 0)
                note_stats[note.note_id]['total_impressions'] += note.total_impressions or 0
                note_stats[note.note_id]['total_clicks'] += note.total_clicks or 0
                note_stats[note.note_id]['total_private_messages'] += note.total_private_messages or 0
                note_stats[note.note_id]['lead_users'] += note.lead_users or 0
                note_stats[note.note_id]['opened_account_users'] += note.opened_account_users or 0

        # 按加微数排序取前10
        top_notes = sorted(note_stats.values(), key=lambda x: x['lead_users'], reverse=True)[:10]

        # ========== 模块6: 代理商数据 ==========
        # 基于 daily_metrics_unified 表，仅展示小红书平台的代理商投放数据
        from backend.models import DailyMetricsUnified

        # 查询小红书平台的代理商数据（使用运营分析表的日期筛选器）
        agency_query = db.session.query(DailyMetricsUnified).filter(
            DailyMetricsUnified.platform == '小红书'  # 仅小红书平台
        )

        # 应用日期筛选
        if date_range and len(date_range) == 2:
            agency_query = agency_query.filter(
                and_(
                    DailyMetricsUnified.date >= date_range[0],  # 使用运营分析表的日期筛选器
                    DailyMetricsUnified.date <= date_range[1]
                )
            )

        agency_metrics_data = agency_query.all()

        # 按代理商聚合数据
        agency_data = {}
        for metric in agency_metrics_data:
            # 代理商为空的记录不展示
            if not metric.agency or metric.agency == '':
                continue

            agency = metric.agency

            if agency not in agency_data:
                agency_data[agency] = {
                    'agency': agency,
                    'total_cost': 0,
                    'total_impressions': 0,
                    'total_clicks': 0,
                    'lead_users': 0,  # 企微数
                    'potential_customers': 0,  # 潜客数
                    'customer_mouth_users': 0,  # 客户开口数
                    'valid_lead_users': 0,  # 有效线索数
                    'opened_account_users': 0,  # 开户数
                    'valid_customer_users': 0  # 有效户数
                }

            # 聚合指标
            agency_data[agency]['total_cost'] += float(metric.cost or 0)
            agency_data[agency]['total_impressions'] += metric.impressions or 0
            agency_data[agency]['total_clicks'] += metric.click_users or 0
            agency_data[agency]['lead_users'] += metric.lead_users or 0  # 企微数
            agency_data[agency]['potential_customers'] += metric.potential_customers or 0  # 潜客数
            agency_data[agency]['customer_mouth_users'] += metric.customer_mouth_users or 0  # 客户开口数
            agency_data[agency]['valid_lead_users'] += metric.valid_lead_users or 0  # 有效线索数
            agency_data[agency]['opened_account_users'] += metric.opened_account_users or 0  # 开户数
            agency_data[agency]['valid_customer_users'] += metric.valid_customer_users or 0  # 有效户数

        # 转换为列表并排序
        agency_list = list(agency_data.values())
        agency_list.sort(key=lambda x: x['total_cost'], reverse=True)

        # ========== 模块7: 转化趋势数据（双图表+表格）==========
        # 左图：整体转化趋势（组合图）
        # 右图：日级转化率走势（折线图）
        # 下表：笔记转化量排行榜

        # ========== 模块7: 整体转化走势（从 backend_conversions 表，按周聚合）==========
        # 基于用户提供的SQL，从 backend_conversions 表查询小红书平台数据

        # 按周聚合转化数据
        # 整体转化走势（周度）
        # 数据口径：
        # - 加微数 = 所有行数（每行1个加微）
        # - 开口客户数 = is_customer_mouth = 1 的行数
        # - 有效线索数 = is_valid_lead = 1 的行数
        # - 开户数 = is_opened_account = 1 的行数

        print(f"[DEBUG] Date range for conversion query: {date_range[0]} to {date_range[1]}")

        weekly_conversion_query = db.session.query(
            func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
            func.count(BackendConversions.id).label('total_wechat_adds'),  # 加微数（所有行数）
            func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('total_customer_mouths'),  # 开口客户数
            func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),  # 有效线索数
            func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened_accounts')  # 开户数
        ).filter(
            and_(
                BackendConversions.platform_source == '小红书',
                BackendConversions.lead_date >= date_range[0],
                BackendConversions.lead_date <= date_range[1]
            )
        ).group_by(
            func.strftime('%Y-%W', BackendConversions.lead_date)
        ).order_by(
            func.strftime('%Y-%W', BackendConversions.lead_date)
        ).all()

        print(f"[DEBUG] Raw SQL returned {len(weekly_conversion_query)} rows")

        # 打印前5行原始数据
        for i, row in enumerate(weekly_conversion_query[:5]):
            print(f"[DEBUG] Row {i}: week={row.week}, total_wechat_adds={row.total_wechat_adds}, total_customer_mouths={row.total_customer_mouths}, total_valid_leads={row.total_valid_leads}, total_opened_accounts={row.total_opened_accounts}")

        # 构建周度转化数据
        weekly_conversion_list = []
        week_date_ranges = {}  # 存储每周对应的日期范围

        print(f"[DEBUG] 开始处理 {len(weekly_conversion_query)} 行周度数据")

        for idx, row in enumerate(weekly_conversion_query):
            week_str = row.week  # 格式: YYYY-周数
            year, week_num = week_str.split('-')

            # 计算该周的日期范围（周一到周日）
            week_start = datetime.strptime(f"{year}-{week_num}-0", "%Y-%W-%w")
            week_end = week_start + timedelta(days=6)
            date_range_str = f"{week_start.strftime('%m%d')}-{week_end.strftime('%m%d')}"

            # 提取数据
            lead_users_val = int(row.total_wechat_adds or 0)
            customer_mouth_users_val = int(row.total_customer_mouths or 0)
            valid_lead_users_val = int(row.total_valid_leads or 0)
            opened_account_users_val = int(row.total_opened_accounts or 0)

            print(f"[DEBUG] 行 {idx}: week={week_str}, lead_users={lead_users_val}, customer_mouth={customer_mouth_users_val}, valid_leads={valid_lead_users_val}, opened={opened_account_users_val}")

            weekly_conversion_list.append({
                'week': week_str,
                'date_range': date_range_str,
                'lead_users': lead_users_val,  # 加微数（所有行数）
                'customer_mouth_users': customer_mouth_users_val,  # 开口客户数
                'valid_lead_users': valid_lead_users_val,  # 有效线索数
                'opened_account_users': opened_account_users_val  # 开户数
            })

            week_date_ranges[week_str] = date_range_str

        print(f"[DEBUG] weekly_conversion_list 构建完成，包含 {len(weekly_conversion_list)} 周数据")

        # 构建 conversion_trend 数据结构（用于前端渲染）
        conversion_trend = {
            'weeks': [item['week'] for item in weekly_conversion_list],
            'dateRanges': [item['date_range'] for item in weekly_conversion_list],
            'lead_users': [item['lead_users'] for item in weekly_conversion_list],  # 加微数
            'customer_mouth_users': [item['customer_mouth_users'] for item in weekly_conversion_list],  # 开口客户数
            'valid_lead_users': [item['valid_lead_users'] for item in weekly_conversion_list],  # 有效线索数
            'opened_account_users': [item['opened_account_users'] for item in weekly_conversion_list]  # 开户数
        }

        # DEBUG: 打印 conversion_trend 数据
        print(f"[DEBUG] conversion_trend 数据:")
        print(f"  weeks: {conversion_trend['weeks']}")
        print(f"  lead_users: {conversion_trend['lead_users']}")
        print(f"  customer_mouth_users: {conversion_trend['customer_mouth_users']}")
        print(f"  valid_lead_users: {conversion_trend['valid_lead_users']}")
        print(f"  opened_account_users: {conversion_trend['opened_account_users']}")
        print(f"  weekly_conversion_list length: {len(weekly_conversion_list)}")
        if weekly_conversion_list:
            print(f"  First week data: {weekly_conversion_list[0]}")
            if len(weekly_conversion_list) > 1:
                print(f"  Last week data: {weekly_conversion_list[-1]}")

        # 笔记转化量排行榜（取前10）
        note_conversion_ranking = sorted(
            note_stats.values(),
            key=lambda x: x['lead_users'],
            reverse=True
        )[:10]

        # ========== 新增：笔记创作量数据（按创作者聚合）==========
        creator_creation_data = {}
        for note in notes_data:
            producer = note.producer or '未知'
            if producer not in creator_creation_data:
                creator_creation_data[producer] = {
                    'producer': producer,
                    'note_count': 0,
                    'impressions': 0
                }
            creator_creation_data[producer]['note_count'] += 1
            creator_creation_data[producer]['impressions'] += note.total_impressions or 0

        creator_creation_list = list(creator_creation_data.values())

        # ========== 新增：笔记互动量数据（按创作者聚合）==========
        creator_interaction_data = {}
        for note in notes_data:
            producer = note.producer or '未知'
            if producer not in creator_interaction_data:
                creator_interaction_data[producer] = {
                    'producer': producer,
                    'likes': 0,
                    'favorites': 0,
                    'comments': 0,
                    'shares': 0,
                    'total_interactions': 0
                }
            creator_interaction_data[producer]['likes'] += note.total_likes or 0
            creator_interaction_data[producer]['favorites'] += note.total_favorites or 0
            creator_interaction_data[producer]['comments'] += note.total_comments or 0
            creator_interaction_data[producer]['shares'] += note.total_shares or 0
            creator_interaction_data[producer]['total_interactions'] += note.total_interactions or 0

        creator_interaction_list = list(creator_interaction_data.values())

        # ========== 新增：员工转化数据（从 backend_conversions 表）==========
        # BackendConversions 已在文件顶部导入，无需重复导入

        # 查询小红书平台的转化数据
        # 数据口径：
        # - 企微数 = 所有行数（每行1个企微数）
        # - 有效线索数 = is_valid_lead = 1 的行数
        # - 开户数 = is_opened_account = 1 的行数
        # - 有效户数 = is_valid_customer = 1 的行数
        employee_query = db.session.query(
            func.coalesce(BackendConversions.add_employee_name, '未知').label('employee_name'),
            func.count(BackendConversions.id).label('total_wechat_adds'),  # 企微数（所有行数）
            func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),  # 有效线索数
            func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened_accounts'),  # 开户数
            func.sum(case((BackendConversions.is_valid_customer == True, 1), else_=0)).label('total_valid_customers'),  # 有效户数
            func.sum(BackendConversions.assets).label('total_assets')
        ).filter(
            BackendConversions.platform_source == '小红书'
        )

        # 应用日期筛选
        if date_range and len(date_range) == 2:
            employee_query = employee_query.filter(
                and_(
                    BackendConversions.lead_date >= date_range[0],
                    BackendConversions.lead_date <= date_range[1]
                )
            )

        # 按员工分组
        employee_stats = employee_query.group_by(
            func.coalesce(BackendConversions.add_employee_name, '未知')
        ).all()

        # 构建员工转化排行榜
        employee_conversion_ranking = []
        for stat in employee_stats:
            employee_name = stat.employee_name  # 使用新的字段名

            # 正确处理 SQLAlchemy 返回的数值
            wechat_adds_count = int(stat.total_wechat_adds) if stat.total_wechat_adds is not None else 0  # 企微数
            valid_leads_count = int(stat.total_valid_leads) if stat.total_valid_leads is not None else 0  # 有效线索数
            opened_account_count = int(stat.total_opened_accounts) if stat.total_opened_accounts is not None else 0  # 开户数
            valid_customer_count = int(stat.total_valid_customers) if stat.total_valid_customers is not None else 0  # 有效户数

            # 开户率 = 开户数 / 企微数
            opening_rate = (opened_account_count / wechat_adds_count * 100) if wechat_adds_count > 0 else 0
            # 有效户率 = 有效户数 / 开户数
            valid_customer_rate = (valid_customer_count / opened_account_count * 100) if opened_account_count > 0 else 0

            employee_conversion_ranking.append({
                'employee_name': employee_name,
                'lead_users': wechat_adds_count,  # 企微数（所有行数）
                'wechat_adds': wechat_adds_count,  # 企微数
                'valid_lead_users': valid_leads_count,  # 有效线索数
                'opened_account_users': opened_account_count,  # 开户数
                'valid_customer_users': valid_customer_count,  # 有效户数
                'opening_rate': round(opening_rate, 2),
                'valid_customer_rate': round(valid_customer_rate, 2),
                'total_assets': float(stat.total_assets or 0)
            })

        # 按开户数降序排序，返回全量数据（不限制TOP10）
        import sys
        print(f"[DEBUG] datetime module: {datetime}")
        print(f"[DEBUG] datetime.now(): {datetime.now()}")
        employee_conversion_ranking.sort(key=lambda x: x['opened_account_users'], reverse=True)

        # ========== 员度线索开户率走势（近8周）==========
        import logging

        logger = logging.getLogger(__name__)

        # 计算近8周的日期范围
        end_date = datetime.strptime(date_range[1], '%Y-%m-%d').date() if date_range and len(date_range) == 2 else datetime.now().date()
        start_date_8weeks = end_date - timedelta(weeks=8)

        logger.info(f"[EmployeeWeeklyRate] Querying weekly data from {start_date_8weeks} to {end_date}")

        # 查询周度数据
        # 数据口径：
        # - 加微数 = 所有行数（每行1个加微）
        # - 开户数 = is_opened_account = 1 的行数
        # - 转化率 = 开户数 / 加微数
        weekly_employee_query = db.session.query(
            func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
            BackendConversions.add_employee_name,
            func.count(BackendConversions.id).label('total_wechat_adds'),  # 加微数（所有行数）
            func.sum(
                case(
                    (BackendConversions.is_opened_account == True, 1),
                    else_=0
                )
            ).label('opened_accounts')  # 开户数
        ).filter(
            and_(
                BackendConversions.platform_source == '小红书',
                BackendConversions.lead_date >= start_date_8weeks,
                BackendConversions.lead_date <= end_date
            )
        ).group_by(
            func.strftime('%Y-%W', BackendConversions.lead_date),
            BackendConversions.add_employee_name
        ).all()

        logger.info(f"[EmployeeWeeklyRate] Query returned {len(weekly_employee_query)} rows")

        # 构建周度数据结构
        weekly_data = {
            'weeks': [],
            'employees': set(),
            'rates': {}
        }

        for row in weekly_employee_query:
            if not row.add_employee_name:
                continue

            week = row.week
            wechat_adds = row.total_wechat_adds or 0  # 加微数
            opened_accounts = row.opened_accounts or 0  # 开户数

            # 计算开户转化率 = 开户数 / 加微数
            rate = (opened_accounts / wechat_adds * 100) if wechat_adds > 0 else 0

            weekly_data['weeks'].append(week)
            weekly_data['employees'].add(row.add_employee_name)

            if row.add_employee_name not in weekly_data['rates']:
                weekly_data['rates'][row.add_employee_name] = {}

            weekly_data['rates'][row.add_employee_name][week] = round(rate, 2)

        logger.info(f"[EmployeeWeeklyRate] Processed {len(weekly_data['weeks'])} weeks, {len(weekly_data['employees'])} employees")

        # 排序并去重周
        sorted_weeks = sorted(list(set(weekly_data['weeks'])))[:8]  # 只取近8周

        # 获取TOP员工（按开户数排序）
        top_employees = sorted(
            employee_conversion_ranking[:5],  # 取前5名员工
            key=lambda x: x['opened_account_users'],
            reverse=True
        ) if employee_conversion_ranking else []

        logger.info(f"[EmployeeWeeklyRate] Top employees: {len(top_employees)}")

        # 构建图表数据
        employee_weekly_conversion = {
            'weeks': sorted_weeks,
            'employees': [emp['employee_name'] for emp in top_employees],
            'series': []
        }

        # 为每个员工生成周度数据
        for emp in top_employees:
            emp_name = emp['employee_name']
            series_data = []

            for week in sorted_weeks:
                rate = weekly_data['rates'].get(emp_name, {}).get(week, 0)
                series_data.append(rate)

            employee_weekly_conversion['series'].append(series_data)

        logger.info(f"[EmployeeWeeklyRate] Final data structure: weeks={len(sorted_weeks)}, employees={len(employee_weekly_conversion['employees'])}, series={len(employee_weekly_conversion['series'])}")

        # 最终调试：打印即将发送给前端的 conversion_trend 数据
        print(f"\n{'='*100}")
        print(f"[DEBUG] 即将发送给前端的 conversion_trend 数据:")
        print(f"  weeks: {conversion_trend['weeks']}")
        print(f"  lead_users: {conversion_trend['lead_users']}")
        print(f"  customer_mouth_users: {conversion_trend['customer_mouth_users']}")
        print(f"  valid_lead_users: {conversion_trend['valid_lead_users']}")
        print(f"  opened_account_users: {conversion_trend['opened_account_users']}")
        print(f"  dateRanges: {conversion_trend['dateRanges']}")
        print(f"{'='*100}\n")

        return jsonify({
            'success': True,
            'data': {
                'core_metrics': core_metrics,
                'creator_content_data': creator_content_list,
                'creator_conversion_data': creator_conversion_list,
                'creation_trend': creation_trend,
                'top_notes': top_notes,
                'creator_annual_ranking': creator_annual_ranking,
                'agency_data': agency_list,
                'conversion_trend': conversion_trend,
                'note_conversion_ranking': note_conversion_ranking,
                'creator_creation_data': creator_creation_list,
                'creator_interaction_data': creator_interaction_list,
                'employee_conversion_ranking': employee_conversion_ranking,
                'employee_weekly_conversion': employee_weekly_conversion
            }
        })

    except Exception as e:
        import traceback
        import logging
        from flask import current_app

        # Log the full error to console
        error_msg = f"Error in xhs-notes-operation-analysis: {str(e)}\n{traceback.format_exc()}"
        current_app.logger.error(error_msg)

        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



# ============================================
# 代理商简称映射管理接口
# ============================================

@bp.route('/abbreviation-mapping', methods=['GET'])
def get_abbreviation_mapping():
    """
    获取所有代理商简称映射
    
    查询参数:
    - mapping_type: 映射类型 (agency/platform)
    - is_active: 是否启用 (true/false)
    """
    try:
        query = AgencyAbbreviationMapping.query
        
        # 筛选条件
        mapping_type = request.args.get('mapping_type')
        if mapping_type:
            query = query.filter_by(mapping_type=mapping_type)
        
        is_active = request.args.get('is_active')
        if is_active is not None:
            query = query.filter_by(is_active=(is_active.lower() == 'true'))
        
        # 按类型和简称排序
        mappings = query.order_by(
            AgencyAbbreviationMapping.mapping_type,
            AgencyAbbreviationMapping.abbreviation
        ).all()
        
        # 转换为字典
        data = []
        for m in mappings:
            data.append({
                'id': m.id,
                'abbreviation': m.abbreviation,
                'full_name': m.full_name,
                'mapping_type': m.mapping_type,
                'platform': m.platform,
                'display_name': m.display_name,
                'description': m.description,
                'is_active': m.is_active,
                'created_at': m.created_at.isoformat() if m.created_at else None,
                'updated_at': m.updated_at.isoformat() if m.updated_at else None
            })
        
        return jsonify({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/abbreviation-mapping', methods=['POST'])
def create_abbreviation_mapping():
    """
    创建新的代理商简称映射
    
    请求体:
    {
        "abbreviation": "lz",
        "full_name": "量子",
        "mapping_type": "agency",
        "platform": null,
        "display_name": "量子",
        "description": "代理商简称",
        "is_active": true
    }
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['abbreviation', 'full_name', 'mapping_type']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'error': f'缺少必需字段: {field}'
                }), 400
        
        # 检查简称是否已存在
        existing = AgencyAbbreviationMapping.query.filter_by(
            abbreviation=data['abbreviation'],
            platform=data.get('platform')
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'error': '该简称已存在'
            }), 400
        
        # 创建新记录
        new_mapping = AgencyAbbreviationMapping(
            abbreviation=data['abbreviation'],
            full_name=data['full_name'],
            mapping_type=data['mapping_type'],
            platform=data.get('platform'),
            display_name=data.get('display_name'),
            description=data.get('description'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(new_mapping)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '创建成功',
            'data': {
                'id': new_mapping.id
            }
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'success': False,
            'error': f'创建失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/abbreviation-mapping/<int:id>', methods=['PUT'])
def update_abbreviation_mapping(id):
    """
    更新代理商简称映射
    
    请求体:
    {
        "full_name": "量子",
        "is_active": true
    }
    """
    try:
        data = request.get_json()
        
        # 查找记录
        mapping = AgencyAbbreviationMapping.query.get(id)
        if not mapping:
            return jsonify({
                'success': False,
                'error': '记录不存在'
            }), 404
        
        # 更新字段
        if 'full_name' in data:
            mapping.full_name = data['full_name']
        if 'display_name' in data:
            mapping.display_name = data['display_name']
        if 'description' in data:
            mapping.description = data['description']
        if 'is_active' in data:
            mapping.is_active = data['is_active']

        # 更新时间戳
        mapping.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '更新成功'
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'success': False,
            'error': f'更新失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/abbreviation-mapping/<int:id>', methods=['DELETE'])
def delete_abbreviation_mapping(id):
    """删除代理商简称映射"""
    try:
        mapping = AgencyAbbreviationMapping.query.get(id)
        if not mapping:
            return jsonify({
                'success': False,
                'error': '记录不存在'
            }), 404
        
        db.session.delete(mapping)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'success': False,
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


# ===== 数据概览 API 接口 =====


# ===== 数据概览 API 接口 =====

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
