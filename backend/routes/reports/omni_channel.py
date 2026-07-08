# -*- coding: utf-8 -*-
"""全渠道获客情况报表 v2.1

数据源:
- agg_daily_channel_open  渠道类别粒度 5 大类 + 子渠道
- fact_conv_content       互联网引流.内容平台 设备级漏斗
- fact_conv_appmarket     互联网引流.应用市场 设备级漏斗
- agg_vendor_daily        厂商日合并 (含花费, 成本)

所有端点返 SUM/count 聚合 (raw_sums), 前端可自算 ratio/cost_per_*
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_
from backend.models_v2 import (
    AggDailyChannelOpen, FactConvContent, FactConvAppmarket, AggVendorDaily,
)
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('omni_channel_report', __name__, url_prefix='/api/v1/reports/omni-channel')

_META = {
    'version': 'v2.1',
    'source_tables': ['agg_daily_channel_open', 'fact_conv_content', 'fact_conv_appmarket', 'agg_vendor_daily'],
    'note': 'raw_sums = SQL SUM/count; rate/cost_per_* = mÄ¸nç',
}

def _s(v):
    try: return int(float(v or 0))
    except: return 0

def _f(v):
    try: return float(v or 0)
    except: return 0

def _apply_date_ch(q, model, col, filters):
    sd = filters.get('start_date')
    ed = filters.get('end_date')
    if sd and ed:
        return q.filter(and_(getattr(model, col) >= sd, getattr(model, col) <= ed))
    return q

@bp.route('/summary', methods=['POST'])
@handle_exceptions
def omni_channel_summary():
    """总览: 5 大类 + 月度趋势 + 内容/应用市场 漏斗"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}

    # 5 渠道类别总览
    cat_q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        func.sum(AggDailyChannelOpen.开户成功人数).label('opens'),
        func.sum(AggDailyChannelOpen.有效户数).label('valid'),
    )
    cat_q = _apply_date_ch(cat_q, AggDailyChannelOpen, '时间区间', filters)
    cat_q = cat_q.group_by(AggDailyChannelOpen.渠道类别)
    by_category = []
    for r in cat_q.all():
        o = _s(r.opens); v = _s(r.valid)
        by_category.append({
            'channel_category': r.channel_category or '未归因',
            'opens': o, 'valid': v,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
        })
    by_category.sort(key=lambda x: x['opens'], reverse=True)

    # 互联网引流.内容平台 by 平台来源
    c_q = db.session.query(
        FactConvContent.平台来源.label('platform'),
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opens'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
    )
    c_q = _apply_date_ch(c_q, FactConvContent, '线索日期', filters)
    c_q = c_q.group_by(FactConvContent.平台来源)
    content_by_platform = []
    for r in c_q.all():
        ld = _s(r.leads); mo = _s(r.mouth); vl = _s(r.valid_lead); o = _s(r.opens); v = _s(r.valid)
        content_by_platform.append({
            'platform': r.platform or '未归因',
            'leads': ld, 'mouth': mo, 'valid_lead': vl,
            'opens': o, 'valid': v,
            'open_rate': round(o / ld * 100, 2) if ld > 0 else 0,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
        })
    content_by_platform.sort(key=lambda x: x['opens'], reverse=True)

    # 互联网引流.应用市场 by 应用市场
    a_q = db.session.query(
        FactConvAppmarket.应用市场.label('app_market'),
        func.count(FactConvAppmarket.id).label('downloads'),
        func.coalesce(func.sum(FactConvAppmarket.是否激活APP), 0).label('activates'),
        func.coalesce(func.sum(FactConvAppmarket.是否开户成功), 0).label('opens'),
        func.coalesce(func.sum(FactConvAppmarket.是否有效户), 0).label('valid'),
    )
    a_q = _apply_date_ch(a_q, FactConvAppmarket, '下载日期', filters)
    a_q = a_q.group_by(FactConvAppmarket.应用市场)
    appmarket_by_market = []
    for r in a_q.all():
        d = _s(r.downloads); ac = _s(r.activates); o = _s(r.opens); v = _s(r.valid)
        appmarket_by_market.append({
            'app_market': r.app_market or '未归因',
            'downloads': d, 'activates': ac,
            'opens': o, 'valid': v,
            'activate_rate': round(ac / d * 100, 2) if d > 0 else 0,
            'open_rate': round(o / d * 100, 4) if d > 0 else 0,
            'valid_rate': round(v / d * 100, 4) if d > 0 else 0,
        })
    appmarket_by_market.sort(key=lambda x: x['opens'], reverse=True)

    # 合作机构 / 员工开户 / 自然流入 by 渠道名称
    n_q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        AggDailyChannelOpen.渠道名称.label('channel_name'),
        func.sum(AggDailyChannelOpen.开户成功人数).label('opens'),
        func.sum(AggDailyChannelOpen.有效户数).label('valid'),
    ).filter(AggDailyChannelOpen.渠道类别.in_(['合作机构', '员工开户', '自然流入']))
    n_q = _apply_date_ch(n_q, AggDailyChannelOpen, '时间区间', filters)
    n_q = n_q.group_by(AggDailyChannelOpen.渠道类别, AggDailyChannelOpen.渠道名称)
    nonad_by_channel = []
    for r in n_q.all():
        o = _s(r.opens); v = _s(r.valid)
        nonad_by_channel.append({
            'channel_category': r.channel_category or '',
            'channel_name': r.channel_name or '',
            'opens': o, 'valid': v,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
        })
    nonad_by_channel.sort(key=lambda x: x['opens'], reverse=True)

    # 成本摘要
    cost_q = db.session.query(func.coalesce(func.sum(AggVendorDaily.花费), 0))
    cost_q = _apply_date_ch(cost_q, AggVendorDaily, '日期', filters)
    total_cost = _f(cost_q.scalar())

    return jsonify({
        'success': True,
        'data': {
            'by_category': by_category,
            'content_by_platform': content_by_platform,
            'appmarket_by_market': appmarket_by_market,
            'nonad_by_channel': nonad_by_channel,
            'total_cost': round(total_cost, 2),
            'total_opens': sum(x['opens'] for x in by_category),
            'total_valid': sum(x['valid'] for x in by_category),
        },
        'meta': {**_META,
            'raw_sums_keys': ['opens', 'valid', 'leads', 'mouth', 'valid_lead', 'downloads', 'activates', 'total_cost'],
            'derived_keys': ['valid_rate', 'open_rate', 'activate_rate'],
        },
    })

