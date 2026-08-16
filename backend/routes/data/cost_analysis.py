# -*- coding: utf-8 -*-
"""成本分析 + 转化漏斗（v2.1）

每个 item 内：
- metrics：来自 SQL SUM 的 sums（cost/impressions/clicks/leads/new_accounts）
- cost_metrics：派生（保兼容）；新前端应基于 metrics 自计算
- summary：totals + 派生 avg_cost_per_*
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_
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

    # v3.1.25 业务规则：存量剔除在「有效线索」之后发生。
    # 客户线索/客户开口/有效线索统计全部记录（含存量），
    # 然后增加「有效线索(剔除存量)」阶段,后续成功开户/有效户只统计非存量记录。
    cq_all = db.session.query(
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
    )
    if sd and ed:
        cq_all = cq_all.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms:
        cq_all = cq_all.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    cr_all = cq_all.first()
    leads = int(cr_all.leads or 0); mouth = int(cr_all.mouth or 0)
    valid_lead = int(cr_all.valid_lead or 0)

    # 剔除存量后：有效线索(非存量)/成功开户/有效户仅统计新客户
    cq_new = db.session.query(
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('new_valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
    )
    if sd and ed:
        cq_new = cq_new.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms:
        cq_new = cq_new.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    cq_new = cq_new.filter(or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)))
    cr_new = cq_new.first()
    new_valid_lead = int(cr_new.new_valid_lead or 0)
    opened = int(cr_new.opened or 0)
    valid = int(cr_new.valid or 0)

    # 业务说明:成功开户可能大于有效线索(剔除存量),因为存在「非有效线索但新开户」的客户
    # (未标记为有效线索但实际开户成功)。统计该数量供前端页脚说明。
    extra_open_q = db.session.query(
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('extra_opened'),
    )
    if sd and ed:
        extra_open_q = extra_open_q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms:
        extra_open_q = extra_open_q.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    extra_open_q = extra_open_q.filter(or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)))
    extra_open_q = extra_open_q.filter(FactConvContent.是否有效线索 != 1)
    extra_open_r = extra_open_q.first()
    extra_new_opened = int(extra_open_r.extra_opened or 0)

    # v3.1.26 问题3: 内容平台新开户引进资产 = 非存量且开户成功的客户资产 SUM
    content_asset_q = db.session.query(
        func.coalesce(func.sum(FactConvContent.资产), 0).label('new_open_assets'),
    )
    if sd and ed:
        content_asset_q = content_asset_q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms:
        content_asset_q = content_asset_q.filter(FactConvContent.平台来源.in_([str(p) for p in platforms]))
    content_asset_q = content_asset_q.filter(or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)))
    content_asset_q = content_asset_q.filter(FactConvContent.是否开户 == 1)
    content_asset_r = content_asset_q.first()
    content_new_open_assets = round(float(content_asset_r.new_open_assets or 0), 2)

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

    # 8 阶段漏斗（v3.1.25: 有效线索后剔除存量,呈现非存量有效线索→成功开户→有效户）
    content_top = impressions if impressions > 0 else 1
    content_stages = [
        {'step': '广告曝光', 'value': impressions, 'rate': 100.0, 'step_rate': 100.0},
        {'step': '客户点击', 'value': clicks,
         'rate': round(clicks / impressions * 100, 2) if impressions > 0 else 0,
         'step_rate': round(clicks / content_top * 100, 2)},
        {'step': '客户线索', 'value': leads,
         'rate': round(leads / clicks * 100, 2) if clicks > 0 else 0,
         'step_rate': round(leads / content_top * 100, 2)},
        {'step': '客户开口', 'value': mouth,
         'rate': round(mouth / leads * 100, 2) if leads > 0 else 0,
         'step_rate': round(mouth / content_top * 100, 2)},
        {'step': '有效线索', 'value': valid_lead,
         'rate': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0,
         'step_rate': round(valid_lead / content_top * 100, 2)},
        {'step': '有效线索(剔除存量)', 'value': new_valid_lead,
         'rate': round(new_valid_lead / valid_lead * 100, 2) if valid_lead > 0 else 0,
         'step_rate': round(new_valid_lead / content_top * 100, 2)},
        {'step': '成功开户', 'value': opened,
         'rate': round(opened / new_valid_lead * 100, 2) if new_valid_lead > 0 else 0,
         'step_rate': round(opened / content_top * 100, 2)},
        {'step': '有效户', 'value': valid,
         'rate': round(valid / opened * 100, 2) if opened > 0 else 0,
         'step_rate': round(valid / content_top * 100, 2)},
    ]

    stage_cols = [
        ('激活APP', FactConvAppmarket.是否激活APP),
        ('开户注册', FactConvAppmarket.是否开户注册),
        ('注册身份证', FactConvAppmarket.是否注册身份证),
        ('注册银行卡', FactConvAppmarket.是否注册银行卡),
        ('提交开户', FactConvAppmarket.是否提交开户),
        # v3.5.7: 漏斗「开户成功」阶段口径修正
        # 旧: SUM(是否开户成功) — 上游存在 476 行「开户成功=0 但 创建完资金账号=1 且 新开户=1」的倒挂数据
        # 新: SUM(是否创建完资金账号) — 与「新开户」阶段业务实质对齐（新开户=完资金账号 且 非存量）
        ('开户成功', FactConvAppmarket.是否创建完资金账号),
        ('入金', FactConvAppmarket.是否入金),
        ('有效户', FactConvAppmarket.是否有效户),
    ]
    stage_cols.insert(6, ('新开户', FactConvAppmarket.是否新开户))
    aq = db.session.query(*[func.coalesce(func.sum(col), 0).label(name) for name, col in stage_cols])
    if sd and ed:
        aq = aq.filter(and_(FactConvAppmarket.下载日期 >= sd, FactConvAppmarket.下载日期 <= ed))
    # v3.1.24 业务规则:应用市场漏斗只看互联网引流。
    # 「新开户」作为漏斗阶段(开户成功→新开户)呈现存量剔除,而非 WHERE 过滤——
    # 否则 是否新开户=1 的设备行其前置阶段字段(激活APP/开户注册/.../开户成功)全部=1,
    # SUM 后激活APP~开户成功全部相等,漏斗变平。存量客户=开户成功-新开户,在漏斗中自然递减。
    aq = aq.filter(FactConvAppmarket.渠道类型 == '互联网引流')
    ar = aq.first()
    counts = {name: int(getattr(ar, name) or 0) for name, _ in stage_cols}
    base = counts['激活APP']
    # v3.1.24: rate = 此阶段/上一阶段(阶段转化率);step_rate = 此阶段/激活APP(累计转化率)
    appmarket_stages = []
    prev_count = base
    keys = [s for s, _ in stage_cols]
    for k in keys:
        v = counts[k]
        rate = round(v / prev_count * 100, 2) if prev_count > 0 else 0
        step_rate = round(v / (base or 1) * 100, 2)
        appmarket_stages.append({'step': k, 'value': v, 'rate': rate, 'step_rate': step_rate})
        prev_count = v

    # v3.1.26 问题3: 应用市场新开户引进资产 = 是否新开户==1 的设备行总资产 SUM（口径与 app_market.py 一致）
    app_asset_q = db.session.query(
        func.coalesce(func.sum(FactConvAppmarket.总资产), 0).label('new_open_assets'),
    )
    if sd and ed:
        app_asset_q = app_asset_q.filter(and_(FactConvAppmarket.下载日期 >= sd, FactConvAppmarket.下载日期 <= ed))
    app_asset_q = app_asset_q.filter(FactConvAppmarket.渠道类型 == '互联网引流')
    app_asset_q = app_asset_q.filter(FactConvAppmarket.是否新开户 == 1)
    app_asset_r = app_asset_q.first()
    appmarket_new_open_assets = round(float(app_asset_r.new_open_assets or 0), 2)

    return jsonify({
        'success': True,
        'data': {
            'funnels': {
                'content': {
                    'stages': content_stages,
                    'data_source': 'fact_conv_content + agg_vendor_daily(前 2 段)',
                    'channel_category': 'content',
                    'extra_new_opened': extra_new_opened,
                    'new_open_assets': content_new_open_assets,
                },
                'appmarket': {
                    'stages': appmarket_stages,
                    'data_source': 'fact_conv_appmarket',
                    'channel_category': 'appmarket',
                    'new_open_assets': appmarket_new_open_assets,
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
        'meta': {**_META, 'version': 'v3.1.26-split', 'raw_sums_keys': ['value'], 'derived_keys': ['rate', 'new_open_assets']},
    })
