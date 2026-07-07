# -*- coding: utf-8 -*-
"""成本分析 + 转化漏斗（v2）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily, FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('cost_analysis', __name__)


@bp.route('/cost-analysis', methods=['POST'])
@handle_exceptions
def get_cost_analysis():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)

    q = db.session.query(
        AggVendorDaily.日期,
        AggVendorDaily.平台,
        AggVendorDaily.厂商,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if filters.get('platforms'):
        q = q.filter(AggVendorDaily.平台.in_([str(p) for p in filters['platforms']]))
    if filters.get('agencies'):
        q = q.filter(AggVendorDaily.厂商.in_([str(a) for a in filters['agencies']]))
    if filters.get('business_models'):
        q = q.filter(AggVendorDaily.业务模式.in_([str(b) for b in filters['business_models']]))
    q = q.group_by(AggVendorDaily.日期, AggVendorDaily.平台, AggVendorDaily.厂商)
    rows = q.all()

    def f(v):
        try: return float(v or 0)
        except: return 0
    def i(v):
        try: return int(v or 0)
        except: return 0

    output = []
    for r in rows:
        cost, impressions, clicks, leads, opened = f(r.cost), i(r.impressions), i(r.clicks), i(r.leads), i(r.opened)
        output.append({
            'platform': r.平台,
            'agency': r.厂商,
            'metrics': {
                'cost': round(cost, 2),
                'impressions': impressions,
                'clicks': clicks,
                'leads': leads,
                'new_accounts': opened,
            },
            'cost_metrics': {
                'cost_per_lead': round(cost / leads, 2) if leads > 0 else 0,
                'cost_per_account': round(cost / opened, 2) if opened > 0 else 0,
                'cost_per_click': round(cost / clicks, 2) if clicks > 0 else 0,
                'cpm': round(cost / impressions * 1000, 2) if impressions > 0 else 0,
            }
        })
    tc = sum(item['metrics']['cost'] for item in output)
    tl = sum(item['metrics']['leads'] for item in output)
    ta = sum(item['metrics']['new_accounts'] for item in output)
    return jsonify({
        'success': True,
        'data': output,
        'summary': {
            'total_cost': round(tc, 2),
            'total_leads': tl,
            'total_accounts': ta,
            'avg_cost_per_lead': round(tc / tl, 2) if tl > 0 else 0,
            'avg_cost_per_account': round(tc / ta, 2) if ta > 0 else 0,
        }
    })


@bp.route('/conversion-funnel', methods=['POST', 'GET'])
@handle_exceptions
def get_conversion_funnel():
    if request.method == 'GET':
        filters = {
            'start_date': request.args.get('start_date'),
            'end_date': request.args.get('end_date'),
            'platforms': [p for p in (request.args.get('platforms') or '').split(',') if p],
            'agencies': [a for a in (request.args.get('agencies') or '').split(',') if a],
            'business_models': [b for b in (request.args.get('business_models') or '').split(',') if b],
        }
        is_employee_mode = (request.args.get('is_employee_mode') or 'false').lower() == 'true'
    else:
        body = request.get_json() or {}
        filters = body.get('filters') or {}
        is_employee_mode = body.get('is_employee_mode', False)

    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)
    platforms = filters.get('platforms') or []
    agencies = filters.get('agencies') or []
    business_models = filters.get('business_models') or []

    if is_employee_mode:
        fq = db.session.query(
            func.count(FactConvContent.id).label('leads'),
            func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
            func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
            func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
            func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
        )
        if start_date and end_date:
            fq = fq.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
        if platforms:
            fq = fq.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
        r = fq.first()
        leads = int(r.leads or 0)
        mouth = int(r.mouth or 0)
        valid_lead = int(r.valid_lead or 0)
        opened = int(r.opened or 0)
        valid = int(r.valid or 0)
        funnel = [
            {'step': '客户线索', 'value': leads, 'rate': 100.0},
            {'step': '客户开口', 'value': mouth, 'rate': round(mouth / leads * 100, 2) if leads > 0 else 0},
            {'step': '有效线索', 'value': valid_lead, 'rate': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0},
            {'step': '成功开户', 'value': opened, 'rate': round(opened / valid_lead * 100, 2) if valid_lead > 0 else 0},
            {'step': '有效户', 'value': valid, 'rate': round(valid / opened * 100, 2) if opened > 0 else 0},
        ]
        core = {'cost': 0, 'lead_users': leads, 'opened_account_users': opened, 'valid_customer_users': valid}
        return jsonify({'success': True, 'data': {'funnel': funnel, 'core_metrics': core, 'is_employee_mode': True}})

    vq = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
    )
    if start_date and end_date:
        vq = vq.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms:
        vq = vq.filter(AggVendorDaily.平台.in_([str(p) for p in platforms]))
    if agencies:
        vq = vq.filter(AggVendorDaily.厂商.in_([str(a) for a in agencies]))
    if business_models:
        vq = vq.filter(AggVendorDaily.业务模式.in_([str(b) for b in business_models]))
    vr = vq.first()
    fcq = db.session.query(
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
    )
    if start_date and end_date:
        fcq = fcq.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
    if platforms:
        fcq = fcq.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    fcr = fcq.first()

    def f(v):
        try: return float(v or 0)
        except: return 0.0
    def i(v):
        try: return int(v or 0)
        except: return 0

    cost, impressions, clicks, leads = f(vr.cost), i(vr.impressions), i(vr.clicks), i(vr.leads)
    mouth, valid_lead = i(fcr.mouth), i(fcr.valid_lead)
    opened, valid = i(vr.opened), i(vr.valid)
    funnel = [
        {'step': '广告曝光', 'value': impressions, 'rate': 100.0},
        {'step': '客户点击', 'value': clicks, 'rate': round(clicks / impressions * 100, 2) if impressions > 0 else 0},
        {'step': '客户线索', 'value': leads, 'rate': round(leads / clicks * 100, 2) if clicks > 0 else 0},
        {'step': '客户开口', 'value': mouth, 'rate': round(mouth / leads * 100, 2) if leads > 0 else 0},
        {'step': '有效线索', 'value': valid_lead, 'rate': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0},
        {'step': '成功开户', 'value': opened, 'rate': round(opened / valid_lead * 100, 2) if valid_lead > 0 else 0},
        {'step': '有效户', 'value': valid, 'rate': round(valid / opened * 100, 2) if opened > 0 else 0},
    ]
    core = {'cost': round(cost, 2), 'lead_users': leads, 'opened_account_users': opened, 'valid_customer_users': valid}
    return jsonify({'success': True, 'data': {'funnel': funnel, 'core_metrics': core, 'is_employee_mode': False}})
