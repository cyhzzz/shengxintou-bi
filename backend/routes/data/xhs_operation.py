# -*- coding: utf-8 -*-
"""小红书运营分析接口（v2.1 - meta + sums 边界）

core_metrics 同时包含 SQL SUM 聚合（cost/leads/opened/...）与 div 派生
（cost_per_*），新前端应用 sums 自计算。

v3.2.3：
- creation_trend 限 2026+，返回 producer_matrix 支持按创作者堆叠柱状图
- conversion_trend 改用 fact_conv_content 小红书数据 + 周维度（上周五到本周四为一周）
- agency_data 改用 agg_vendor_daily（平台='小红书'）按厂商分组
- emp_ranking 补齐小红书固定 8 人名单
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggXhsNote, FactConvContent, AggVendorDaily
from backend.database import db
from backend.utils.decorators import handle_exceptions
from collections import defaultdict
from datetime import datetime, timedelta

bp = Blueprint('xhs_operation', __name__)

_META = {
    'version': 'v2.3',
    'source_tables': ['agg_xhs_note', 'fact_conv_content', 'agg_vendor_daily'],
    'note': 'creation_trend 限 2026+；conversion_trend 周维度（上周五到本周四）；agency 改用 agg_vendor_daily；emp 补齐 8 人名单',
}

# 小红书固定 8 人名单（与员工转化周报 XHS_ASSISTANTS 一致）
XHS_ASSISTANTS = ['史菡漾', '何泳萍', '杨华', '贾芳', '陈鸿', '袁孝春', '赵梅', '张杰明']


def _week_label(date_str):
    """把 YYYY-MM-DD 转为周标签（上周五到本周四为一周）

    若 date_str 是周四，则本周五是下一周的开始；这里以「本周四所在周的周五到下周四」为一周，
    标签用「该周起始日（周五）」的 YYYY-MM-DD 表示。
    简化实现：将日期向前推 4 天到本周一，再加 4 天回到周五，得到本周周五日期。
    """
    try:
        d = datetime.strptime(date_str[:10], '%Y-%m-%d')
    except Exception:
        return None
    weekday = d.weekday()  # Mon=0 ... Sun=6
    # 周五=4, 周六=5, 周日=6 → 算下一周；周一~周四 → 算本周
    if weekday >= 4:  # Fri/Sat/Sun
        week_start = d - timedelta(days=weekday - 4)  # 回到本周五
    else:  # Mon-Thu
        week_start = d - timedelta(days=weekday + 3)  # 回到上周五
    return week_start.strftime('%Y-%m-%d')


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
    creator_conversion = defaultdict(lambda: {'lead_users': 0, 'opened_account_users': 0, 'total_cost': 0,
                                               'private_messages': 0, 'customer_mouth_users': 0,
                                               'valid_lead_users': 0, 'valid_customer_users': 0})
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
        creator_conversion[c]['private_messages'] += i(n.私信进线人数)
        creator_conversion[c]['customer_mouth_users'] += i(n.企微成功添加人数)
    creator_content_list = [{
        'producer': k, **v,
        'avg_click_rate': round(v['total_clicks'] / v['total_impressions'] * 100, 2) if v['total_impressions'] > 0 else 0,
        'avg_interaction_rate': round(v['total_interactions'] / v['total_impressions'] * 100, 2) if v['total_impressions'] > 0 else 0,
    } for k, v in creator_content.items()]
    creator_conversion_list = [{'producer': k, **v} for k, v in creator_conversion.items()]

    trend_dates = set()
    by_month = defaultdict(lambda: {'note_count': 0, 'impressions': 0, 'interactions': 0, 'cost': 0})
    # v3.2.3：按月×创作者矩阵（用于按创作者堆叠柱状图）
    by_month_producer = defaultdict(lambda: defaultdict(int))
    for n in notes:
        if not n.发布时间:
            continue
        # v3.2.3：限 2026+ 数据，过滤 2025 及更早
        if n.发布时间[:4] < '2026':
            continue
        m = n.发布时间[:7]
        trend_dates.add(m)
        by_month[m]['note_count'] += 1
        by_month[m]['impressions'] += i(n.总展现量)
        by_month[m]['interactions'] += i(n.总互动量)
        by_month[m]['cost'] += f(n.消费金额)
        by_month_producer[m][n.创作者 or '未知'] += 1
    sorted_months = sorted(trend_dates)
    # 按笔记数 top10 创作者 + 其他聚合
    producer_total = defaultdict(int)
    for m, prod_map in by_month_producer.items():
        for p, cnt in prod_map.items():
            producer_total[p] += cnt
    top_producers = [p for p, _ in sorted(producer_total.items(), key=lambda x: x[1], reverse=True)[:10]]
    producer_matrix = {
        'producers': top_producers,
        'months': sorted_months,
        # matrix[producer] = [count_for_each_month]
        'matrix': {p: [by_month_producer[m].get(p, 0) for m in sorted_months] for p in top_producers},
    }
    creation_trend = {
        'dates': sorted_months,
        'note_counts': [by_month[m]['note_count'] for m in sorted_months],
        'impression_series': [by_month[m]['impressions'] for m in sorted_months],
        'interaction_series': [by_month[m]['interactions'] for m in sorted_months],
        'cost_series': [round(by_month[m]['cost'], 2) for m in sorted_months],
        'click_series': [],
        'interaction_rate_series': [_pct(by_month[m]['interactions'], by_month[m]['impressions']) for m in sorted_months],
        'cost_per_mille_series': [round(by_month[m]['cost'] / by_month[m]['impressions'] * 1000, 2) if by_month[m]['impressions'] > 0 else 0 for m in sorted_months],
        'producer_matrix': producer_matrix,
    }

    top_notes = []
    for n in sorted(top_notes_subset, key=lambda x: f(x.消费金额), reverse=True)[:20]:
        cost_v = f(n.消费金额)
        top_notes.append({
            'note_id': n.笔记ID, 'note_title': n.笔记标题 or '', 'producer': n.创作者 or '',
            'publish_time': n.发布时间 or '', 'ad_strategy': n.广告策略 or '',
            'total_impressions': i(n.总展现量), 'total_clicks': i(n.点击量),
            'total_private_messages': i(n.私信进线人数),
            'interaction_count': i(n.总互动量), 'lead_users': i(n.添加企微人数),
            'opened_account_users': i(n.开户人数),
            'total_cost': round(cost_v, 2), 'cost_per_interaction': round(cost_v / i(n.总互动量), 2) if i(n.总互动量) > 0 else 0,
        })

    creator_annual = []
    by_creator = defaultdict(lambda: {'cost': 0.0, 'lead_users': 0, 'opened': 0, 'interactions': 0,
                                       'note_count': 0, 'total_impressions': 0, 'total_clicks': 0,
                                       'total_private_messages': 0})
    for n in creator_annual_subset:
        c = n.创作者 or '未知'
        by_creator[c]['cost'] += f(n.消费金额)
        by_creator[c]['lead_users'] += i(n.添加企微人数)
        by_creator[c]['opened'] += i(n.开户人数)
        by_creator[c]['interactions'] += i(n.总互动量)
        by_creator[c]['note_count'] += 1
        by_creator[c]['total_impressions'] += i(n.总展现量)
        by_creator[c]['total_clicks'] += i(n.点击量)
        by_creator[c]['total_private_messages'] += i(n.私信进线人数)
    for c, v in by_creator.items():
        creator_annual.append({
            'producer': c,
            'note_count': v['note_count'],
            'total_impressions': v['total_impressions'],
            'total_clicks': v['total_clicks'],
            'total_private_messages': v['total_private_messages'],
            'total_cost': round(v['cost'], 2),
            'total_interactions': v['interactions'],
            'lead_users': v['lead_users'],
            'opened_account_users': v['opened'],
            'total_score': v['lead_users'] * 10 + v['opened'] * 100 + v['interactions'] * 0.01,
        })
    creator_annual.sort(key=lambda x: x['total_score'], reverse=True)
    creator_annual = creator_annual[:50]

    # v3.2.3：代理商数据改用 agg_vendor_daily（平台='小红书'，按厂商分组）
    agency_q = db.session.query(
        AggVendorDaily.厂商,
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('total_cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('total_impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('total_clicks'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('lead_users'),
        func.coalesce(func.sum(AggVendorDaily.开口人数), 0).label('customer_mouth_users'),
        func.coalesce(func.sum(AggVendorDaily.有效线索数), 0).label('valid_lead_users'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('opened_account_users'),
        func.coalesce(func.sum(AggVendorDaily.有效户人数), 0).label('valid_customer_users'),
    ).filter(AggVendorDaily.厂商.isnot(None), AggVendorDaily.厂商 != '', AggVendorDaily.平台 == '小红书')
    if publish_start and publish_end:
        agency_q = agency_q.filter(and_(AggVendorDaily.日期 >= publish_start, AggVendorDaily.日期 <= publish_end))
    agency_q = agency_q.group_by(AggVendorDaily.厂商)
    agency_list = []
    for r in agency_q.all():
        agency_list.append({
            'agency': r.厂商 or '未归因',
            'total_cost': round(f(r.total_cost), 2),
            'total_impressions': i(r.total_impressions),
            'total_clicks': i(r.total_clicks),
            'lead_users': i(r.lead_users),
            'potential_customers': i(r.customer_mouth_users),
            'customer_mouth_users': i(r.customer_mouth_users),
            'valid_lead_users': i(r.valid_lead_users),
            'opened_account_users': i(r.opened_account_users),
            'valid_customer_users': i(r.valid_customer_users),
        })
    # 按消耗降序
    agency_list.sort(key=lambda x: x['total_cost'], reverse=True)

    # v3.2.3：转化走势改用 fact_conv_content 小红书数据 + 周维度（上周五到本周四为一周）
    conv_q = db.session.query(
        FactConvContent.线索日期,
        FactConvContent.是否客户开口,
        FactConvContent.是否有效线索,
        FactConvContent.是否开户,
    ).filter(FactConvContent.平台来源 == '小红书')
    if publish_start and publish_end:
        conv_q = conv_q.filter(and_(FactConvContent.线索日期 >= publish_start, FactConvContent.线索日期 <= publish_end))
    conv_rows = conv_q.all()
    # 按周聚合（限 2026+ 周维度，过滤掉起始日在 2026 之前的周）
    by_week = defaultdict(lambda: {'leads': 0, 'mouth': 0, 'valid_lead': 0, 'opened': 0})
    for r in conv_rows:
        if not r.线索日期 or r.线索日期[:4] < '2026':
            continue
        w = _week_label(r.线索日期)
        if not w or w < '2026-01-01':
            continue
        by_week[w]['leads'] += 1
        by_week[w]['mouth'] += i(r.是否客户开口)
        by_week[w]['valid_lead'] += i(r.是否有效线索)
        by_week[w]['opened'] += i(r.是否开户)
    sorted_weeks = sorted(by_week.keys())
    conversion_trend = {
        'weeks': sorted_weeks,
        'dateRanges': sorted_weeks,
        'lead_users': [by_week[w]['leads'] for w in sorted_weeks],
        'customer_mouth_users': [by_week[w]['mouth'] for w in sorted_weeks],
        'valid_lead_users': [by_week[w]['valid_lead'] for w in sorted_weeks],
        'opened_account_users': [by_week[w]['opened'] for w in sorted_weeks],
    }

    note_conv = sorted(
        [{'note_id': n.笔记ID, 'note_title': n.笔记标题 or '',
          'producer': n.创作者 or '', 'lead_users': i(n.添加企微人数),
          'opened_account_users': i(n.开户人数),
          'conversion_rate': _pct(i(n.开户人数), i(n.添加企微人数))} for n in notes if n.笔记ID and i(n.添加企微人数) > 0],
        key=lambda x: x['lead_users'], reverse=True
    )[:10]

    creator_creation_data = [{'producer': k, 'note_count': v['note_count'], 'impressions': v['total_impressions']} for k, v in creator_content.items()]
    creator_interaction_data = [{'producer': k, 'total_interactions': v['total_interactions']} for k, v in creator_content.items()]

    emp_q = db.session.query(
        FactConvContent.添加员工姓名,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(FactConvContent.是否有效线索), 0).label('valid_leads'),
        func.coalesce(func.sum(FactConvContent.是否开户), 0).label('opened'),
        func.coalesce(func.sum(FactConvContent.是否为有效户), 0).label('valid'),
        func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
    ).filter(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '', FactConvContent.平台来源 == '小红书')
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

    # v3.2.3：参照员工转化周报小红书渠道口径 - 只保留固定 8 人名单，其他人过滤掉
    xhs_set = set(XHS_ASSISTANTS)
    emp_ranking = [r for r in emp_ranking if r['employee_name'] in xhs_set]

    # 补齐小红书固定 8 人名单中没数据的员工
    existing_names = {r['employee_name'] for r in emp_ranking}
    for name in XHS_ASSISTANTS:
        if name not in existing_names:
            emp_ranking.append({
                'employee_name': name,
                'lead_users': 0, 'wechat_adds': 0,
                'valid_lead_users': 0,
                'opened_account_users': 0,
                'valid_customer_users': 0,
                'opening_rate': 0,
                'valid_customer_rate': 0,
                'total_assets': 0,
            })

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
        },
        'meta': {**_META,
                 'raw_sums_keys': ['core_metrics.total_cost', 'core_metrics.total_impressions', 'core_metrics.total_clicks', 'core_metrics.total_interactions', 'core_metrics.total_private_messages', 'core_metrics.total_lead_users', 'core_metrics.total_opened_accounts'],
                 'derived_keys': ['core_metrics.impression_click_rate', 'core_metrics.click_interaction_rate', 'core_metrics.click_lead_rate', 'core_metrics.cost_per_private_message', 'core_metrics.cost_per_lead_user', 'core_metrics.cost_per_opened_account', 'core_metrics.lead_to_wechat_rate', 'core_metrics.wechat_to_account_rate', 'core_metrics.cost_per_mille', 'core_metrics.cost_per_click']},
    })