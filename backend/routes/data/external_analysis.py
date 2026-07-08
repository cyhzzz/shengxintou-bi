# -*- coding: utf-8 -*-
"""外部数据分析接口（v2.1 - meta + sums 形态）

- platform_comparison 每项 metrics：原 sums（SUM/count）+ 3 个派生 rate/cost
- 派生字段保留（保兼容），新前端应用 sums 自计算
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('external_analysis', __name__)

_META = {
    'version': 'v2.1',
    'source_table': 'agg_vendor_daily',
    'note': 'metrics 是 SQL SUM 聚合；ctr/lead_rate/account_rate/cost_per_* 是派生',
}


@bp.route('/external-data-analysis', methods=['POST'])
@handle_exceptions
def get_external_data_analysis():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    start_date = filters.get('start_date') or (filters.get('date_range', [None, None])[0] if filters.get('date_range') else None)
    end_date = filters.get('end_date') or (filters.get('date_range', [None, None])[1] if filters.get('date_range') else None)
    platforms = filters.get('platforms') or []
    agencies = filters.get('agencies') or []
    business_models = filters.get('business_models') or []

    q = db.session.query(
        AggVendorDaily.日期,
        AggVendorDaily.平台,
        AggVendorDaily.厂商,
        AggVendorDaily.业务模式,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms:
        q = q.filter(AggVendorDaily.平台.in_([str(p) for p in platforms]))
    if agencies:
        q = q.filter(AggVendorDaily.厂商.in_([str(a) for a in agencies]))
    if business_models:
        q = q.filter(AggVendorDaily.业务模式.in_([str(b) for b in business_models]))
    q = q.group_by(AggVendorDaily.日期, AggVendorDaily.平台, AggVendorDaily.厂商, AggVendorDaily.业务模式)
    records = q.all()

    def f(v):
        try: return float(v or 0)
        except: return 0.0
    def i(v):
        try: return int(v or 0)
        except: return 0

    plat = {}
    for r in records:
        p = r.平台 or '未归因'
        if p not in plat:
            plat[p] = {'cost': 0, 'impressions': 0, 'clicks': 0, 'leads': 0, 'opened': 0}
        plat[p]['cost'] += f(r.cost)
        plat[p]['impressions'] += i(r.impressions)
        plat[p]['clicks'] += i(r.clicks)
        plat[p]['leads'] += i(r.leads)
        plat[p]['opened'] += i(r.opened)
    platform_comparison = []
    for p, v in plat.items():
        # sums（SUM/COUNT）+ 派生（前端 fallback）
        ctr = v['clicks'] / v['impressions'] * 100 if v['impressions'] > 0 else 0
        lead_rate = v['leads'] / v['clicks'] * 100 if v['clicks'] > 0 else 0
        account_rate = v['opened'] / v['leads'] * 100 if v['leads'] > 0 else 0
        platform_comparison.append({
            'platform': p,
            'metrics': {
                **v,
                'ctr': round(ctr, 2),
                'lead_rate': round(lead_rate, 2),
                'account_rate': round(account_rate, 2),
                'cost_per_lead': round(v['cost'] / v['leads'], 2) if v['leads'] > 0 else 0,
                'cost_per_account': round(v['cost'] / v['opened'], 2) if v['opened'] > 0 else 0,
            }
        })

    agency_stats = {}
    for r in records:
        a = r.厂商 or '未归因'
        if a not in agency_stats:
            agency_stats[a] = {'cost': 0, 'leads': 0, 'opened': 0, 'valid': 0, 'impressions': 0, 'clicks': 0}
        agency_stats[a]['cost'] += f(r.cost)
        agency_stats[a]['leads'] += i(r.leads)
        agency_stats[a]['opened'] += i(r.opened)
        agency_stats[a]['impressions'] += i(r.impressions)
        agency_stats[a]['clicks'] += i(r.clicks)
    agency_ranking = []
    for a, v in agency_stats.items():
        score = (v['opened'] * 100) + (v['leads'] * 10) - (v['cost'] / 10000)
        agency_ranking.append({'agency': a, 'metrics': v, 'score': round(score, 2)})
    agency_ranking.sort(key=lambda x: x['score'], reverse=True)

    bm_stats = {}
    for r in records:
        b = r.业务模式 or '未归因'
        if b not in bm_stats:
            bm_stats[b] = {'cost': 0, 'leads': 0, 'opened': 0}
        bm_stats[b]['cost'] += f(r.cost)
        bm_stats[b]['leads'] += i(r.leads)
        bm_stats[b]['opened'] += i(r.opened)
    business_model_analysis = [{'business_model': k, 'metrics': v} for k, v in bm_stats.items()]

    total_cost = sum(v['cost'] for v in plat.values())
    total_leads = sum(v['leads'] for v in plat.values())
    total_opened = sum(v['opened'] for v in plat.values())
    estimated_returns = total_opened * 10000
    roi = round((estimated_returns - total_cost) / total_cost * 100, 2) if total_cost > 0 else 0
    roi_analysis = {
        'total_investment': round(total_cost, 2),
        'total_returns': round(estimated_returns, 2),
        'net_profit': round(estimated_returns - total_cost, 2),
        'roi': roi,
    }

    perf = []
    seen = set()
    for r in records:
        key = (r.平台, r.厂商)
        if key in seen:
            continue
        seen.add(key)
        perf.append({
            'platform': r.平台, 'agency': r.厂商,
            'metrics': {'cost': f(r.cost), 'impressions': i(r.impressions), 'clicks': i(r.clicks),
                        'leads': i(r.leads), 'new_accounts': i(r.opened),
                        'ctr': 0, 'lead_rate': 0, 'account_rate': 0, 'cost_per_account': 0}
        })

    daily = {}
    for r in records:
        d = str(r.日期)
        if d not in daily:
            daily[d] = {'cost': 0, 'impressions': 0, 'clicks': 0, 'leads': 0, 'opened': 0}
        daily[d]['cost'] += f(r.cost)
        daily[d]['impressions'] += i(r.impressions)
        daily[d]['clicks'] += i(r.clicks)
        daily[d]['leads'] += i(r.leads)
        daily[d]['opened'] += i(r.opened)
    sorted_dates = sorted(daily.keys())
    trend_insights = {'dates': sorted_dates, 'cost_trend': 0, 'ctr_trend': 0, 'insights': [], 'recommendations': []}

    return jsonify({
        'success': True,
        'platform_comparison': platform_comparison,
        'agency_ranking': agency_ranking,
        'business_model_analysis': business_model_analysis,
        'roi_analysis': roi_analysis,
        'trend_insights': trend_insights,
        'performance_matrix': perf,
        'meta': {**_META,
                 'raw_sums_keys': ['cost', 'impressions', 'clicks', 'leads', 'opened'],
                 'derived_keys': ['ctr', 'lead_rate', 'account_rate', 'cost_per_lead', 'cost_per_account']},
    })