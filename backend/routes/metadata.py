# -*- coding: utf-8 -*-
"""元数据API接口（v2 - 查新表）"""
from flask import Blueprint, jsonify
from backend.models_v2 import AggVendorDaily, FactConvContent, DimAccount, AggXhsNote
from sqlalchemy import distinct, func
from datetime import datetime, date
import logging
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import get_all_shorts, expand_short_to_fulls

bp = Blueprint('metadata', __name__)
logger = logging.getLogger(__name__)


@bp.route('/metadata', methods=['GET'])
@handle_exceptions
def get_metadata():
    from backend.database import db

    try:
        platforms = [r[0] for r in db.session.query(distinct(AggVendorDaily.平台))
                     .filter(AggVendorDaily.平台.isnot(None), AggVendorDaily.平台 != '')
                     .order_by(AggVendorDaily.平台).all()]
    except Exception:
        platforms = ['腾讯', '抖音', '小红书']

    try:
        agencies = get_all_shorts()
    except Exception:
        agencies = []

    try:
        bms = set(r[0] for r in db.session.query(distinct(AggVendorDaily.业务模式))
                  .filter(AggVendorDaily.业务模式.isnot(None), AggVendorDaily.业务模式 != '').all())
        business_models = sorted(bms)
    except Exception:
        business_models = []

    try:
        dr = db.session.query(
            func.min(AggVendorDaily.日期).label('min'),
            func.max(AggVendorDaily.日期).label('max')
        ).first()
        date_range = {'start': str(dr.min) if dr.min else None, 'end': str(dr.max) if dr.max else None}
    except Exception:
        date_range = {'start': None, 'end': None}

    try:
        xdr = db.session.query(
            func.min(AggXhsNote.发布时间).label('min'),
            func.max(AggXhsNote.发布时间).label('max')
        ).first()
        xhs_notes_date_range = {'start': str(xdr.min)[:10] if xdr.min else None, 'end': str(xdr.max)[:10] if xdr.max else None}
    except Exception:
        xhs_notes_date_range = {'start': None, 'end': None}

    return jsonify({
        'success': True,
        'data': {
            'platforms': platforms,
            'agencies': [{'value': a, 'label': a, 'full_names': expand_short_to_fulls([a])} for a in agencies],
            'agency_full_map': {s: expand_short_to_fulls([s]) for s in agencies},
            'business_models': business_models,
            'date_range': date_range,
            'xhs_notes_date_range': xhs_notes_date_range,
        }
    })


def get_data_status():
    from backend.models_v2 import (AggVendorDaily, AggXhsNote, FactConvContent,
                                   FactConvAppmarket, AggDailyChannelOpen)
    from backend.database import db
    today = date.today()

    # group 字段供前端 DataFreshness 按分组渲染
    sources = [
        {'key': 'vendor_daily',          'model': AggVendorDaily,          'date_field': AggVendorDaily.日期,           'name': '厂商日聚合',     'group': 'channel_ads',  'order': 1},
        {'key': 'xhs_note',              'model': AggXhsNote,              'date_field': AggXhsNote.发布时间,     'name': '小红书笔记聚合', 'group': 'content',     'order': 2},
        {'key': 'fact_conv_content',     'model': FactConvContent,         'date_field': FactConvContent.线索日期,   'name': '内容平台转化',     'group': 'content',     'order': 3},
        {'key': 'fact_conv_appmarket',   'model': FactConvAppmarket,       'date_field': FactConvAppmarket.下载日期,  'name': '应用市场转化',     'group': 'app_market',  'order': 4},
        {'key': 'agg_daily_channel_open','model': AggDailyChannelOpen,     'date_field': AggDailyChannelOpen.时间区间, 'name': '全渠道开户汇总',   'group': 'omni',        'order': 5},
    ]
    results = {}
    for cfg in sources:
        k = cfg['key']
        try:
            latest = db.session.query(func.max(cfg['date_field'])).scalar()
            base = {'name': cfg['name'], 'group': cfg['group'], 'order': cfg['order']}
            if latest:
                latest_str = str(latest)[:10]
                try:
                    d = datetime.strptime(latest_str, '%Y-%m-%d').date()
                    days = (today - d).days
                except Exception:
                    days = 0
                status = 'normal' if days <= 5 else ('warning' if days <= 14 else 'critical')
                results[k] = {**base, 'latest_date': latest_str, 'days_ago': days, 'status': status}
            else:
                results[k] = {**base, 'latest_date': None, 'status': 'no_data'}
        except Exception as e:
            results[k] = {'name': cfg['name'], 'group': cfg['group'], 'order': cfg['order'], 'status': 'error', 'error': str(e)}
    return results


@bp.route('/data-freshness', methods=['GET'])
@handle_exceptions
def get_data_freshness():
    return jsonify({'success': True, 'data': get_data_status()})
