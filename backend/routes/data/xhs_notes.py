# -*- coding: utf-8 -*-
"""小红书笔记接口（v2 - 查 agg_xhs_note）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggXhsNote
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('xhs_notes', __name__)


def _process(params):
    filters = params.get('filters') or {}
    page = max(1, int(params.get('page', 1)))
    page_size = min(200, max(1, int(params.get('page_size', 50))))

    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)
    publish_start = filters.get('publish_start_date') or (filters.get('publish_date_range', [None, None])[0] if filters.get('publish_date_range') else None)
    publish_end = filters.get('publish_end_date') or (filters.get('publish_date_range', [None, None])[1] if filters.get('publish_date_range') else None)

    q = db.session.query(AggXhsNote)
    if publish_start and publish_end:
        ps = publish_start
        pe = publish_end + ' 23:59:59' if len(publish_end) == 10 else publish_end
        q = q.filter(and_(AggXhsNote.发布时间 >= ps, AggXhsNote.发布时间 <= pe))
    creators = filters.get('creators') or filters.get('creator') or []
    if isinstance(creators, str):
        creators = [creators]
    if creators:
        q = q.filter(AggXhsNote.创作者.in_([str(c) for c in creators]))
    if filters.get('ad_strategies'):
        ads = filters['ad_strategies']
        if isinstance(ads, str):
            ads = [ads]
        q = q.filter(AggXhsNote.广告策略.in_([str(a) for a in ads]))
    if filters.get('content_types'):
        cts = filters['content_types']
        if isinstance(cts, str):
            cts = [cts]
        q = q.filter(AggXhsNote.内容类型.in_([str(c) for c in cts]))
    if filters.get('account'):
        q = q.filter(AggXhsNote.笔记账号 == filters['account'])

    total = q.count()
    rows = q.order_by(AggXhsNote.发布时间.desc()).limit(page_size).offset((page - 1) * page_size).all()

    notes = []
    for r in rows:
        notes.append({
            'note_id': r.笔记ID,
            'note_title': r.笔记标题,
            'note_type': r.笔记类型,
            'content_type': r.内容类型,
            'publish_account': r.笔记账号,
            'creator_name': r.创作者,
            'producer': r.创作者,
            'ad_strategy': r.广告策略,
            'publish_time': r.发布时间,
            'note_url': r.笔记链接,
            'impressions': int(r.总展现量 or 0),
            'clicks': int(r.点击量 or 0),
            'click_rate': float(r.总点击率 or 0),
            'interactions': int(r.总互动量 or 0),
            'cost': float(r.消费金额 or 0),
            'ad_impressions': int(r.推广展现量 or 0),
            'ad_clicks': int(r.推广点击量 or 0),
            'ad_click_rate': float(r.推广点击率 or 0),
            'ad_interactions': int(r.推广互动量 or 0),
            'private_messages': int(r.私信进线人数 or 0),
            'lead_users': int(r.添加企微人数 or 0),
            'customer_mouth_users': int(r.企微成功添加人数 or 0),
            'add_wechat_cost': float(r.加微成本 or 0),
            'opened_account_users': int(r.开户人数 or 0),
            'open_account_cost': float(r.开户成本 or 0),
        })

    return jsonify({
        'success': True,
        'data': {
            'notes': notes,
            'pagination': {'page': page, 'page_size': page_size, 'total': total, 'total_pages': (total + page_size - 1) // page_size},
            'filters': {
                'creators': [r.创作者 for r in db.session.query(AggXhsNote.创作者).distinct().filter(AggXhsNote.创作者.isnot(None)).all() if r.创作者],
                'content_types': [r.内容类型 for r in db.session.query(AggXhsNote.内容类型).distinct().filter(AggXhsNote.内容类型.isnot(None)).all() if r.内容类型],
                'ad_strategies': [r.广告策略 for r in db.session.query(AggXhsNote.广告策略).distinct().filter(AggXhsNote.广告策略.isnot(None)).all() if r.广告策略],
                'publish_accounts': [r.笔记账号 for r in db.session.query(AggXhsNote.笔记账号).distinct().filter(AggXhsNote.笔记账号.isnot(None)).all() if r.笔记账号],
            }
        }
    })


@bp.route('/xhs-notes-list', methods=['POST'])
@handle_exceptions
def get_xhs_notes_list_post():
    return _process(request.get_json() or {})


@bp.route('/xhs-notes/list', methods=['GET'])
@handle_exceptions
def get_xhs_notes_list_get():
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    filters = {}
    for k in ['start_date', 'end_date', 'publish_start_date', 'publish_end_date', 'creator', 'account']:
        v = request.args.get(k)
        if v:
            filters[k] = v
    for k in ['ad_strategies', 'content_types']:
        v = request.args.get(k)
        if v:
            filters[k] = v.split(',')
    return _process({'filters': filters, 'page': page, 'page_size': page_size})