@bp.route('/monthly-trend', methods=['POST'])
@handle_exceptions
def omni_channel_monthly_trend():
    """月度趋势: 5 大类"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}

    # 内容平台
    c_q = db.session.query(
        func.substr(FactConvContent.线索日期, 1, 7).label('month'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opens'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
    )
    c_q = _apply_date_ch(c_q, FactConvContent, '线索日期', filters)
    c_q = c_q.group_by('month').order_by('month')
    content = [{'month': r.month, 'opens': _s(r.opens), 'valid': _s(r.valid)} for r in c_q.all()]

    # 应用市场
    a_q = db.session.query(
        func.substr(FactConvAppmarket.下载日期, 1, 7).label('month'),
        func.coalesce(func.sum(FactConvAppmarket.是否开户成功), 0).label('opens'),
        func.coalesce(func.sum(FactConvAppmarket.是否有效户), 0).label('valid'),
    )
    a_q = _apply_date_ch(a_q, FactConvAppmarket, '下载日期', filters)
    a_q = a_q.group_by('month').order_by('month')
    appmarket = [{'month': r.month, 'opens': _s(r.opens), 'valid': _s(r.valid)} for r in a_q.all()]

    # 合作机构 / 员工开户 / 自然流入
    n_q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('category'),
        func.substr(AggDailyChannelOpen.时间区间, 1, 7).label('month'),
        func.sum(AggDailyChannelOpen.开户成功人数).label('opens'),
        func.sum(AggDailyChannelOpen.有效户数).label('valid'),
    )
    n_q = _apply_date_ch(n_q, AggDailyChannelOpen, '时间区间', filters)
    n_q = n_q.group_by(AggDailyChannelOpen.渠道类别, 'month').order_by('month')
    nonad_raw = []
    for r in n_q.all():
        nonad_raw.append({'category': r.category, 'month': r.month, 'opens': _s(r.opens), 'valid': _s(r.valid)})
    nonad_by_cat = {}
    for r in nonad_raw:
        nonad_by_cat.setdefault(r['category'], []).append({'month': r['month'], 'opens': r['opens'], 'valid': r['valid']})

    return jsonify({
        'success': True,
        'data': {'content': content, 'appmarket': appmarket, 'nonad_by_category': nonad_by_cat},
        'meta': {**_META, 'raw_sums_keys': ['opens', 'valid']},
    })

@bp.route('/content-detail', methods=['POST'])
@handle_exceptions
def omni_channel_content_detail():
    """互联网引流.内容平台 设备级明细"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    page = int(data.get('page', 1))
    page_size = int(data.get('page_size', 20))
    offset = (page - 1) * page_size
    base = db.session.query(FactConvContent)
    base = _apply_date_ch(base, FactConvContent, '线索日期', filters)
    total = base.count()
    rows = base.order_by(FactConvContent.id.desc()).offset(offset).limit(page_size).all()
    detail = []
    for r in rows:
        detail.append({
            'id': r.id,
            '平台来源': r.平台来源 or '',
            '线索日期': str(r.线索日期 or ''),
            '微信昵称': r.微信昵称 or '',
            '资金账号': r.资金账号 or '',
            '是否客户开口': bool(r.是否客户开口),
            '是否开户': bool(r.是否开户),
            '是否为有效户': bool(r.是否为有效户),
            '平台用户昵称': r.平台用户昵称 or '',
            '广告代理商': r.广告代理商 or '',
            '资产': _f(r.资产),
            '客户贡献': _f(r.客户贡献),
        })
    return jsonify({'success': True, 'data': {'detail': detail, 'page': page, 'page_size': page_size, 'total': total}, 'meta': _META})

