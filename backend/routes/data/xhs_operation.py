# -*- coding: utf-8 -*-
"""小红书运营分析接口（v2 - 查 agg_xhs_note + fact_conv_content）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggXhsNote, FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions
from collections import defaultdict

bp = Blueprint('xhs_operation', __name__)


@bp.route('/xhs-notes-operation-analysis', methods=['POST'])
@handle_exceptions
def get_xhs_notes_operation_analysis():
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    date_range = filters.get('date_range') or []

    publish_start = date_range[0] if len(date_range) >= 1 else None
    publish_end = date_range[1] if len(date_range) >= 2 else None

    base = db.session.query(AggXhsNote)
    if publish_start and publish_end:
        base = base.filter(and_(AggXhsNote.发布时间 >= publish_start,
                                AggXhsNote.发布时间 <= publish_end + ' 23:59:59'))
    notes = base.all()

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
    }

    top_notes = sorted(
        [{'note_id': n.笔记ID, 'note_title': n.笔记标题 or '', 'producer': n.创作者 or '',
          'ad_strategy': n.广告策略 or '', 'note_url': n.笔记链接 or '',
          'note_publish_time': n.发布时间 or '', 'total_cost': round(f(n.消费金额), 2),
          'total_impressions': i(n.总展现量), 'total_clicks': i(n.点击量),
          'total_private_messages': i(n.私信进线人数), 'lead_users': i(n.添加企微人数),
          'opened_account_users': i(n.开户人数)} for n in notes if n.笔记ID],
        key=lambda x: x['lead_users'], reverse=True
    )[:10]

    creator_annual = sorted(
        [{'producer': k, 'note_count': v['note_count'],
          'total_cost': round(v['total_cost'], 2),
          'total_impressions': v['total_impressions'],
          'total_clicks': v['total_clicks'],
          'total_private_messages': sum(i(n.私信进线人数) for n in notes if (n.创作者 or '未知') == k),
          'lead_users': creator_conversion[k]['lead_users'],
          'opened_account_users': creator_conversion[k]['opened_account_users']} for k, v in creator_content.items()],
        key=lambda x: x['opened_account_users'], reverse=True
    )[:20]

    agency_q = db.session.query(
        FactConvContent.广告代理商,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
        func.coalesce(func.sum(FactConvContent.是否客户开口), 0).label('mouth'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_lead'),
    )
    if publish_start and publish_end:
        agency_q = agency_q.filter(and_(FactConvContent.线索日期 >= publish_start, FactConvContent.线索日期 <= publish_end))
    agency_q = agency_q.group_by(FactConvContent.广告代理商)
    agency_list = []
    for r in agency_q.all():
        agency_list.append({
            'agency': r.广告代理商 or '未归因',
            'total_cost': 0, 'total_impressions': 0, 'total_clicks': 0,
            'lead_users': i(r.leads),
            'potential_customers': i(r.mouth),
            'customer_mouth_users': i(r.mouth),
            'valid_lead_users': i(r.valid_lead),
            'opened_account_users': i(r.opened),
            'valid_customer_users': i(r.valid),
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
        }
    })
