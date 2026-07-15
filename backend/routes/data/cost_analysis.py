# -*- coding: utf-8 -*-
"""成本分析 + 转化漏斗（v2.1）

每个 item 内：
- metrics：来自 SQL SUM 的 sums（cost/impressions/clicks/leads/new_accounts）
- cost_metrics：派生（保兼容）；新前端应基于 metrics 自计算
- summary：totals + 派生 avg_cost_per_*
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily, FactConvContent, FactConvAppmarket
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import expand_short_to_fulls

bp = Blueprint('cost_analysis', __name__)

_META = {
    'version': 'v2.1',
    'source_tables': ['agg_vendor_daily', 'fact_conv_content'],
    'note': 'metrics/totals 是 SQL SUM 聚合；cost_metrics/avg_cost_* 是派生',
}


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
        cost, impr, clk, ld, op = f(r.cost), i(r.impressions), i(r.clicks), i(r.leads), i(r.opened)
        output.append({
            'platform': r.平台,
            'agency': r.厂商,
            'metrics': {
                'cost': round(cost, 2),
                'impressions': impr,
                'clicks': clk,
                'leads': ld,
                'new_accounts': op,
            },
            'cost_metrics': {
                'cost_per_lead': round(cost / ld, 2) if ld > 0 else 0,
                'cost_per_account': round(cost / op, 2) if op > 0 else 0,
                'cost_per_click': round(cost / clk, 2) if clk > 0 else 0,
                'cpm': round(cost / impr * 1000, 2) if impr > 0 else 0,
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
        },
        'meta': {**_META, 'raw_sums_keys': ['metrics.cost', 'metrics.impressions', 'metrics.clicks', 'metrics.leads', 'metrics.new_accounts'], 'derived_keys': ['cost_metrics.cost_per_lead', 'cost_metrics.cost_per_account', 'cost_metrics.cost_per_click', 'cost_metrics.cpm']},
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
        leads = int(r.leads or 0); mouth = int(r.mouth or 0); valid_lead = int(r.valid_lead or 0)
        opened = int(r.opened or 0); valid = int(r.valid or 0)
        # funnel 同时含 sums (value) 与派生 rate，前端可用 sums 自算 rate
        funnel = [
            {'step': '客户线索', 'value': leads, 'rate': 100.0},
            {'step': '客户开口', 'value': mouth, 'rate': round(mouth / leads * 100, 2) if leads > 0 else 0},
            {'step': '有效线索', 'value': valid_lead, 'rate': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0},
            {'step': '成功开户', 'value': opened, 'rate': round(opened / valid_lead * 100, 2) if valid_lead > 0 else 0},
            {'step': '有效户', 'value': valid, 'rate': round(valid / opened * 100, 2) if opened > 0 else 0},
        ]
        core = {'cost': 0, 'lead_users': leads, 'opened_account_users': opened, 'valid_customer_users': valid}
        return jsonify({'success': True, 'data': {'funnel': funnel, 'core_metrics': core, 'is_employee_mode': True},
                        'meta': {**_META, 'funnel_source': 'fact_conv_content',
                                 'raw_sums_keys': ['cost', 'lead_users', 'opened_account_users', 'valid_customer_users'],
                                 'derived_keys': ['funnel[].rate']}})

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
    return jsonify({'success': True, 'data': {'funnel': funnel, 'core_metrics': core, 'is_employee_mode': False},
                    'meta': {**_META, 'funnel_source': 'agg_vendor_daily + fact_conv_content',
                             'raw_sums_keys': ['cost', 'lead_users', 'opened_account_users', 'valid_customer_users'],
                             'derived_keys': ['funnel[].rate']}})




@bp.route('/conversion-funnel/split', methods=['POST', 'GET'])
@handle_exceptions
def get_conversion_funnel_split():
    # v3.1: 同时返回内容平台 + 应用市场 两套独立漏斗
    from backend.models_v2 import FactConvAppmarket
    if request.method == 'GET':
        filters = {
            'start_date': request.args.get('start_date'),
            'end_date': request.args.get('end_date'),
            'platforms': [p for p in (request.args.get('platforms') or '').split(',') if p],
        }
        is_employee_mode = (request.args.get('is_employee_mode') or 'false').lower() == 'true'
    else:
        body = request.get_json() or {}
        filters = body.get('filters') or {}
        is_employee_mode = bool(body.get('is_employee_mode', False))

    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms = filters.get('platforms') or []

    cq = db.session.query(
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
    )
    if sd and ed:
        cq = cq.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms:
        cq = cq.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    cr = cq.first()
    leads = int(cr.leads or 0); mouth = int(cr.mouth or 0); valid_lead = int(cr.valid_lead or 0)
    opened = int(cr.opened or 0); valid = int(cr.valid or 0)

    # 头 2 阶段（广告曝光 / 客户点击）从 agg_vendor_daily 取（内容平台 = 小红书/腾讯/抖音/快手）
    vq = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
    )
    if sd and ed:
        vq = vq.filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed))
    if platforms:
        vq = vq.filter(AggVendorDaily.平台.in_([str(p) for p in platforms]))
    vr = vq.first()
    impressions = int(vr.impressions or 0)
    clicks = int(vr.clicks or 0)
    cost_total = float(vr.cost or 0)

    # 7 阶段漏斗（v3.1 §三.1）
    content_stages = [
        {'step': '广告曝光', 'value': impressions, 'rate': 100.0},
        {'step': '客户点击', 'value': clicks, 'rate': round(clicks / impressions * 100, 2) if impressions > 0 else 0},
        {'step': '客户线索', 'value': leads, 'rate': round(leads / clicks * 100, 2) if clicks > 0 else 0},
        {'step': '客户开口', 'value': mouth, 'rate': round(mouth / leads * 100, 2) if leads > 0 else 0},
        {'step': '有效线索', 'value': valid_lead, 'rate': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0},
        {'step': '成功开户', 'value': opened, 'rate': round(opened / valid_lead * 100, 2) if valid_lead > 0 else 0},
        {'step': '有效户', 'value': valid, 'rate': round(valid / opened * 100, 2) if opened > 0 else 0},
    ]

    stage_cols = [
        ('激活APP', FactConvAppmarket.是否激活APP),
        ('开户注册', FactConvAppmarket.是否开户注册),
        ('注册身份证', FactConvAppmarket.是否注册身份证),
        ('注册银行卡', FactConvAppmarket.是否注册银行卡),
        ('提交开户', FactConvAppmarket.是否提交开户),
        ('开户成功', FactConvAppmarket.是否开户成功),
        ('入金', FactConvAppmarket.是否入金),
        ('有效户', FactConvAppmarket.是否有效户),
    ]
    aq = db.session.query(*[func.coalesce(func.sum(col), 0).label(name) for name, col in stage_cols])
    if sd and ed:
        aq = aq.filter(and_(FactConvAppmarket.下载日期 >= sd, FactConvAppmarket.下载日期 <= ed))
    ar = aq.first()
    counts = {name: int(getattr(ar, name) or 0) for name, _ in stage_cols}
    base = counts['激活APP']
    appmarket_stages = [
        {'step': s, 'value': counts[s], 'rate': round(counts[s] / base * 100, 2) if base > 0 else 0}
        for s, _ in stage_cols
    ]

    return jsonify({
        'success': True,
        'data': {
            'funnels': {
                'content': {
                    'stages': content_stages,
                    'data_source': 'fact_conv_content + agg_vendor_daily(前 2 段)',
                    'channel_category': 'content',
                },
                'appmarket': {
                    'stages': appmarket_stages,
                    'data_source': 'fact_conv_appmarket',
                    'channel_category': 'appmarket',
                },
            },
            'core_metrics': {
                'cost': round(cost_total, 2),
                'lead_users': leads + counts['激活APP'],
                'opened_account_users': opened + counts['开户成功'],
                'valid_customer_users': valid + counts['有效户'],
            },
            'is_employee_mode': is_employee_mode,
        },
        'meta': {**_META, 'version': 'v3.1-split', 'raw_sums_keys': ['value'], 'derived_keys': ['rate']},
    })
