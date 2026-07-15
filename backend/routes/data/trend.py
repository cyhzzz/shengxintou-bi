# -*- coding: utf-8 -*-
"""趋势数据接口（v2 - 查 agg_vendor_daily）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import expand_short_to_fulls

bp = Blueprint('trend', __name__)


@bp.route('/trend', methods=['POST'])
@handle_exceptions
def get_trend():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    metrics = data.get('metrics', ['cost', 'leads'])
    granularity = data.get('granularity', 'daily')

    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)

    if granularity == 'weekly':
        period = func.strftime('%Y-%W', AggVendorDaily.日期).label('period')
    elif granularity == 'monthly':
        period = func.strftime('%Y-%m', AggVendorDaily.日期).label('period')
    else:
        period = AggVendorDaily.日期.label('period')

    metric_map = {
        'cost': AggVendorDaily.花费,
        'impressions': AggVendorDaily.展示量,
        'clicks': AggVendorDaily.点击量,
        'leads': AggVendorDaily.线索数,
        'lead_users': AggVendorDaily.线索数,
        'new_accounts': AggVendorDaily.开户人数,
        'opened_account_users': AggVendorDaily.开户人数,
        'valid_customer_users': AggVendorDaily.有效户人数,
    }
    sel = [period]
    for m in metrics:
        col = metric_map.get(m)
        if col is not None:
            sel.append(func.coalesce(func.sum(col), 0).label(m))

    q = db.session.query(*sel)
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if filters.get('platforms'):
        q = q.filter(AggVendorDaily.平台.in_([str(p) for p in filters['platforms']]))
    if filters.get('agencies'):
        q = q.filter(AggVendorDaily.厂商.in_(expand_short_to_fulls([str(a) for a in filters['agencies']])))
    if filters.get('business_models'):
        q = q.filter(AggVendorDaily.业务模式.in_([str(b) for b in filters['business_models']]))
    if granularity == 'daily':
        q = q.group_by(AggVendorDaily.日期).order_by(AggVendorDaily.日期)
    else:
        q = q.group_by('period').order_by('period')
    rows = q.all()
    dates = [str(r.period) for r in rows]
    series = []
    for m in metrics:
        data_pts = []
        for r in rows:
            v = getattr(r, m, 0) or 0
            try:
                if m == 'cost':
                    data_pts.append(round(float(v), 2))
                else:
                    data_pts.append(int(v))
            except (TypeError, ValueError):
                data_pts.append(0)
        series.append({'name': m, 'data': data_pts})
    return jsonify({'success': True, 'data': {'dates': dates, 'series': series}})


@bp.route('/trend/daily', methods=['GET'])
@handle_exceptions
def get_trend_daily():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    platforms = [p for p in (request.args.get('platforms') or '').split(',') if p]
    agencies = [a for a in (request.args.get('agencies') or '').split(',') if a]
    business_models = [b for b in (request.args.get('business_models') or '').split(',') if b]
    q = db.session.query(
        AggVendorDaily.日期.label('date'),
        AggVendorDaily.平台.label('platform'),
        AggVendorDaily.厂商.label('agency'),
        AggVendorDaily.业务模式.label('business_model'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened_account_users'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid_customer_users'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms:
        q = q.filter(AggVendorDaily.平台.in_(platforms))
    if agencies:
        q = q.filter(AggVendorDaily.厂商.in_(expand_short_to_fulls(agencies)))
    if business_models:
        q = q.filter(AggVendorDaily.业务模式.in_(business_models))
    q = q.group_by(AggVendorDaily.日期, AggVendorDaily.平台, AggVendorDaily.厂商, AggVendorDaily.业务模式).order_by(AggVendorDaily.日期)
    rows = q.all()

    def f(v):
        try: return float(v or 0)
        except: return 0
    def i(v):
        try: return int(v or 0)
        except: return 0
    series = []
    for r in rows:
        series.append({
            'date': str(r.date),
            'platform': r.platform,
            'business_model': r.business_model,
            'agency': r.agency,
            'metrics': {
                'cost': round(f(r.cost), 2),
                'impressions': i(r.impressions),
                'clicks': i(r.clicks),
                'lead_users': i(r.leads),
                'opened_account_users': i(r.opened_account_users),
                'valid_customer_users': i(r.valid_customer_users),
            }
        })
    return jsonify({'success': True, 'dates': sorted(set([r['date'] for r in series])), 'series': series})
