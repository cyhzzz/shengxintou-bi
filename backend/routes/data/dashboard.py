# -*- coding: utf-8 -*-
"""仪表盘数据接口（v2 - 查 agg_vendor_daily + fact_conv_content）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily, DimAccount
from backend.database import db
from backend.utils.decorators import handle_exceptions
from datetime import datetime, timedelta

bp = Blueprint('dashboard', __name__)


def _f(v):
    try: return float(v) if v is not None else 0.0
    except: return 0.0


def _i(v):
    try: return int(v) if v is not None else 0
    except: return 0


def _apply_filters(q, filters, model):
    if filters.get('start_date') and filters.get('end_date'):
        q = q.filter(and_(model.日期 >= filters['start_date'], model.日期 <= filters['end_date']))
    if filters.get('platforms'):
        q = q.filter(model.平台.in_([str(p) for p in filters['platforms']]))
    if filters.get('agencies'):
        q = q.filter(model.厂商.in_([str(a) for a in filters['agencies']]))
    if filters.get('business_models'):
        q = q.filter(model.业务模式.in_([str(b) for b in filters['business_models']]))
    return q


@bp.route('/dashboard/core-metrics', methods=['POST'])
@handle_exceptions
def get_dashboard_core_metrics():
    data = request.get_json() or {}
    filters = {
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'platforms': data.get('platforms') or [],
        'agencies': data.get('agencies') or [],
        'business_models': data.get('business_models') or [],
    }
    main_q = _apply_filters(
        db.session.query(
            func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
            func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
            func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
            func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
            func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
            func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
            func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
            func.coalesce(func.sum(AggVendorDaily.客户创收), 0).label('contribution'),
            func.coalesce(func.sum(AggVendorDaily.存量客户资产), 0).label('existing_assets'),
        ),
        filters, AggVendorDaily
    ).first()
    core = {
        'new_customers': _i(main_q.opened),
        'investment': round(_f(main_q.cost), 2),
        'new_valid_accounts': _i(main_q.valid),
        'total_leads': _i(main_q.leads),
        'total_impressions': _i(main_q.impressions),
        'total_clicks': _i(main_q.clicks),
        'customer_assets': round(_f(main_q.assets), 2),
        'customer_contribution': round(_f(main_q.contribution), 2),
        'existing_customers_assets': round(_f(main_q.existing_assets), 2),
        'cost_per_valid_account': round(_f(main_q.cost) / _i(main_q.valid), 2) if _i(main_q.valid) > 0 else 0,
        'cost_per_lead': round(_f(main_q.cost) / _i(main_q.leads), 2) if _i(main_q.leads) > 0 else 0,
        'cost_per_account': round(_f(main_q.cost) / _i(main_q.opened), 2) if _i(main_q.opened) > 0 else 0,
    }
    wow = {}
    try:
        if filters.get('start_date') and filters.get('end_date'):
            s = datetime.strptime(filters['start_date'], '%Y-%m-%d').date()
            e = datetime.strptime(filters['end_date'], '%Y-%m-%d').date()
            days = (e - s).days + 1
            prev_e = s - timedelta(days=1)
            prev_s = prev_e - timedelta(days=days - 1)
            pf = dict(filters)
            pf['start_date'] = prev_s.strftime('%Y-%m-%d')
            pf['end_date'] = prev_e.strftime('%Y-%m-%d')
            prev_q = _apply_filters(
                db.session.query(
                    func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
                    func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
                    func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
                    func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
                    func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
                    func.coalesce(func.sum(AggVendorDaily.客户创收), 0).label('contribution'),
                ),
                pf, AggVendorDaily
            ).first()

            def _pct(a, b):
                a, b = float(a or 0), float(b or 0)
                return round((a - b) / b * 100, 2) if b > 0 else 0

            wow = {
                'investment': {'value': _pct(main_q.cost, prev_q.cost), 'trend': 'up' if main_q.cost > prev_q.cost else 'down', 'color': 'red'},
                'new_customers': {'value': _pct(main_q.opened, prev_q.opened), 'trend': 'up' if main_q.opened > prev_q.opened else 'down', 'color': 'green'},
                'new_valid_accounts': {'value': _pct(main_q.valid, prev_q.valid), 'trend': 'up' if main_q.valid > prev_q.valid else 'down', 'color': 'green'},
                'total_leads': {'value': _pct(main_q.leads, prev_q.leads), 'trend': 'up' if main_q.leads > prev_q.leads else 'down', 'color': 'green'},
                'customer_assets': {'value': _pct(main_q.assets, prev_q.assets), 'trend': 'up' if main_q.assets > prev_q.assets else 'down', 'color': 'green'},
                'customer_contribution': {'value': _pct(main_q.contribution, prev_q.contribution), 'trend': 'up' if main_q.contribution > prev_q.contribution else 'down', 'color': 'green'},
            }
    except Exception:
        pass
    return jsonify({'success': True, 'data': {'core_metrics': core, 'wow_changes': wow}})


@bp.route('/dashboard/trend-data', methods=['POST'])
@handle_exceptions
def get_dashboard_trend_data():
    data = request.get_json() or {}
    metric_type = data.get('metric_type', 'cost_per_lead')
    granularity = data.get('granularity', 'daily')
    filters = {
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'platforms': data.get('platforms') or [],
        'agencies': data.get('agencies') or [],
        'business_models': data.get('business_models') or [],
    }
    if granularity == 'weekly':
        period = func.strftime('%Y-%W', AggVendorDaily.日期).label('period')
    elif granularity == 'monthly':
        period = func.strftime('%Y-%m', AggVendorDaily.日期).label('period')
    else:
        period = AggVendorDaily.日期.label('period')
    q = _apply_filters(
        db.session.query(
            period,
            func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
            func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
            func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
            func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
            func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
            func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
        ),
        filters, AggVendorDaily
    )
    if granularity == 'daily':
        q = q.group_by(AggVendorDaily.日期).order_by(AggVendorDaily.日期)
    else:
        q = q.group_by('period').order_by('period')
    rows = q.all()
    dates, values = [], []
    for r in rows:
        dates.append(str(r.period))
        cost = _f(r.cost)
        leads, opened, valid = _i(r.leads), _i(r.opened), _i(r.valid)
        if metric_type == 'cost_per_lead':
            values.append(round(cost / leads, 2) if leads > 0 else 0)
        elif metric_type == 'cost_per_customer':
            values.append(round(cost / opened, 2) if opened > 0 else 0)
        elif metric_type == 'cost_per_valid_account':
            values.append(round(cost / valid, 2) if valid > 0 else 0)
        elif metric_type == 'investment':
            values.append(round(cost, 2))
        elif metric_type == 'impressions':
            values.append(_i(r.impressions))
        elif metric_type == 'clicks':
            values.append(_i(r.clicks))
        elif metric_type == 'leads':
            values.append(leads)
        elif metric_type == 'new_customers':
            values.append(opened)
        else:
            values.append(0)
    return jsonify({
        'success': True,
        'data': {
            'dates': dates,
            'values': values,
            'metric_type': metric_type,
            'trend_data': [{'date': d, 'value': v} for d, v in zip(dates, values)],
        }
    })


@bp.route('/dashboard/accounts', methods=['POST'])
@handle_exceptions
def get_dashboard_accounts():
    data = request.get_json() or {}
    platforms = data.get('platforms') or []
    q = db.session.query(DimAccount.main_account_name).distinct()
    if platforms:
        q = q.filter(DimAccount.platform.in_([str(p) for p in platforms]))
    rows = [r[0] for r in q.all() if r[0]]
    return jsonify({'success': True, 'data': {'accounts': sorted(set(rows))}})
