# -*- coding: utf-8 -*-
"""仪表盘数据接口（v2.1 - 后端返 sums，前端可自计算 rates）

v2.1 调整：
- /dashboard/trend-data 关键改造：每个 trend_data point 含完整 sums
  （cost/impressions/clicks/leads/opened/valid）与派生 _derived 字典，
  前端可即时切换 metric_type 而无需重新发起后端请求。
- /dashboard/core-metrics：保留全部 sums + 派生（保兼容），
  顶层加 meta 标注 raw_sums_keys / derived_keys。
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily, DimAccount
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import expand_short_to_fulls
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


_META_DASHBOARD = {
    'version': 'v2.1',
    'source_table': 'agg_vendor_daily',
    'note': '后端主要负责 SUM/count 聚合；ratio/cost 派生字段保兼容供旧前端',
}


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
    cost, impr, clk = _f(main_q.cost), _i(main_q.impressions), _i(main_q.clicks)
    leads, opened, valid = _i(main_q.leads), _i(main_q.opened), _i(main_q.valid)
    assets, contrib, exist_assets = _f(main_q.assets), _f(main_q.contribution), _f(main_q.existing_assets)
    core = {
        'new_customers': opened,
        'investment': round(cost, 2),
        'new_valid_accounts': valid,
        'total_leads': leads,
        'total_impressions': impr,
        'total_clicks': clk,
        'customer_assets': round(assets, 2),
        'customer_contribution': round(contrib, 2),
        'existing_customers_assets': round(exist_assets, 2),
        'cost_per_valid_account': round(cost / valid, 2) if valid > 0 else 0,
        'cost_per_lead': round(cost / leads, 2) if leads > 0 else 0,
        'cost_per_account': round(cost / opened, 2) if opened > 0 else 0,
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
                    func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
                    func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
                    func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
                    func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
                    func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid'),
                    func.coalesce(func.sum(AggVendorDaily.客户资产), 0).label('assets'),
                    func.coalesce(func.sum(AggVendorDaily.客户创收), 0).label('contribution'),
                    func.coalesce(func.sum(AggVendorDaily.存量客户资产), 0).label('existing_assets'),
                ),
                pf, AggVendorDaily
            ).first()
            def _pct(a, b):
                a, b = float(a or 0), float(b or 0)
                return round((a - b) / b * 100, 2) if b > 0 else 0
            # wow 构造：trade 跟 curr/prev 比较走，color 随 trade 反转（cost 类用 inverse=True）
            def _w(curr, prev, inverse=False):
                is_up = float(curr or 0) > float(prev or 0)
                if is_up:
                    color = 'red' if inverse else 'green'
                else:
                    color = 'green' if inverse else 'red'
                return {'value': _pct(curr, prev), 'trend': 'up' if is_up else 'down', 'color': color}
            # 前后 cost_per_* 派生值（分母是 leads/opened/valid）
            curr_cpl = round(cost / leads, 2) if leads > 0 else 0
            curr_cpa = round(cost / opened, 2) if opened > 0 else 0
            curr_cpva = round(cost / valid, 2) if valid > 0 else 0
            prev_cpl = round(_f(prev_q.cost) / _i(prev_q.leads), 2) if _i(prev_q.leads) > 0 else 0
            prev_cpa = round(_f(prev_q.cost) / _i(prev_q.opened), 2) if _i(prev_q.opened) > 0 else 0
            prev_cpva = round(_f(prev_q.cost) / _i(prev_q.valid), 2) if _i(prev_q.valid) > 0 else 0
            wow = {
                'investment': _w(main_q.cost, prev_q.cost, inverse=True),
                'total_impressions': _w(main_q.impressions, prev_q.impressions),
                'total_clicks': _w(main_q.clicks, prev_q.clicks),
                'total_leads': _w(main_q.leads, prev_q.leads),
                'new_customers': _w(main_q.opened, prev_q.opened),
                'new_valid_accounts': _w(main_q.valid, prev_q.valid),
                'customer_assets': _w(main_q.assets, prev_q.assets),
                'customer_contribution': _w(main_q.contribution, prev_q.contribution),
                'existing_customers_assets': _w(main_q.existing_assets, prev_q.existing_assets),
                'cost_per_lead': _w(curr_cpl, prev_cpl, inverse=True),
                'cost_per_account': _w(curr_cpa, prev_cpa, inverse=True),
                'cost_per_valid_account': _w(curr_cpva, prev_cpva, inverse=True),
            }
    except Exception:
        pass
    return jsonify({
        'success': True,
        'data': {'core_metrics': core, 'wow_changes': wow},
        'meta': {
            **_META_DASHBOARD,
            'raw_sums_keys': ['investment', 'total_leads', 'total_impressions', 'total_clicks', 'new_customers', 'new_valid_accounts', 'customer_assets', 'customer_contribution', 'existing_customers_assets'],
            'derived_keys': ['cost_per_lead', 'cost_per_account', 'cost_per_valid_account'],
        }
    })


@bp.route('/dashboard/trend-data', methods=['POST'])
@handle_exceptions
def get_dashboard_trend_data():
    """趋势端点（v2.1 - 后端返 sums，前端算 rates）

    每个 trend_data point 同时含 sums 字段（cost/impressions/clicks/leads/opened/valid）
    与 _derived 子对象（cost_per_lead/cost_per_account/cost_per_valid_account/ctr/...）。
    前端可即时切换 metric_type 而无需重新发起后端请求。
    """
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

    def _per_metric(mt):
        if mt == 'cost_per_lead': return lambda c, ld, op, vl, clk, i: (round(c / ld, 2) if ld > 0 else 0)
        if mt == 'cost_per_customer' or mt == 'cost_per_account':
            return lambda c, ld, op, vl, clk, i: (round(c / op, 2) if op > 0 else 0)
        if mt == 'cost_per_valid_account':
            return lambda c, ld, op, vl, clk, i: (round(c / vl, 2) if vl > 0 else 0)
        if mt == 'investment': return lambda c, ld, op, vl, clk, i: round(c, 2)
        if mt == 'impressions': return lambda c, ld, op, vl, clk, i: i
        if mt == 'clicks': return lambda c, ld, op, vl, clk, i: clk
        if mt == 'leads': return lambda c, ld, op, vl, clk, i: ld
        if mt == 'new_customers': return lambda c, ld, op, vl, clk, i: op
        if mt == 'valid_customers': return lambda c, ld, op, vl, clk, i: vl
        return lambda c, ld, op, vl, clk, i: 0

    selector = _per_metric(metric_type)

    dates, trend_data = [], []
    for r in rows:
        d = str(r.period)
        cost = _f(r.cost); impr = _i(r.impressions); clk = _i(r.clicks)
        leads = _i(r.leads); opened = _i(r.opened); valid = _i(r.valid)
        value = selector(cost, leads, opened, valid, clk, impr)
        point = {
            'date': d,
            'cost': round(cost, 2),
            'impressions': impr,
            'clicks': clk,
            'leads': leads,
            'opened': opened,
            'valid': valid,
            '_derived': {
                'cost_per_lead': round(cost / leads, 2) if leads > 0 else 0,
                'cost_per_account': round(cost / opened, 2) if opened > 0 else 0,
                'cost_per_valid_account': round(cost / valid, 2) if valid > 0 else 0,
                'ctr': round(clk / impr * 100, 4) if impr > 0 else 0,
                'click_to_lead_rate': round(leads / clk * 100, 4) if clk > 0 else 0,
                'lead_to_account_rate': round(opened / leads * 100, 4) if leads > 0 else 0,
                'account_to_valid_rate': round(valid / opened * 100, 4) if opened > 0 else 0,
            },
            'value': value,
        }
        dates.append(d)
        trend_data.append(point)
    return jsonify({
        'success': True,
        'data': {'dates': dates, 'trend_data': trend_data, 'metric_type': metric_type},
        'meta': {
            **_META_DASHBOARD,
            'raw_sums_keys': ['cost', 'impressions', 'clicks', 'leads', 'opened', 'valid'],
            'derived_keys': ['cost_per_lead', 'cost_per_account', 'cost_per_valid_account', 'ctr', 'click_to_lead_rate', 'lead_to_account_rate', 'account_to_valid_rate'],
            'supported_metric_types': [
                'cost_per_lead', 'cost_per_customer', 'cost_per_valid_account', 'cost_per_account',
                'investment', 'impressions', 'clicks', 'leads', 'new_customers', 'valid_customers',
            ],
            'note': '前端可用 sums 字段自计算任意 derived 指标，零 round-trip 切换 metric_type',
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
