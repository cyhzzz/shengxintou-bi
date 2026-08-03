# -*- coding: utf-8 -*-
"""投放评审接口

按厂商分表展示月度数据，便于导出"信息流广告：XX 厂商 1 月初至 7 月 15 日数据明细表"。

数据源：agg_vendor_daily（与厂商分析共用）
聚合维度：厂商 × 月（YYYY-MM）
指标：消耗 / 企微 / 开口 / APP激活 / 开户 / 加微成本 / APP激活成本 / 开户成本
（APP激活属 APP 下载链路，业务含义近似线索，详见 docs/rules/business-invariants.md §4）
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggVendorDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import enrich_items, full_to_short

bp = Blueprint('investment_review', __name__)


@bp.route('/investment-review', methods=['GET', 'POST'])
@handle_exceptions
def get_investment_review():
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

    def _f(v):
        try:
            return float(v or 0)
        except Exception:
            return 0.0

    def _i(v):
        try:
            return int(v or 0)
        except Exception:
            return 0

    # 月度聚合：按厂商 × 月（substr(日期, 1, 7)）分组
    # 注：agg_vendor_daily 表只有「日期」字段，无预聚合「月」列，需用 SQL substr 截取 YYYY-MM
    month_col = func.substr(AggVendorDaily.日期, 1, 7).label('month')
    q = db.session.query(
        AggVendorDaily.厂商,
        month_col,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开口人数), 0).label('opened_conversation'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened_account'),
        # v3.7.1：APP 下载链路指标（kiwi/哇棒/有米 走 APP 下载链路）
        func.coalesce(func.sum(AggVendorDaily.APP激活人数), 0).label('app_activation'),
    )
    if start_date and end_date:
        q = q.filter(and_(AggVendorDaily.日期 >= start_date, AggVendorDaily.日期 <= end_date))
    if platforms:
        q = q.filter(AggVendorDaily.平台.in_(platforms))
    if agencies:
        q = q.filter(AggVendorDaily.厂商.in_(agencies))
    if business_models:
        q = q.filter(AggVendorDaily.业务模式.in_(business_models))
    q = q.group_by(AggVendorDaily.厂商, month_col).order_by(AggVendorDaily.厂商, month_col)
    rows = q.all()

    # 按厂商分桶 + 每个厂商算总计
    by_agency = {}
    for r in rows:
        agency = r.厂商 or '未归因'
        if agency not in by_agency:
            by_agency[agency] = []
        cost = _f(r.cost)
        leads = _i(r.leads)
        opened_conv = _i(r.opened_conversation)
        opened_acc = _i(r.opened_account)
        app_act = _i(r.app_activation)
        by_agency[agency].append({
            'month': r.month or '',
            'cost': round(cost, 2),
            'leads': leads,
            'opened_conversation': opened_conv,
            'opened_account': opened_acc,
            'lead_cost': round(cost / leads, 2) if leads > 0 else None,
            'account_cost': round(cost / opened_acc, 2) if opened_acc > 0 else None,
            # v3.7.1：APP 下载链路指标
            'app_activation': app_act,
            'app_activation_cost': round(cost / app_act, 2) if app_act > 0 else None,
        })

    # 每个厂商追加"总计"行
    monthly_payload = {}
    trend_payload = {}
    for agency, items in by_agency.items():
        total_cost = sum(it['cost'] for it in items)
        total_leads = sum(it['leads'] for it in items)
        total_conv = sum(it['opened_conversation'] for it in items)
        total_acc = sum(it['opened_account'] for it in items)
        total_app_act = sum(it['app_activation'] for it in items)
        total_row = {
            'month': '总计',
            'cost': round(total_cost, 2),
            'leads': total_leads,
            'opened_conversation': total_conv,
            'opened_account': total_acc,
            'lead_cost': round(total_cost / total_leads, 2) if total_leads > 0 else None,
            'account_cost': round(total_cost / total_acc, 2) if total_acc > 0 else None,
            'app_activation': total_app_act,
            'app_activation_cost': round(total_cost / total_app_act, 2) if total_app_act > 0 else None,
            'is_total': True,
        }
        monthly_payload[agency] = items + [total_row]
        # 趋势图不含总计行
        trend_payload[agency] = items

    # 厂商列表（按消耗降序）
    agency_list = sorted(by_agency.keys(), key=lambda a: -sum(it['cost'] for it in by_agency[a]))

    # 厂商简称映射（用于前端标题显示）
    agency_short_map = {a: full_to_short(a) or a for a in agency_list}

    return jsonify({
        'success': True,
        'data': {
            'agencies': agency_list,
            'agency_short_map': agency_short_map,
            'monthly': monthly_payload,
            'trend': trend_payload,
            'meta': {
                'agency_count': len(agency_list),
                'month_count': len(set(it['month'] for items in by_agency.values() for it in items)),
            },
        }
    })
