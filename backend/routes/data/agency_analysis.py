# -*- coding: utf-8 -*-
"""代理商分析接口（v2 - 查 agg_vendor_daily）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('agency_analysis', __name__)


@bp.route('/agency-analysis', methods=['GET', 'POST'])
@handle_exceptions
def get_agency_analysis():
    if request.method == 'POST':
        body = request.get_json() or {}
        f = body.get('filters') or {}
        start_date = f.get('start_date')
        end_date = f.get('end_date')
        platforms = f.get('platforms') or []
        agencies = f.get('agencies') or []
        business_models = f.get('business_models') or []
    else:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        platforms = [p for p in (request.args.get('platforms') or '').split(',') if p]
        agencies = [a for a in (request.args.get('agencies') or '').split(',') if a]
        business_models = [b for b in (request.args.get('business_models') or '').split(',') if b]

    q = db.session.query(
        AggVendorDaily.平台,
        AggVendorDaily.业务模式,
        AggVendorDaily.厂商,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
        func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
        func.coalesce(func.sum(AggVendorDaily.存量客户资产), 0).label('existing_assets'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms: q = q.filter(AggVendorDaily.平台.in_(platforms))
    if agencies: q = q.filter(AggVendorDaily.厂商.in_(agencies))
    if business_models: q = q.filter(AggVendorDaily.业务模式.in_(business_models))
    q = q.group_by(AggVendorDaily.平台, AggVendorDaily.业务模式, AggVendorDaily.厂商)
    rows = q.all()

    def f(v):
        try: return float(v or 0)
        except: return 0.0
    def i(v):
        try: return int(v or 0)
        except: return 0

    summary = []
    for r in rows:
        cost, leads, opened = f(r.cost), i(r.leads), i(r.opened)
        summary.append({
            'platform': r.平台,
            'business_model': r.业务模式,
            'agency': r.厂商,
            'metrics': {
                'cost': round(cost, 2),
                'impressions': i(r.impressions),
                'clicks': i(r.clicks),
                'lead_users': leads,
                'opened_account_users': opened,
                'valid_customer_users': i(r.valid),
                'opened_account_assets': round(f(r.assets), 2),
                'existing_customer_assets': round(f(r.existing_assets), 2),
                'lead_cost': round(cost / leads, 2) if leads > 0 else 0,
                'account_cost': round(cost / opened, 2) if opened > 0 else 0,
            }
        })

    plat_sub = {}
    for item in summary:
        p = item['platform']
        if p not in plat_sub:
            plat_sub[p] = {'platform': p, 'business_model': '', 'agency': '[{} 小计]'.format(p),
                            'is_subtotal': True, 'metrics': {'cost': 0, 'impressions': 0, 'clicks': 0,
                            'lead_users': 0, 'opened_account_users': 0, 'valid_customer_users': 0,
                            'opened_account_assets': 0, 'existing_customer_assets': 0}}
        m = plat_sub[p]['metrics']
        for k in ['cost', 'impressions', 'clicks', 'lead_users', 'opened_account_users',
                  'valid_customer_users', 'opened_account_assets', 'existing_customer_assets']:
            m[k] += item['metrics'][k]

    grand = {'cost': 0, 'impressions': 0, 'clicks': 0, 'leads': 0, 'opened': 0, 'valid': 0, 'assets': 0, 'existing_assets': 0}
    for item in summary:
        m = item['metrics']
        grand['cost'] += m['cost']
        grand['impressions'] += m['impressions']
        grand['clicks'] += m['clicks']
        grand['leads'] += m['lead_users']
        grand['opened'] += m['opened_account_users']
        grand['valid'] += m['valid_customer_users']
        grand['assets'] += m['opened_account_assets']
        grand['existing_assets'] += m['existing_customer_assets']

    grand_row = {
        'platform': '', 'business_model': '', 'agency': '[合计]',
        'is_total': True,
        'metrics': {
            'cost': round(grand['cost'], 2),
            'impressions': grand['impressions'],
            'clicks': grand['clicks'],
            'lead_users': grand['leads'],
            'opened_account_users': grand['opened'],
            'valid_customer_users': grand['valid'],
            'opened_account_assets': round(grand['assets'], 2),
            'existing_customer_assets': round(grand['existing_assets'], 2),
            'lead_cost': round(grand['cost'] / grand['leads'], 2) if grand['leads'] > 0 else 0,
            'account_cost': round(grand['cost'] / grand['opened'], 2) if grand['opened'] > 0 else 0,
        }
    }
    final_summary = summary + list(plat_sub.values()) + [grand_row]

    tq = db.session.query(
        AggVendorDaily.日期,
        AggVendorDaily.平台,
        AggVendorDaily.业务模式,
        AggVendorDaily.厂商,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
    )
    if start_date and end_date:
        tq = tq.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms: tq = tq.filter(AggVendorDaily.平台.in_(platforms))
    if agencies: tq = tq.filter(AggVendorDaily.厂商.in_(agencies))
    if business_models: tq = tq.filter(AggVendorDaily.业务模式.in_(business_models))
    tq = tq.group_by(AggVendorDaily.日期, AggVendorDaily.平台, AggVendorDaily.业务模式, AggVendorDaily.厂商).order_by(AggVendorDaily.日期)
    trend_rows = tq.all()
    series = []
    for r in trend_rows:
        series.append({
            'date': str(r.日期),
            'platform': r.平台,
            'business_model': r.业务模式,
            'agency': r.厂商,
            'metrics': {
                'cost': round(f(r.cost), 2),
                'impressions': i(r.impressions),
                'clicks': i(r.clicks),
                'lead_users': i(r.leads),
                'opened_account_users': i(r.opened),
                'valid_customer_users': i(r.valid),
            }
        })
    dates = sorted(set([r['date'] for r in series]))
    _meta = {
        'agency_count': len(set([r.厂商 for r in rows if r.厂商])),
        'platform_count': len(set([r.平台 for r in rows if r.平台])),
    }
    return jsonify({'success': True, 'data': {'summary': final_summary, 'meta': _meta, 'trend': {'dates': dates, 'series': series}}})
