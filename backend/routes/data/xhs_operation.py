# -*- coding: utf-8 -*-
"""小红书运营分析接口（v2.1 - meta + sums 边界）

core_metrics 同时包含 SQL SUM 聚合（cost/leads/opened/...）与 div 派生
（cost_per_*），新前端应用 sums 自计算。
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggXhsNote, FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions
from collections import defaultdict

bp = Blueprint('xhs_operation', __name__)

_META = {
    'version': 'v2.1',
    'source_tables': ['agg_xhs_note', 'fact_conv_content'],
    'note': 'core_metrics 含 SQL SUM 聚合 + div 派生，新前端应用 sums 自计算',
}


@bp.route('/xhs-notes-operation-analysis', methods=['POST'])
@handle_exceptions
def get_xhs_notes_operation_analysis():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    date_range = filters.get('date_range') or []
    # v3.1 §XhsNotes Operation 拆分：三段日期各自独立作用于子查询
    top_notes_date_range = filters.get('top_notes_date_range') or []
    creator_annual_date_range = filters.get('creator_annual_date_range') or []

    publish_start = date_range[0] if len(date_range) >= 1 else None
    publish_end = date_range[1] if len(date_range) >= 2 else None
    tn_start = top_notes_date_range[0] if len(top_notes_date_range) >= 1 else None
    tn_end = top_notes_date_range[1] if len(top_notes_date_range) >= 2 else None
    ca_start = creator_annual_date_range[0] if len(creator_annual_date_range) >= 1 else None
    ca_end = creator_annual_date_range[1] if len(creator_annual_date_range) >= 2 else None

    base = db.session.query(AggXhsNote)
    if publish_start and publish_end:
        base = base.filter(and_(AggXhsNote.发布时间 >= publish_start,
                                AggXhsNote.发布时间 <= publish_end + ' 23:59:59'))
    notes = base.all()

    # 独立子集：TOP 笔记（按 top_notes_date_range 过滤）
    if tn_start or tn_end:
        top_notes_q = db.session.query(AggXhsNote)
        if tn_start:
            top_notes_q = top_notes_q.filter(AggXhsNote.发布时间 >= tn_start)
        if tn_end:
            top_notes_q = top_notes_q.filter(AggXhsNote.发布时间 <= tn_end + ' 23:59:59')
        top_notes_subset = top_notes_q.all()
    else:
        top_notes_subset = notes

    # 独立子集：创作者年度排行（按 creator_annual_date_range 过滤）
    if ca_start or ca_end:
        ca_q = db.session.query(AggXhsNote)
        if ca_start:
            ca_q = ca_q.filter(AggXhsNote.发布时间 >= ca_start)
        if ca_end:
            ca_q = ca_q.filter(AggXhsNote.发布时间 <= ca_end + ' 23:59:59')
        creator_annual_subset = ca_q.all()
    else:
        creator_annual_subset = notes

    def f(v):
        try: return float(v or 0)
        except: return 0.0
    def i(v):
        try: return int(v or 0)
        except: return 0

    total_cost = sum(f(n.消费金额) for n in notes)
    total_impressions = sum(i(n.总展现量) for n in notes)
    total_clicks = sum(i(n.点击量) for n in notes)
    total_interactions = sum(i(n.总互动量) for n in notes)
    total_pmsg = sum(i(n.私信进线人数) for n in notes)
    total_lead_users = sum(i(n.添加企微人数) for n in notes)
    total_mouth_users = sum(i(n.企微成功添加人数) for n in notes)
    total_opened = sum(i(n.开户人数) for n in notes)

    def _pct(a, b):
        return round(a / b * 100, 2) if b > 0 else 0

    # SQL SUM 聚合（前端 sums）+ 派生（保兼容）
    core_metrics = {
        'new_notes_count': len(set([n.笔记ID for n in notes if n.笔记ID])),
        'ad_notes_count': len(notes),
        'total_cost': round(total_cost, 2),
        'total_impressions': total_impressions,
        'total_clicks': total_clicks,
        'total_interactions': total_interactions,
        'total_private_messages': total_pmsg,
        'total_lead_users': total_lead_users,
        'total_opened_accounts': total_opened,
        'impression_click_rate': _pct(total_clicks, total_impressions),
        'click_interaction_rate': _pct(total_interactions, total_clicks),
        'click_lead_rate': _pct(total_pmsg, total_clicks),
        'cost_per_private_message': round(total_cost / total_pmsg, 2) if total_pmsg > 0 else 0,
        'cost_per_lead_user': round(total_cost / total_lead_users, 2) if total_lead_users > 0 else 0,
        'cost_per_opened_account': round(total_cost / total_opened, 2) if total_opened > 0 else 0,
        'lead_to_wechat_rate': _pct(total_lead_users, total_pmsg),
        'wechat_to_account_rate': _pct(total_opened, total_lead_users),
        'cost_per_mille': round(total_cost / total_impressions * 1000, 2) if total_impressions > 0 else 0,
        'cost_per_click': round(total_cost / total_clicks, 2) if total_clicks > 0 else 0,
    }

    creator_content = defaultdict(lambda: {'note_count': 0, 'total_impressions': 0, 'total_clicks': 0, 'total_interactions': 0, 'total_cost': 0})
    creator_conversion = defaultdict(lambda: {'lead_users': 0, 'opened_account_users': 0, 'total_cost': 0})
    for n in notes:
        c = n.创作者 or '未知'
        creator_content[c]['note_count'] += 1
        creator_content[c]['total_impressions'] += i(n.总展现量)
        creator_content[c]['total_clicks'] += i(n.点击量)
        creator_content[c]['total_interactions'] += i(n.总互动量)
        creator_content[c]['total_cost'] += f(n.消费金额)
        creator_conversion[c]['lead_users'] += i(n.添加企微人数)
        creator_conversion[c]['opened_account_users'] += i(n.开户人数)
        creator_conversion[c]['total_cost'] += f(n.消费金额)
    creator_content_list = [{'producer': k, **v} for k, v in creator_content.items()]
    creator_conversion_list = [{'producer': k, **v} for k, v in creator_conversion.items()]

    trend_dates = set()
    by_month = defaultdict(lambda: {'note_count': 0, 'impressions': 0, 'interactions': 0, 'cost': 0})
    for n in notes:
        if not n.发布时间:
            continue
        m = n.发布时间[:7]
        trend_dates.add(m)
        by_month[m]['note_count'] += 1
        by_month[m]['impressions'] += i(n.总展现量)
        by_month[m]['interactions'] += i(n.总互动量)
        by_month[m]['cost'] += f(n.消费金额)
    sorted_months = sorted(trend_dates)
    creation_trend = {
        'dates': sorted_months,
        'note_counts': [by_month[m]['note_count'] for m in sorted_months],
        'impression_series': [by_month[m]['impressions'] for m in sorted_months],
        'interaction_series': [by_month[m]['interactions'] for m in sorted_months],
        'cost_series': [round(by_month[m]['cost'], 2) for m in sorted_months],
        'click_series': [],
        'interaction_rate_series': [_pct(by_month[m]['interactions'], by_month[m]['impressions']) for m in sorted_months],
        'cost_per_mille_series': [round(by_month[m]['cost'] / by_month[m]['impressions'] * 1000, 2) if by_month[m]['impressions'] > 0 else 0 for m in sorted_months],
    }

    top_notes = []
    for n in sorted(top_notes_subset, key=lambda x: f(x.消费金额), reverse=True)[:20]:
        cost_v = f(n.消费金额)
        top_notes.append({
            'note_id': n.笔记ID, 'note_title': n.笔记标题 or '', 'producer': n.创作者 or '',
            'interaction_count': i(n.总互动量), 'lead_users': i(n.添加企微人数),
            'cost': round(cost_v, 2), 'cost_per_interaction': round(cost_v / i(n.总互动量), 2) if i(n.总互动量) > 0 else 0,
        })

    creator_annual = []
    by_creator = defaultdict(lambda: {'cost': 0.0, 'lead_users': 0, 'opened': 0, 'interactions': 0})
    for n in creator_annual_subset:
        c = n.创作者 or '未知'
        by_creator[c]['cost'] += f(n.消费金额)
        by_creator[c]['lead_users'] += i(n.添加企微人数)
        by_creator[c]['opened'] += i(n.开户人数)
        by_creator[c]['interactions'] += i(n.总互动量)
    for c, v in by_creator.items():
        creator_annual.append({
            'producer': c,
            'total_cost': round(v['cost'], 2),
            'total_interactions': v['interactions'],
            'lead_users': v['lead_users'],
            'opened_account_users': v['opened'],
            'total_score': v['lead_users'] * 10 + v['opened'] * 100 + v['interactions'] * 0.01,
        })
    creator_annual.sort(key=lambda x: x['total_score'], reverse=True)
    creator_annual = creator_annual[:50]

    agency_q = db.session.query(
        FactConvContent.广告代理商,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
    ).filter(FactConvContent.广告代理商.isnot(None), FactConvContent.广告代理商 != '')
    if publish_start and publish_end:
        agency_q = agency_q.filter(and_(FactConvContent.线索日期 >= publish_start, FactConvContent.线索日期 <= publish_end))
    agency_q = agency_q.group_by(FactConvContent.广告代理商)
    agency_list = []
    for r in agency_q.all():
        agency_list.append({
            'agency': r.广告代理商 or '未归因',
            'total_cost': 0, 'total_impressions': 0, 'total_clicks': 0,
            'lead_users': i(r.leads), 'potential_customers': i(r.mouth),
            'customer_mouth_users': i(r.mouth), 'valid_lead_users': i(r.valid_lead),
            'opened_account_users': i(r.opened), 'valid_customer_users': i(r.valid),
        })

    conv_trend_dates = sorted(by_month.keys())
    conv_q = db.session.query(
        func.substr(FactConvContent.线索日期, 1, 7).label('month'),
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
    )
    if publish_start and publish_end:
        conv_q = conv_q.filter(and_(FactConvContent.线索日期 >= publish_start, FactConvContent.线索日期 <= publish_end))
    conv_q = conv_q.group_by('month')
    monthly = {r.month: r for r in conv_q.all() if r.month}
    conversion_trend = {
        'weeks': conv_trend_dates,
        'dateRanges': conv_trend_dates,
        'lead_users': [i(monthly.get(m).leads) if monthly.get(m) else 0 for m in conv_trend_dates],
        'customer_mouth_users': [i(monthly.get(m).mouth) if monthly.get(m) else 0 for m in conv_trend_dates],
        'valid_lead_users': [i(monthly.get(m).valid_lead) if monthly.get(m) else 0 for m in conv_trend_dates],
        'opened_account_users': [i(monthly.get(m).opened) if monthly.get(m) else 0 for m in conv_trend_dates],
    }

    note_conv = sorted(
        [{'note_id': n.笔记ID, 'note_title': n.笔记标题 or '',
          'producer': n.创作者 or '', 'lead_users': i(n.添加企微人数),
          'opened_account_users': i(n.开户人数),
          'conversion_rate': _pct(i(n.开户人数), i(n.添加企微人数))} for n in notes if n.笔记ID and i(n.添加企微人数) > 0],
        key=lambda x: x['lead_users'], reverse=True
    )[:10]

    creator_creation_data = [{'producer': k, 'note_count': v['note_count'], 'impressions': v['total_impressions']} for k, v in creator_content.items()]
    creator_interaction_data = [{'producer': k, 'total_interactions': v['total_interactions'],
                                  'likes': 0, 'favorites': 0, 'comments': 0, 'shares': 0} for k, v in creator_content.items()]

    emp_q = db.session.query(
        FactConvContent.添加员工姓名,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_leads'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
        func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
    ).filter(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '')
    if publish_start and publish_end:
        emp_q = emp_q.filter(and_(FactConvContent.线索日期 >= publish_start, FactConvContent.线索日期 <= publish_end))
    emp_q = emp_q.group_by(FactConvContent.添加员工姓名)
    emp_ranking = []
    for r in emp_q.all():
        leads, opened, valid = i(r.leads), i(r.opened), i(r.valid)
        emp_ranking.append({
            'employee_name': r.添加员工姓名,
            'lead_users': leads, 'wechat_adds': leads,
            'valid_lead_users': i(r.valid_leads),
            'opened_account_users': opened,
            'valid_customer_users': valid,
            'opening_rate': round(opened / leads * 100, 2) if leads > 0 else 0,
            'valid_customer_rate': round(valid / opened * 100, 2) if opened > 0 else 0,
            'total_assets': round(f(r.assets), 2),
        })
    emp_ranking.sort(key=lambda x: x['opened_account_users'], reverse=True)
    employee_weekly_conversion = {'weeks': [], 'employees': [], 'series': []}

    return jsonify({
        'success': True,
        'data': {
            'core_metrics': core_metrics,
            'creator_content_data': creator_content_list,
            'creator_conversion_data': creator_conversion_list,
            'creation_trend': creation_trend,
            'top_notes': top_notes,
            'creator_annual_ranking': creator_annual,
            'agency_data': agency_list,
            'conversion_trend': conversion_trend,
            'note_conversion_ranking': note_conv,
            'creator_creation_data': creator_creation_data,
            'creator_interaction_data': creator_interaction_data,
            'employee_conversion_ranking': emp_ranking,
            'employee_weekly_conversion': employee_weekly_conversion,
        },
        'meta': {**_META,
                 'raw_sums_keys': ['core_metrics.total_cost', 'core_metrics.total_impressions', 'core_metrics.total_clicks', 'core_metrics.total_interactions', 'core_metrics.total_private_messages', 'core_metrics.total_lead_users', 'core_metrics.total_opened_accounts'],
                 'derived_keys': ['core_metrics.impression_click_rate', 'core_metrics.click_interaction_rate', 'core_metrics.click_lead_rate', 'core_metrics.cost_per_private_message', 'core_metrics.cost_per_lead_user', 'core_metrics.cost_per_opened_account', 'core_metrics.lead_to_wechat_rate', 'core_metrics.wechat_to_account_rate', 'core_metrics.cost_per_mille', 'core_metrics.cost_per_click']},
    })