@bp.route('/appmarket-detail', methods=['POST'])
@handle_exceptions
def omni_channel_appmarket_detail():
    """互联网引流.应用市场 设备级明细"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    page = int(data.get('page', 1))
    page_size = int(data.get('page_size', 20))
    offset = (page - 1) * page_size
    base = db.session.query(FactConvAppmarket)
    base = _apply_date_ch(base, FactConvAppmarket, '下载日期', filters)
    total = base.count()
    rows = base.order_by(FactConvAppmarket.id.desc()).offset(offset).limit(page_size).all()
    detail = []
    for r in rows:
        detail.append({
            'id': r.id,
            '下载日期': str(r.下载日期 or ''),
            '应用市场': r.应用市场 or '',
            '渠道类型': r.渠道类型 or '',
            '是否激活APP': bool(r.是否激活APP),
            '是否开户成功': bool(r.是否开户成功),
            '是否有效户': bool(r.是否有效户),
            '总资产': _f(r.总资产),
            '累计创收': _f(r.累计创收),
        })
    return jsonify({'success': True, 'data': {'detail': detail, 'page': page, 'page_size': page_size, 'total': total}, 'meta': _META})

@bp.route('/nonad-detail', methods=['POST'])
@handle_exceptions
def omni_channel_nonad_detail():
    """非互联网引流 渠道 x 月 明细"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    page = int(data.get('page', 1))
    page_size = int(data.get('page_size', 20))
    offset = (page - 1) * page_size
    base = db.session.query(AggDailyChannelOpen).filter(AggDailyChannelOpen.渠道类别.in_(['合作机构', '员工开户', '自然流入']))
    base = _apply_date_ch(base, AggDailyChannelOpen, '时间区间', filters)
    total = base.count()
    rows = base.order_by(AggDailyChannelOpen.id.desc()).offset(offset).limit(page_size).all()
    detail = []
    for r in rows:
        detail.append({
            'id': r.id,
            '时间区间': str(r.时间区间 or ''),
            '渠道类别': r.渠道类别 or '',
            '渠道名称': r.渠道名称 or '',
            '开户成功人数': _s(r.开户成功人数),
            '有效户数': _s(r.有效户数),
        })
    return jsonify({'success': True, 'data': {'detail': detail, 'page': page, 'page_size': page_size, 'total': total}, 'meta': _META})

@bp.route('/filter-options', methods=['GET'])
@handle_exceptions
def omni_channel_filter_options():
    cats = [r[0] for r in db.session.query(AggDailyChannelOpen.渠道类别).distinct().all() if r[0]]
    platforms = [r[0] for r in db.session.query(FactConvContent.平台来源).distinct().all() if r[0]]
    markets = [r[0] for r in db.session.query(FactConvAppmarket.应用市场).distinct().all() if r[0]]
    return jsonify({
        'success': True,
        'data': {
            'channel_categories': sorted(cats),
            'content_platforms': sorted(platforms),
            'app_markets': sorted(markets),
        },
        'meta': _META,
    })

