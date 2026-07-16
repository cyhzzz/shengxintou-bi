# -*- coding: utf-8 -*-
"""应用市场专项报表（v2.1）

数据源：fact_conv_appmarket（设备级漏斗）
维度：应用市场（小米/华为/oppo/vivo/荣耀/苹果）+ 渠道类型（互联网引流/合作机构/员工开户）+ 月
漏斗：下载 -> 激活APP -> 开户注册 -> 注册身份证 -> 注册银行卡 -> 提交开户
       -> 开户成功 -> 新开户 -> 入金 -> 有效户

所有端点返 SUM 聚合（counts） + 派生（conversion_rate），前端可自行用 sums 重算。
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, case, or_
from backend.models_v2 import FactConvAppmarket
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('app_market_report', __name__, url_prefix='/api/v1/reports/app-market')

FUNNEL_STAGES = [
    ('是否激活APP', '激活APP'),
    ('是否开户注册', '开户注册'),
    ('是否注册身份证', '注册身份证'),
    ('是否注册银行卡', '注册银行卡'),
    ('是否提交开户', '提交开户'),
    ('是否开户成功', '开户成功'),
    ('是否新开户', '新开户'),
    ('是否入金', '入金'),
    ('是否有效户', '有效户'),
]

_META = {
    'version': 'v2.1',
    'source_table': 'fact_conv_appmarket',
    'note': '漏斗 counts 是 SQL SUM 聚合；conversion_rate 是派生',
    'funnel_stages': [s[1] for s in FUNNEL_STAGES],
    'funnel_columns': [s[0] for s in FUNNEL_STAGES],
}


def _apply_filters(q, filters):
    sd, ed = filters.get('start_date'), filters.get('end_date')
    if sd and ed:
        q = q.filter(and_(FactConvAppmarket.下载日期 >= sd,
                          FactConvAppmarket.下载日期 <= ed))
    if filters.get('app_markets'):
        q = q.filter(FactConvAppmarket.应用市场.in_([str(x) for x in filters['app_markets']]))
    if filters.get('channel_types'):
        q = q.filter(FactConvAppmarket.渠道类型.in_([str(x) for x in filters['channel_types']]))
    return q


def _funnel_filters(q, filters):
    # v3.1.24 业务规则:漏斗端点专用,只看互联网引流 + 新开户(排除存量客户)
    q = _apply_filters(q, filters)
    q = q.filter(FactConvAppmarket.渠道类型 == '互联网引流')
    q = q.filter(FactConvAppmarket.是否新开户 == 1)
    return q


def _funnel_selects():
    sel = []
    for col, alias in FUNNEL_STAGES:
        c = getattr(FactConvAppmarket, col)
        sel.append(func.coalesce(func.sum(c), 0).label(alias))
    return sel


def _funnel_dict_from_row(r):
    return {alias: int(getattr(r, alias, 0) or 0) for _, alias in FUNNEL_STAGES}


def _funnel_with_rates(counts):
    out = [{'step': '激活APP', 'count': counts['激活APP'], 'rate': 100.0, 'step_rate': 100.0}]
    prev = counts['激活APP']
    keys = ['开户注册', '注册身份证', '注册银行卡', '提交开户', '开户成功', '新开户', '入金', '有效户']
    for k in keys:
        v = counts[k]
        rate = round(v / prev * 100, 2) if prev > 0 else 0
        out.append({'step': k, 'count': v, 'rate': rate, 'step_rate': round(v / counts['激活APP'] * 100, 2) if counts['激活APP'] > 0 else 0})
        prev = v
    return out


@bp.route('/summary', methods=['POST'])
@handle_exceptions
def app_market_summary():
    """总览：SUM 各阶段 + 按月 × 应用市场透视"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    q = _funnel_filters(db.session.query(*_funnel_selects()), filters)
    r = q.first()
    total_counts = _funnel_dict_from_row(r)

    month_q = _funnel_filters(
        db.session.query(
            func.substr(FactConvAppmarket.下载日期, 1, 7).label('month'),
            FactConvAppmarket.应用市场.label('app_market'),
            *_funnel_selects(),
        ),
        filters
    ).group_by('month', FactConvAppmarket.应用市场).order_by('month')
    by_month_market = []
    for row in month_q.all():
        cnt = _funnel_dict_from_row(row)
        by_month_market.append({
            'month': row.month,
            'app_market': row.app_market or '未归因',
            'counts': cnt,
            'final_open_rate': round(cnt['开户成功'] / cnt['激活APP'] * 100, 4) if cnt['激活APP'] > 0 else 0,
            'final_valid_rate': round(cnt['有效户'] / cnt['激活APP'] * 100, 4) if cnt['激活APP'] > 0 else 0,
        })

    market_q = _funnel_filters(
        db.session.query(
            FactConvAppmarket.应用市场.label('app_market'),
            *_funnel_selects(),
        ),
        filters
    ).group_by(FactConvAppmarket.应用市场)
    by_market = []
    for row in market_q.all():
        cnt = _funnel_dict_from_row(row)
        by_market.append({
            'app_market': row.app_market or '未归因',
            'counts': cnt,
            'funnel': _funnel_with_rates(cnt),
        })

    type_q = _apply_filters(
        db.session.query(
            FactConvAppmarket.渠道类型.label('channel_type'),
            FactConvAppmarket.应用市场.label('app_market'),
            *_funnel_selects(),
        ),
        filters
    ).group_by(FactConvAppmarket.渠道类型, FactConvAppmarket.应用市场)
    by_channel_type = []
    for row in type_q.all():
        cnt = _funnel_dict_from_row(row)
        by_channel_type.append({
            'channel_type': row.channel_type or '未归因',
            'app_market': row.app_market or '未归因',
            'counts': cnt,
        })

    return jsonify({
        'success': True,
        'data': {
            'total_counts': total_counts,
            'total_funnel': _funnel_with_rates(total_counts),
            'by_month_market': by_month_market,
            'by_market': by_market,
            'by_channel_type': by_channel_type,
        },
        'meta': {**_META, 'raw_sums_keys': [s[1] for s in FUNNEL_STAGES]},
    })


