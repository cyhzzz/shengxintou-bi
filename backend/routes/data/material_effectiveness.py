# -*- coding: utf-8 -*-
"""
素材效果分析接口
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_
from backend.models import (
    XhsNoteInfo,
    DailyNotesMetricsUnified,
    XhsNotesDaily,
    XhsNotesContentDaily
)
from backend.database import db
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('material_effectiveness', __name__)


def calculate_overall_score(cost, leads, valid, engagement_rate):
    """
    计算综合评分（0-100）
    综合评分 = 效率分(40%) + 转化分(30%) + 互动分(20%) + 成本分(10%)
    """
    # 成本分（40%）：成本越低分越高
    cost_per_lead = (cost / leads) if leads > 0 else 0
    cost_score = max(0, 100 - min(cost_per_lead * 2, 100))

    # 转化分（30%）
    conversion_rate = (valid / leads * 100) if leads > 0 else 0
    conversion_score = conversion_rate * 0.3

    # 互动分（20%）
    engagement_score = engagement_rate * 100 * 0.2

    # ROI分（10%）：简化版
    roi_score = min((valid * 1000 / cost) * 10, 10) if cost > 0 else 0

    return min(cost_score + conversion_score + engagement_score + roi_score, 100)


@bp.route('/material-effectiveness/list', methods=['POST'])
def get_material_list():
    """
    获取素材列表（支持分页）
    请求参数:
    {
      "filters": {
        "platforms": ["小红书"],
        "agencies": ["量子", "众联"],
        "business_models": ["信息流"],
        "date_range": ["2026-01-01", "2026-01-15"],
        "traffic_type": "paid",  // paid, organic, all
        "authors": ["作者A"],
        "tags": ["产品介绍", "用户故事"],
        "score_range": [80, 100]
      },
      "sort_by": "overall_score",  // overall_score, cost, lead_users等
      "sort_order": "desc",
      "page": 1,
      "page_size": 20,
      "search": "关键词搜索"
    }
    """
    data = request.get_json()
    filters = data.get('filters', {})
    sort_by = data.get('sort_by', 'overall_score')
    sort_order = data.get('sort_order', 'desc')
    page = data.get('page', 1)
    page_size = data.get('page_size', 20)
    search = data.get('search', '')

    try:
        logger.info(f'[material-effectiveness] 获取素材列表: page={page}, sort={sort_by}')

        # 构建主查询
        query = db.session.query(
            XhsNoteInfo.note_id,
            XhsNoteInfo.title,
            XhsNoteInfo.cover_url,
            XhsNoteInfo.author_name,
            XhsNoteInfo.publish_date,
            XhsNoteInfo.tags,
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyNotesMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
            func.sum(XhsNotesDaily.likes).label('total_likes'),
            func.sum(XhsNotesDaily.collects).label('total_collects'),
            func.sum(XhsNotesDaily.comments).label('total_comments'),
            func.sum(XhsNotesDaily.shares).label('total_shares')
        )

        # JOIN操作
        query = query.join(
            DailyNotesMetricsUnified,
            XhsNoteInfo.note_id == DailyNotesMetricsUnified.note_id
        ).join(
            XhsNotesDaily,
            XhsNoteInfo.note_id == XhsNotesDaily.note_id
        )

        # 应用筛选条件
        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                DailyNotesMetricsUnified.date.between(
                    filters['date_range'][0],
                    filters['date_range'][1]
                )
            )

        if 'traffic_type' in filters and filters['traffic_type']:
            if filters['traffic_type'] == 'paid':
                query = query.filter(DailyNotesMetricsUnified.is_paid == True)
            elif filters['traffic_type'] == 'organic':
                query = query.filter(DailyNotesMetricsUnified.is_paid == False)

        if 'agencies' in filters and filters['agencies']:
            query = query.filter(DailyNotesMetricsUnified.agency.in_(filters['agencies']))

        if 'business_models' in filters and filters['business_models']:
            query = query.filter(DailyNotesMetricsUnified.business_model.in_(filters['business_models']))

        if 'authors' in filters and filters['authors']:
            query = query.filter(XhsNoteInfo.author_name.in_(filters['authors']))

        if search:
            query = query.filter(XhsNoteInfo.title.contains(search))

        # 分组
        query = query.group_by(
            XhsNoteInfo.note_id,
            XhsNoteInfo.title,
            XhsNoteInfo.cover_url,
            XhsNoteInfo.author_name,
            XhsNoteInfo.publish_date,
            XhsNoteInfo.tags
        )

        # 先获取总数
        total = query.count()

        # 默认排序
        query = query.order_by(func.sum(DailyNotesMetricsUnified.cost).desc())

        # 分页
        results = query.offset((page - 1) * page_size).limit(page_size).all()

        # 转换数据并计算评分
        items = []
        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            impressions = int(row.total_impressions) if row.total_impressions else 0
            clicks = int(row.total_click_users) if row.total_click_users else 0
            opened = int(row.total_opened_account_users) if row.total_opened_account_users else 0
            likes = int(row.total_likes) if row.total_likes else 0
            collects = int(row.total_collects) if row.total_collects else 0
            comments = int(row.total_comments) if row.total_comments else 0
            shares = int(row.total_shares) if row.total_shares else 0

            # 计算效率指标
            cost_per_lead = cost / leads if leads > 0 else 0
            click_rate = (clicks / impressions * 100) if impressions > 0 else 0
            engagement_rate = ((likes + collects + comments + shares) / impressions) if impressions > 0 else 0

            # 计算转化指标
            lead_conversion = (leads / clicks * 100) if clicks > 0 else 0
            account_conversion = (opened / leads * 100) if leads > 0 else 0
            valid_conversion = (valid / opened * 100) if opened > 0 else 0

            # 计算综合评分
            overall_score = calculate_overall_score(cost, leads, valid, engagement_rate)

            item = {
                'note_id': row.note_id,
                'title': row.title,
                'cover_url': row.cover_url,
                'author_name': row.author_name,
                'publish_date': row.publish_date.strftime('%Y-%m-%d') if row.publish_date else None,
                'tags': row.tags.split(',') if row.tags else [],
                'metrics': {
                    'cost': round(cost, 2),
                    'impressions': impressions,
                    'click_users': clicks,
                    'lead_users': leads,
                    'opened_account_users': opened,
                    'valid_customer_users': valid,
                    'likes': likes,
                    'collects': collects,
                    'comments': comments,
                    'shares': shares
                },
                'efficiency_metrics': {
                    'cost_per_lead': round(cost_per_lead, 2),
                    'cost_per_customer': round(cost / opened, 2) if opened > 0 else 0,
                    'cost_per_valid': round(cost / valid, 2) if valid > 0 else 0,
                    'click_rate': round(click_rate, 2),
                    'engagement_rate': round(engagement_rate, 4)
                },
                'conversion_metrics': {
                    'lead_conversion_rate': round(lead_conversion, 2),
                    'account_conversion_rate': round(account_conversion, 2),
                    'valid_conversion_rate': round(valid_conversion, 2)
                },
                'overall_score': round(overall_score, 1)
            }
            items.append(item)

        # 按指定字段重新排序
        if sort_by == 'overall_score':
            items.sort(key=lambda x: x['overall_score'], reverse=(sort_order == 'desc'))
        elif sort_by == 'cost':
            items.sort(key=lambda x: x['metrics']['cost'], reverse=(sort_order == 'desc'))
        elif sort_by == 'lead_users':
            items.sort(key=lambda x: x['metrics']['lead_users'], reverse=(sort_order == 'desc'))
        elif sort_by == 'valid_customer_users':
            items.sort(key=lambda x: x['metrics']['valid_customer_users'], reverse=(sort_order == 'desc'))

        # 评分区间筛选
        if 'score_range' in filters and filters['score_range']:
            min_score, max_score = filters['score_range']
            items = [item for item in items if min_score <= item['overall_score'] <= max_score]

        # 标签筛选
        if 'tags' in filters and filters['tags']:
            items = [item for item in items if any(tag in item['tags'] for tag in filters['tags'])]

        return jsonify({
            'success': True,
            'data': {
                'items': items,
                'total': total,
                'page': page,
                'page_size': page_size
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[material-effectiveness] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/material-effectiveness/detail', methods=['POST'])
def get_material_detail():
    """
    获取素材详情
    请求参数:
    {
      "note_id": "6412345678",
      "filters": { ... }
    }
    """
    data = request.get_json()
    note_id = data.get('note_id')
    filters = data.get('filters', {})

    if not note_id:
        return jsonify({
            'success': False,
            'error': {
                'code': 'MISSING_PARAMS',
                'message': '缺少note_id参数'
            }
        }), 400

    try:
        logger.info(f'[material-effectiveness] 获取素材详情: note_id={note_id}')

        # 查询笔记基本信息
        note = db.session.query(XhsNoteInfo).filter(
            XhsNoteInfo.note_id == note_id
        ).first()

        if not note:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'NOT_FOUND',
                    'message': '笔记不存在'
                }
            }), 404

        # 查询汇总数据
        query = db.session.query(
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyNotesMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
            func.sum(XhsNotesDaily.likes).label('total_likes'),
            func.sum(XhsNotesDaily.collects).label('total_collects'),
            func.sum(XhsNotesDaily.comments).label('total_comments'),
            func.sum(XhsNotesDaily.shares).label('total_shares')
        ).filter(
            DailyNotesMetricsUnified.note_id == note_id
        )

        # 应用筛选条件
        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                DailyNotesMetricsUnified.date.between(
                    filters['date_range'][0],
                    filters['date_range'][1]
                )
            )

        if 'traffic_type' in filters and filters['traffic_type']:
            if filters['traffic_type'] == 'paid':
                query = query.filter(DailyNotesMetricsUnified.is_paid == True)
            elif filters['traffic_type'] == 'organic':
                query = query.filter(DailyNotesMetricsUnified.is_paid == False)

        result = query.first()

        cost = float(result.total_cost) if result.total_cost else 0
        leads = int(result.total_lead_users) if result.total_lead_users else 0
        valid = int(result.total_valid_customer_users) if result.total_valid_customer_users else 0
        impressions = int(result.total_impressions) if result.total_impressions else 0
        clicks = int(result.total_click_users) if result.total_click_users else 0
        opened = int(result.total_opened_account_users) if result.total_opened_account_users else 0
        likes = int(result.total_likes) if result.total_likes else 0
        collects = int(result.total_collects) if result.total_collects else 0
        comments = int(result.total_comments) if result.total_comments else 0
        shares = int(result.total_shares) if result.total_shares else 0

        engagement_rate = ((likes + collects + comments + shares) / impressions) if impressions > 0 else 0
        overall_score = calculate_overall_score(cost, leads, valid, engagement_rate)

        # 查询趋势数据
        trend_query = db.session.query(
            DailyNotesMetricsUnified.date,
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('total_valid_customer_users')
        ).filter(
            DailyNotesMetricsUnified.note_id == note_id
        )

        if 'date_range' in filters and filters['date_range']:
            trend_query = trend_query.filter(
                DailyNotesMetricsUnified.date.between(
                    filters['date_range'][0],
                    filters['date_range'][1]
                )
            )

        trend_query = trend_query.group_by(DailyNotesMetricsUnified.date).order_by(DailyNotesMetricsUnified.date)
        trend_results = trend_query.all()

        trend_data = []
        for row in trend_results:
            trend_data.append({
                'date': row.date.strftime('%Y-%m-%d'),
                'cost': float(row.total_cost) if row.total_cost else 0,
                'impressions': int(row.total_impressions) if row.total_impressions else 0,
                'click_users': int(row.total_click_users) if row.total_click_users else 0,
                'lead_users': int(row.total_lead_users) if row.total_lead_users else 0,
                'valid_customer_users': int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            })

        return jsonify({
            'success': True,
            'data': {
                'note_id': note_id,
                'title': note.title,
                'cover_url': note.cover_url,
                'author_name': note.author_name,
                'publish_date': note.publish_date.strftime('%Y-%m-%d') if note.publish_date else None,
                'tags': note.tags.split(',') if note.tags else [],
                'metrics': {
                    'cost': round(cost, 2),
                    'impressions': impressions,
                    'click_users': clicks,
                    'lead_users': leads,
                    'opened_account_users': opened,
                    'valid_customer_users': valid,
                    'likes': likes,
                    'collects': collects,
                    'comments': comments,
                    'shares': shares
                },
                'efficiency_metrics': {
                    'cost_per_lead': round(cost / leads, 2) if leads > 0 else 0,
                    'cost_per_customer': round(cost / opened, 2) if opened > 0 else 0,
                    'cost_per_valid': round(cost / valid, 2) if valid > 0 else 0,
                    'click_rate': round(clicks / impressions * 100, 2) if impressions > 0 else 0,
                    'engagement_rate': round(engagement_rate, 4)
                },
                'conversion_metrics': {
                    'lead_conversion_rate': round(leads / clicks * 100, 2) if clicks > 0 else 0,
                    'account_conversion_rate': round(opened / leads * 100, 2) if leads > 0 else 0,
                    'valid_conversion_rate': round(valid / opened * 100, 2) if opened > 0 else 0
                },
                'overall_score': round(overall_score, 1),
                'trend_data': trend_data
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[material-effectiveness] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/material-effectiveness/scatter', methods=['POST'])
def get_scatter_data():
    """
    获取散点图数据
    请求参数:
    {
      "filters": { ... },
      "x_axis": "cost",  // cost, impressions, etc.
      "y_axis": "valid_customer_users",
      "size_by": "overall_score"
    }
    """
    data = request.get_json()
    filters = data.get('filters', {})
    x_axis = data.get('x_axis', 'cost')
    y_axis = data.get('y_axis', 'valid_customer_users')

    try:
        logger.info(f'[material-effectiveness] 获取散点图数据')

        # 构建查询
        query = db.session.query(
            XhsNoteInfo.note_id,
            XhsNoteInfo.title,
            XhsNoteInfo.cover_url,
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.click_users).label('total_click_users'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyNotesMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
            func.sum(XhsNotesDaily.likes).label('total_likes'),
            func.sum(XhsNotesDaily.collects).label('total_collects'),
            func.sum(XhsNotesDaily.comments).label('total_comments'),
            func.sum(XhsNotesDaily.shares).label('total_shares')
        )

        # JOIN和筛选
        query = query.join(
            DailyNotesMetricsUnified,
            XhsNoteInfo.note_id == DailyNotesMetricsUnified.note_id
        ).join(
            XhsNotesDaily,
            XhsNoteInfo.note_id == XhsNotesDaily.note_id
        )

        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                DailyNotesMetricsUnified.date.between(
                    filters['date_range'][0],
                    filters['date_range'][1]
                )
            )

        # 分组
        query = query.group_by(
            XhsNoteInfo.note_id,
            XhsNoteInfo.title,
            XhsNoteInfo.cover_url
        )

        results = query.all()

        # 转换为散点图格式
        scatter_data = []
        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            impressions = int(row.total_impressions) if row.total_impressions else 0
            likes = int(row.total_likes) if row.total_likes else 0
            collects = int(row.total_collects) if row.total_collects else 0
            comments = int(row.total_comments) if row.total_comments else 0
            shares = int(row.total_shares) if row.total_shares else 0

            engagement_rate = ((likes + collects + comments + shares) / impressions) if impressions > 0 else 0
            overall_score = calculate_overall_score(cost, leads, valid, engagement_rate)

            # X轴值
            if x_axis == 'cost':
                x_value = cost
            elif x_axis == 'impressions':
                x_value = impressions
            elif x_axis == 'lead_users':
                x_value = leads
            else:
                x_value = cost

            # Y轴值
            if y_axis == 'valid_customer_users':
                y_value = valid
            elif y_axis == 'lead_users':
                y_value = leads
            elif y_axis == 'opened_account_users':
                y_value = int(row.total_opened_account_users) if row.total_opened_account_users else 0
            else:
                y_value = valid

            scatter_data.append({
                'x': x_value,
                'y': y_value,
                'size': overall_score,
                'note_id': row.note_id,
                'title': row.title,
                'cover_url': row.cover_url,
                'overall_score': round(overall_score, 1)
            })

        return jsonify({
            'success': True,
            'data': {
                'scatter_data': scatter_data
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[material-effectiveness] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500


@bp.route('/material-effectiveness/score-distribution', methods=['POST'])
def get_score_distribution():
    """
    获取评分分布
    """
    data = request.get_json()
    filters = data.get('filters', {})

    try:
        logger.info(f'[material-effectiveness] 获取评分分布')

        # 查询所有素材
        query = db.session.query(
            XhsNoteInfo.note_id,
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyNotesMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
            func.sum(XhsNotesDaily.likes).label('total_likes'),
            func.sum(XhsNotesDaily.collects).label('total_collects'),
            func.sum(XhsNotesDaily.comments).label('total_comments'),
            func.sum(XhsNotesDaily.shares).label('total_shares'),
            func.sum(DailyNotesMetricsUnified.impressions).label('total_impressions')
        ).join(
            DailyNotesMetricsUnified,
            XhsNoteInfo.note_id == DailyNotesMetricsUnified.note_id
        ).join(
            XhsNotesDaily,
            XhsNoteInfo.note_id == XhsNotesDaily.note_id
        ).group_by(XhsNoteInfo.note_id)

        if 'date_range' in filters and filters['date_range']:
            query = query.filter(
                DailyNotesMetricsUnified.date.between(
                    filters['date_range'][0],
                    filters['date_range'][1]
                )
            )

        results = query.all()

        # 计算每个素材的评分
        scores = []
        for row in results:
            cost = float(row.total_cost) if row.total_cost else 0
            leads = int(row.total_lead_users) if row.total_lead_users else 0
            valid = int(row.total_valid_customer_users) if row.total_valid_customer_users else 0
            impressions = int(row.total_impressions) if row.total_impressions else 0
            likes = int(row.total_likes) if row.total_likes else 0
            collects = int(row.total_collects) if row.total_collects else 0
            comments = int(row.total_comments) if row.total_comments else 0
            shares = int(row.total_shares) if row.total_shares else 0

            engagement_rate = ((likes + collects + comments + shares) / impressions) if impressions > 0 else 0
            overall_score = calculate_overall_score(cost, leads, valid, engagement_rate)
            scores.append(round(overall_score))

        # 统计分布
        distribution = {
            '0-20': 0,
            '20-40': 0,
            '40-60': 0,
            '60-80': 0,
            '80-100': 0
        }

        for score in scores:
            if score < 20:
                distribution['0-20'] += 1
            elif score < 40:
                distribution['20-40'] += 1
            elif score < 60:
                distribution['40-60'] += 1
            elif score < 80:
                distribution['60-80'] += 1
            else:
                distribution['80-100'] += 1

        return jsonify({
            'success': True,
            'data': {
                'distribution': distribution,
                'total': len(scores),
                'average': round(sum(scores) / len(scores), 2) if scores else 0
            }
        })

    except Exception as e:
        import traceback
        logger.error(f'[material-effectiveness] 查询失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'QUERY_ERROR',
                'message': str(e),
                'traceback': traceback.format_exc()
            }
        }), 500
