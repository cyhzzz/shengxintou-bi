# -*- coding: utf-8 -*-
"""通用查询接口（v2.1 - 顶层加 meta 标注 sums/derived 边界）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily, FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('query', __name__)


def _f(v):
    try: return float(v) if v is not None else 0.0
    except: return 0.0

def _i(v):
    try: return int(v) if v is not None else 0
    except: return 0


_META_QUERY = {
    'version': 'v2.1',
    'source_tables': ['agg_vendor_daily'],
    'note': 'SUM 走 SQL 聚合，div/mul 派生字段保兼容供旧前端；新前端应基于 sums 自计算',
}


@bp.route('/summary', methods=['POST'])
@handle_exceptions
def get_summary():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)
    platforms = filters.get('platforms') or []
    agencies = filters.get('agencies') or []
    business_models = filters.get('business_models') or []
    q = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
        func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
        func.coalesce(func.sum(AggVendorDaily.客户创收), 0).label('contribution'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms:
        q = q.filter(AggVendorDaily.平台.in_([str(p) for p in platforms]))
    if agencies:
        q = q.filter(AggVendorDaily.厂商.in_([str(a) for a in agencies]))
    if business_models:
        q = q.filter(AggVendorDaily.业务模式.in_([str(b) for b in business_models]))
    r = q.first()
    cost = _f(r.cost); impr = _i(r.impressions); clk = _i(r.clicks)
    leads = _i(r.leads); opened = _i(r.opened); valid = _i(r.valid)
    assets = _f(r.assets); contrib = _f(r.contribution)
    summary = {
        'total_cost': round(cost, 2),
        'total_impressions': impr,
        'total_clicks': clk,
        'total_leads': leads,
        'total_new_accounts': opened,
        'total_valid_customers': valid,
        'customer_assets': round(assets, 2),
        'customer_contribution': round(contrib, 2),
        # 派生（保兼容）— 新前端应用 sums 自计算
        'cost_per_lead': round(cost / leads, 2) if leads > 0 else 0,
        'cost_per_account': round(cost / opened, 2) if opened > 0 else 0,
        'cost_per_valid_account': round(cost / valid, 2) if valid > 0 else 0,
    }
    return jsonify({
        'success': True,
        'data': summary,
        'meta': {
            **_META_QUERY,
            'raw_sums_keys': list(k for k in summary.keys() if k not in ('cost_per_lead', 'cost_per_account', 'cost_per_valid_account')),
            'derived_keys': ['cost_per_lead', 'cost_per_account', 'cost_per_valid_account'],
        }
    })


@bp.route('/query', methods=['POST'])
@handle_exceptions
def query_data():
    data = request.get_json() or {}
    dimensions = data.get('dimensions', ['date'])
    metrics_req = data.get('metrics', ['cost', 'leads'])
    filters = data.get('filters') or {}
    limit = int(data.get('limit', 1000))

    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)

    sel, grp = [], []
    for d in dimensions:
        if d == 'date':
            sel.append(AggVendorDaily.日期.label('date'))
            grp.append(AggVendorDaily.日期)
        elif d == 'platform':
            sel.append(AggVendorDaily.平台.label('platform'))
            grp.append(AggVendorDaily.平台)
        elif d == 'agency':
            sel.append(AggVendorDaily.厂商.label('agency'))
            grp.append(AggVendorDaily.厂商)
        elif d == 'business_model':
            sel.append(AggVendorDaily.业务模式.label('business_model'))
            grp.append(AggVendorDaily.业务模式)

    metric_map = {
        'cost': AggVendorDaily.花费,
        'impressions': AggVendorDaily.展示量,
        'clicks': AggVendorDaily.点击量,
        'leads': AggVendorDaily.线索数,
        'new_accounts': AggVendorDaily.开户人数,
        'valid_customers': AggVendorDaily.有效户人数,
        'customer_assets': AggVendorDaily.客户资产,
        'customer_contribution': AggVendorDaily.客户创收,
    }
    for m in metrics_req:
        col = metric_map.get(m)
        if col is not None:
            sel.append(func.coalesce(func.sum(col), 0).label(m))

    q = db.session.query(*sel)
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if filters.get('platforms'):
        q = q.filter(AggVendorDaily.平台.in_([str(p) for p in filters['platforms']]))
    if filters.get('agencies'):
        q = q.filter(AggVendorDaily.厂商.in_([str(a) for a in filters['agencies']]))
    if filters.get('business_models'):
        q = q.filter(AggVendorDaily.业务模式.in_([str(b) for b in filters['business_models']]))
    for g in grp:
        q = q.group_by(g)
    q = q.order_by(*grp).limit(limit)
    rows = q.all()

    output = []
    for row in rows:
        item = {d: getattr(row, d, None) for d in dimensions}
        item['metrics'] = {}
        for m in metrics_req:
            v = getattr(row, m, 0)
            try:
                if m in ('cost', 'customer_assets', 'customer_contribution'):
                    item['metrics'][m] = float(v) if v else 0
                else:
                    item['metrics'][m] = int(v) if v else 0
            except Exception:
                item['metrics'][m] = 0
        output.append(item)
    return jsonify({
        'success': True,
        'data': output,
        'total': len(output),
        'meta': {**_META_QUERY, 'raw_sums_keys': metrics_req, 'derived_keys': []},
    })


@bp.route('/employees', methods=['GET'])
@handle_exceptions
def get_employees():
    rows = db.session.query(
        FactConvContent.添加员工号,
        FactConvContent.添加员工姓名
    ).filter(
        FactConvContent.添加员工姓名.isnot(None),
        FactConvContent.添加员工姓名 != ''
    ).distinct().order_by(FactConvContent.添加员工姓名).all()
    result = [{'employee_no': str(e.添加员工号 or ''), 'employee_name': e.添加员工姓名 or ''} for e in rows]
    return jsonify({'success': True, 'data': result, 'meta': {**_META_QUERY, 'source_table': 'fact_conv_content'}})
