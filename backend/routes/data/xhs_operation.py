# -*- coding: utf-8 -*-
"""
小红书笔记运营分析接口
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
from .xhs_operation_helpers import (
    get_core_metrics,
    get_creator_data,
    get_creator_annual_ranking,
    get_creation_trend,
    get_top_notes,
    get_agency_data,
    get_conversion_trend,
    get_employee_conversion
)

# 创建Blueprint
bp = Blueprint('xhs_operation', __name__)


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
    """
    try:
        data = request.get_json()
        filters = data.get('filters', {})
        date_range = filters.get('date_range', [])
        top_notes_date_range = filters.get('top_notes_date_range', [])
        creator_annual_date_range = filters.get('creator_annual_date_range', [])

        # 基础查询
        query = db.session.query(DailyNotesMetricsUnified)

        if date_range and len(date_range) == 2:
            query = query.filter(
                and_(
                    DailyNotesMetricsUnified.date >= date_range[0],
                    DailyNotesMetricsUnified.date <= date_range[1]
                )
            )

        notes_data = query.all()

        # 创作者年度排行榜独立查询
        if creator_annual_date_range and len(creator_annual_date_range) == 2:
            creator_annual_query = db.session.query(DailyNotesMetricsUnified).filter(
                and_(
                    DailyNotesMetricsUnified.note_publish_time.isnot(None),
                    DailyNotesMetricsUnified.note_publish_time >= creator_annual_date_range[0],
                    DailyNotesMetricsUnified.note_publish_time <= creator_annual_date_range[1] + ' 23:59:59'
                )
            )
            creator_annual_data = creator_annual_query.all()
        else:
            creator_annual_data = notes_data

        # 模块1: 核心运营数据
        core_metrics = get_core_metrics(notes_data, date_range)

        # 模块2: 创作者维度数据
        creator_content_list, creator_conversion_list = get_creator_data(notes_data)

        # 模块5: 创作者年度排行榜
        creator_annual_ranking = get_creator_annual_ranking(creator_annual_data)

        # 模块3: 内容运营数据
        creation_trend = get_creation_trend(notes_data, date_range)

        # 模块4: 优秀笔记排行榜
        top_notes = get_top_notes(notes_data, top_notes_date_range)

        # 模块6: 代理商数据
        agency_list = get_agency_data(date_range)

        # 模块7: 转化趋势数据
        conversion_trend, weekly_conversion_list = get_conversion_trend(date_range)

        # 笔记转化量排行榜
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

        note_conversion_ranking = sorted(
            note_stats.values(),
            key=lambda x: x['lead_users'],
            reverse=True
        )[:10]

        # 创作量数据
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

        # 互动量数据
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

        # 员工转化数据和周度转化率
        end_date = datetime.strptime(date_range[1], '%Y-%m-%d').date() if date_range and len(date_range) == 2 else datetime.now().date()
        employee_conversion_ranking, employee_weekly_conversion = get_employee_conversion(date_range, end_date)

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
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500
