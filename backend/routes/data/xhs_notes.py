# -*- coding: utf-8 -*-
"""
小红书笔记分析接口 - 笔记互动数据、笔记列表
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
bp = Blueprint('xhs_notes', __name__)

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