@bp.route('/funnel', methods=['POST'])
@handle_exceptions
def app_market_funnel():
    # 单应用市场的漏斗细节
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    q = _funnel_filters(db.session.query(*_funnel_selects()), filters)
    r = q.first()
    counts = _funnel_dict_from_row(r)
    return jsonify({
        'success': True,
        'data': {
            'counts': counts,
            'funnel': _funnel_with_rates(counts),
        },
        'meta': _META,
    })


@bp.route('/detail', methods=['POST'])
@handle_exceptions
def app_market_detail():
    """明细行 (filter + 分页)"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    page = int(data.get('page', 1))
    page_size = int(data.get('page_size', 20))
    offset = (page - 1) * page_size

    base = db.session.query(FactConvAppmarket)
    base = _apply_filters(base, filters)
    total = base.count()
    rows = base.order_by(FactConvAppmarket.id.desc()).offset(offset).limit(page_size).all()

    detail = []
    for r in rows:
        detail.append({
            'id': r.id,
            # 表格列(短名 bool)
            '下载日期': str(r.下载日期) if r.下载日期 else '',
            '应用市场': r.应用市场 or '',
            '应用市场名称': r.应用市场名称 or '',
            '渠道类型': r.渠道类型 or '',
            '设备号': r.设备号 or '',
            '资金账号': r.资金账号 or '',
            '激活APP': bool(r.是否激活APP),
            '开户注册': bool(r.是否开户注册),
            '注册身份证': bool(r.是否注册身份证),
            '注册银行卡': bool(r.是否注册银行卡),
            '提交开户': bool(r.是否提交开户),
            '开户成功': bool(r.是否开户成功),
            '新开户': bool(r.是否新开户),
            '入金': bool(r.是否入金),
            '有效户': bool(r.是否有效户),
            # 详情浮7e7a5c5f33 字段(models_v2.FactConvAppmarket 1:1)
            '数据更新日期': str(r.数据更新日期) if r.数据更新日期 else '',
            '投放账号': r.投放账号 or '',
            '广告计划ID': str(r.广告计划ID) if r.广告计划ID is not None else '',
            '注册手机号': r.注册手机号 or '',
            '是否注册身份证': bool(r.是否注册身份证),
            '注册身份证时间': str(r.注册身份证时间) if r.注册身份证时间 else '',
            '是否注册银行卡': bool(r.是否注册银行卡),
            '注册银行卡时间': str(r.注册银行卡时间) if r.注册银行卡时间 else '',
            '是否激活APP': bool(r.是否激活APP),
            'APP激活时间': str(r.APP激活时间) if r.APP激活时间 else '',
            '是否开户注册': bool(r.是否开户注册),
            '注册开户流程时间': str(r.注册开户流程时间) if r.注册开户流程时间 else '',
            '是否提交开户': bool(r.是否提交开户),
            '提交开户时间': str(r.提交开户时间) if r.提交开户时间 else '',
            '是否开户成功': bool(r.是否开户成功),
            '开户成功时间': str(r.开户成功时间) if r.开户成功时间 else '',
            '开户时间': str(r.开户时间) if r.开户时间 else '',
            '是否新开户': bool(r.是否新开户),
            '是否创建完资金账号': bool(r.是否创建完资金账号),
            '资金账号创建完成时间': str(r.资金账号创建完成时间) if r.资金账号创建完成时间 else '',
            '是否入金': bool(r.是否入金),
            '是否有效户': bool(r.是否有效户),
            '有效户时间': str(r.有效户时间) if r.有效户时间 else '',
            '是否存量客户': bool(r.是否存量客户),
            '总资产': float(r.总资产) if r.总资产 is not None else None,
            '累计创收': float(r.累计创收) if r.累计创收 is not None else None,
            '人均日创收': float(r.人均日创收) if r.人均日创收 is not None else None,
        })
    return jsonify({
        'success': True,
        'data': {
            'detail': detail,
            'page': page,
            'page_size': page_size,
            'total': total,
        },
        'meta': _META,
    })


@bp.route('/filter-options', methods=['GET', 'POST'])
@handle_exceptions
def app_market_filter_options():
    markets = [r[0] for r in db.session.query(FactConvAppmarket.应用市场).distinct().all() if r[0]]
    markets_sorted = sorted(markets, key=lambda x: ('a' if x.isascii() else 'z') + x)
    types = [r[0] for r in db.session.query(FactConvAppmarket.渠道类型).distinct().all() if r[0]]
    return jsonify({
        'success': True,
        'data': {
            'app_markets': markets_sorted,
            'channel_types': sorted(types),
        },
        'meta': _META,
    })



@bp.route('/creative', methods=['POST'])
@handle_exceptions
def app_market_creative():
    # 广告创意效果 (Bug 3 修复)
    # 按 广告计划ID + 投放账号 聚合 fact_conv_appmarket 漏斗计数
    # 当 广告计划ID 为 NULL/0 时 fallback 投放账号
    # 返回 TopN 创意计划的开户/入金/有效户数据
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    top_n = int(data.get('top_n', 50))

    funnels = [
        ('是否激活APP', '激活APP'),
        ('是否开户成功', '开户成功'),
        ('是否入金', '入金'),
        ('是否有效户', '有效户'),
    ]

    # CASE WHEN 广告计划ID IS NULL OR 广告计划ID = 0 THEN COALESCE(投放账号, '未归因') ELSE 广告计划ID END
    plan_expr = case(
        (or_(FactConvAppmarket.广告计划ID.is_(None), FactConvAppmarket.广告计划ID == 0),
         func.coalesce(FactConvAppmarket.投放账号, '未归因')),
        else_=FactConvAppmarket.广告计划ID
    ).label('plan_key')

    q = db.session.query(
        plan_expr,
        func.coalesce(func.sum(case((FactConvAppmarket.广告计划ID.isnot(None), 1), else_=0)), 0).label('has_plan_id'),
        FactConvAppmarket.投放账号,
        FactConvAppmarket.应用市场,
        FactConvAppmarket.渠道类型,
        *[func.coalesce(func.sum(getattr(FactConvAppmarket, col)), 0).label(alias) for col, alias in funnels]
    )
    q = _apply_filters(q, filters)
    q = q.group_by(plan_expr, FactConvAppmarket.投放账号, FactConvAppmarket.应用市场, FactConvAppmarket.渠道类型)
    rows = q.all()

    items = []
    for r in rows:
        activate = int(r.激活APP or 0)
        opened = int(r.开户成功 or 0)
        deposit = int(r.入金 or 0)
        valid = int(r.有效户 or 0)
        items.append({
            'plan_id': str(r.plan_key) if r.plan_key is not None else '未归因',
            'plan_label': str(r.plan_key) if r.has_plan_id and r.plan_key is not None else (r.投放账号 or '未归因'),
            '投放账号': r.投放账号 or '-',
            '应用市场': r.应用市场 or '未归因',
            '渠道类型': r.渠道类型 or '未归因',
            '激活APP': activate,
            '开户成功': opened,
            '入金': deposit,
            '有效户': valid,
            '激活_开户率': round(opened / activate * 100, 2) if activate > 0 else 0,
            '激活_有效率': round(valid / activate * 100, 2) if activate > 0 else 0,
            '开户_有效率': round(valid / opened * 100, 2) if opened > 0 else 0,
        })

    items.sort(key=lambda x: (x['开户成功'], x['激活APP']), reverse=True)
    top_items = items[:top_n]

    totals = {
        'total_plans': len(items),
        'top_plans': len(top_items),
        'total_activate': sum(i['激活APP'] for i in items),
        'total_open': sum(i['开户成功'] for i in items),
        'total_deposit': sum(i['入金'] for i in items),
        'total_valid': sum(i['有效户'] for i in items),
    }

    return jsonify({
        'success': True,
        'data': {
            'items': top_items,
            'totals': totals,
            'top_n': top_n,
            'all_count': len(items),
        },
        'meta': {**_META, 'version': 'v3.1-creative', 'group_by': '广告计划ID+投放账号'},
    })
