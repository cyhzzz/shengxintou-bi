# -*- coding: utf-8 -*-
"""
小红书运营分析接口 - 辅助函数
"""

from sqlalchemy import func, and_, or_, case
from backend.models import (
    DailyMetricsUnified,
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    BackendConversions,
    XhsNotesDaily
)
from backend.database import db
from datetime import datetime, timedelta


def get_core_metrics(notes_data, date_range):
    """
    获取核心运营数据（7个指标卡片）
    """
    # 统计新增笔记数（按 note_publish_time 筛选）
    new_notes_query = db.session.query(
        func.count(DailyNotesMetricsUnified.note_id.distinct())
    )

    if date_range and len(date_range) == 2:
        new_notes_query = new_notes_query.filter(
            and_(
                DailyNotesMetricsUnified.note_publish_time >= date_range[0],
                DailyNotesMetricsUnified.note_publish_time <= date_range[1] + ' 23:59:59'
            )
        )

    new_notes_count = new_notes_query.scalar() or 0

    # 统计投放笔记数（从 xhs_notes_daily 表，按 date 筛选）
    ad_notes_query = db.session.query(
        func.count(XhsNotesDaily.note_id.distinct())
    )

    if date_range and len(date_range) == 2:
        ad_notes_query = ad_notes_query.filter(
            and_(
                XhsNotesDaily.date >= date_range[0],
                XhsNotesDaily.date <= date_range[1]
            )
        )

    ad_notes_count = ad_notes_query.scalar() or 0

    # 其他核心指标
    total_cost = sum(float(note.cost or 0) for note in notes_data)
    total_impressions = sum(note.total_impressions or 0 for note in notes_data)
    total_clicks = sum(note.total_clicks or 0 for note in notes_data)
    total_interactions = sum(note.total_interactions or 0 for note in notes_data)

    # 核心转化指标
    total_private_messages = sum(note.total_private_messages or 0 for note in notes_data)
    total_lead_users = sum(note.lead_users or 0 for note in notes_data)
    total_opened_accounts = sum(note.opened_account_users or 0 for note in notes_data)

    # 计算核心指标
    impression_click_rate = round(total_clicks / total_impressions * 100, 2) if total_impressions > 0 else 0
    click_interaction_rate = round(total_interactions / total_clicks * 100, 2) if total_clicks > 0 else 0
    click_lead_rate = round(total_private_messages / total_clicks * 100, 2) if total_clicks > 0 else 0
    cost_per_private_message = round(total_cost / total_private_messages, 2) if total_private_messages > 0 else 0
    cost_per_lead_user = round(total_cost / total_lead_users, 2) if total_lead_users > 0 else 0
    cost_per_opened_account = round(total_cost / total_opened_accounts, 2) if total_opened_accounts > 0 else 0

    lead_to_wechat_rate = round(total_lead_users / total_private_messages * 100, 2) if total_private_messages > 0 else 0
    wechat_to_account_rate = round(total_opened_accounts / total_lead_users * 100, 2) if total_lead_users > 0 else 0
    cost_per_mille = round(total_cost / total_impressions * 1000, 2) if total_impressions > 0 else 0
    cost_per_click = round(total_cost / total_clicks, 2) if total_clicks > 0 else 0

    return {
        'new_notes_count': new_notes_count,
        'ad_notes_count': ad_notes_count,
        'total_cost': round(total_cost, 2),
        'total_impressions': total_impressions,
        'total_clicks': total_clicks,
        'total_interactions': total_interactions,
        'total_private_messages': total_private_messages,
        'total_lead_users': total_lead_users,
        'total_opened_accounts': total_opened_accounts,
        'impression_click_rate': impression_click_rate,
        'click_lead_rate': click_lead_rate,
        'lead_to_wechat_rate': lead_to_wechat_rate,
        'wechat_to_account_rate': wechat_to_account_rate,
        'cost_per_mille': cost_per_mille,
        'cost_per_click': cost_per_click,
        'cost_per_lead_user': cost_per_lead_user,
        'cost_per_opened_account': cost_per_opened_account
    }


def get_creator_data(notes_data):
    """
    获取创作者维度数据（双表格）
    """
    creator_content_data = {}
    creator_conversion_data = {}
    creator_note_ids = {}

    for note in notes_data:
        creator = note.producer if note.producer else '未知创作者'

        if creator not in creator_content_data:
            creator_content_data[creator] = {
                'producer': creator,
                'note_count': 0,
                'total_impressions': 0,
                'total_clicks': 0,
                'total_interactions': 0,
                'total_cost': 0
            }

        creator_content_data[creator]['total_impressions'] += note.total_impressions or 0
        creator_content_data[creator]['total_clicks'] += note.total_clicks or 0
        creator_content_data[creator]['total_interactions'] += note.total_interactions or 0
        creator_content_data[creator]['total_cost'] += float(note.cost or 0)

        if creator not in creator_note_ids:
            creator_note_ids[creator] = set()
        creator_note_ids[creator].add(note.note_id)

        if creator not in creator_conversion_data:
            creator_conversion_data[creator] = {
                'producer': creator,
                'private_messages': 0,
                'lead_users': 0,
                'customer_mouth_users': 0,
                'valid_lead_users': 0,
                'opened_account_users': 0,
                'valid_customer_users': 0
            }

        creator_conversion_data[creator]['private_messages'] += note.total_private_messages or 0
        creator_conversion_data[creator]['lead_users'] += note.lead_users or 0
        creator_conversion_data[creator]['customer_mouth_users'] += note.customer_mouth_users or 0
        creator_conversion_data[creator]['valid_lead_users'] += note.valid_lead_users or 0
        creator_conversion_data[creator]['opened_account_users'] += note.opened_account_users or 0
        creator_conversion_data[creator]['valid_customer_users'] += note.valid_customer_users or 0

    for creator in creator_content_data:
        if creator in creator_note_ids:
            creator_content_data[creator]['note_count'] = len(creator_note_ids[creator])

    creator_content_list = []
    for data in creator_content_data.values():
        data['avg_click_rate'] = round(data['total_clicks'] / data['total_impressions'] * 100, 2) if data['total_impressions'] > 0 else 0
        data['avg_interaction_rate'] = round(data['total_interactions'] / data['total_impressions'] * 100, 2) if data['total_impressions'] > 0 else 0
        creator_content_list.append(data)

    creator_content_list.sort(key=lambda x: x['note_count'], reverse=True)

    creator_conversion_list = list(creator_conversion_data.values())
    creator_conversion_list.sort(key=lambda x: x['opened_account_users'], reverse=True)

    return creator_content_list, creator_conversion_list


def get_creator_annual_ranking(creator_annual_data):
    """
    获取创作者年度排行榜
    """
    creator_annual_data_aggregated = {}
    creator_annual_note_ids = {}

    for note in creator_annual_data:
        creator = note.producer if note.producer else '未知创作者'

        if creator not in creator_annual_data_aggregated:
            creator_annual_data_aggregated[creator] = {
                'producer': creator,
                'total_cost': 0,
                'total_impressions': 0,
                'total_clicks': 0,
                'total_private_messages': 0,
                'lead_users': 0,
                'opened_account_users': 0
            }

        creator_annual_data_aggregated[creator]['total_cost'] += float(note.cost or 0)
        creator_annual_data_aggregated[creator]['total_impressions'] += note.total_impressions or 0
        creator_annual_data_aggregated[creator]['total_clicks'] += note.total_clicks or 0
        creator_annual_data_aggregated[creator]['total_private_messages'] += note.total_private_messages or 0
        creator_annual_data_aggregated[creator]['lead_users'] += note.lead_users or 0
        creator_annual_data_aggregated[creator]['opened_account_users'] += note.opened_account_users or 0

        if creator not in creator_annual_note_ids:
            creator_annual_note_ids[creator] = set()
        creator_annual_note_ids[creator].add(note.note_id)

    for creator in creator_annual_data_aggregated:
        if creator in creator_annual_note_ids:
            creator_annual_data_aggregated[creator]['note_count'] = len(creator_annual_note_ids[creator])

    creator_annual_ranking = list(creator_annual_data_aggregated.values())
    creator_annual_ranking.sort(key=lambda x: x['total_cost'], reverse=True)

    return creator_annual_ranking


def get_creation_trend(notes_data, date_range):
    """
    获取内容运营数据（双图表）
    """
    daily_creation_query = db.session.query(
        func.date(XhsNoteInfo.publish_time).label('date'),
        func.count(XhsNoteInfo.note_id).label('note_count')
    )

    if date_range and len(date_range) == 2:
        daily_creation_query = daily_creation_query.filter(
            and_(
                XhsNoteInfo.publish_time >= date_range[0],
                XhsNoteInfo.publish_time <= date_range[1] + ' 23:59:59'
            )
        )

    daily_creation_query = daily_creation_query.group_by(
        func.date(XhsNoteInfo.publish_time)
    ).order_by(
        func.date(XhsNoteInfo.publish_time)
    )

    daily_creation_results = daily_creation_query.all()

    creation_trend = {
        'dates': [str(row.date) for row in daily_creation_results],
        'note_counts': [row.note_count for row in daily_creation_results]
    }

    daily_interaction_data = {}
    for note in notes_data:
        date_str = str(note.date)
        if date_str not in daily_interaction_data:
            daily_interaction_data[date_str] = {
                'date': date_str,
                'total_impressions': 0,
                'total_interactions': 0,
                'total_cost': 0
            }

        daily_interaction_data[date_str]['total_impressions'] += note.total_impressions or 0
        daily_interaction_data[date_str]['total_interactions'] += note.total_interactions or 0
        daily_interaction_data[date_str]['total_cost'] += float(note.cost or 0)

    daily_interaction_list = sorted(daily_interaction_data.values(), key=lambda x: x['date'])

    creation_trend['impression_series'] = [item['total_impressions'] for item in daily_interaction_list]
    creation_trend['interaction_series'] = [item['total_interactions'] for item in daily_interaction_list]
    creation_trend['cost_series'] = [item['total_cost'] for item in daily_interaction_list]

    return creation_trend


def get_top_notes(notes_data, top_notes_date_range):
    """
    获取优秀笔记排行榜
    """
    if top_notes_date_range and len(top_notes_date_range) == 2:
        top_notes_query = db.session.query(
            DailyNotesMetricsUnified.note_id,
            DailyNotesMetricsUnified.note_title,
            DailyNotesMetricsUnified.note_publish_time,
            DailyNotesMetricsUnified.note_url,
            DailyNotesMetricsUnified.producer,
            DailyNotesMetricsUnified.ad_strategy,
            func.sum(DailyNotesMetricsUnified.cost).label('total_cost'),
            func.sum(DailyNotesMetricsUnified.total_impressions).label('total_impressions'),
            func.sum(DailyNotesMetricsUnified.total_clicks).label('total_clicks'),
            func.sum(DailyNotesMetricsUnified.total_private_messages).label('total_private_messages'),
            func.sum(DailyNotesMetricsUnified.lead_users).label('lead_users'),
            func.sum(DailyNotesMetricsUnified.opened_account_users).label('opened_account_users')
        ).filter(
            and_(
                DailyNotesMetricsUnified.note_publish_time >= top_notes_date_range[0],
                DailyNotesMetricsUnified.note_publish_time <= top_notes_date_range[1] + ' 23:59:59'
            )
        ).group_by(
            DailyNotesMetricsUnified.note_id,
            DailyNotesMetricsUnified.note_title,
            DailyNotesMetricsUnified.note_publish_time,
            DailyNotesMetricsUnified.note_url,
            DailyNotesMetricsUnified.producer,
            DailyNotesMetricsUnified.ad_strategy
        )

        top_notes_result = top_notes_query.all()

        note_stats = {}
        for row in top_notes_result:
            if row.note_id not in note_stats:
                note_stats[row.note_id] = {
                    'note_id': row.note_id,
                    'note_title': row.note_title or '',
                    'note_publish_time': row.note_publish_time.strftime('%Y-%m-%d') if row.note_publish_time else '',
                    'note_url': row.note_url or '',
                    'producer': row.producer or '未知',
                    'ad_strategy': row.ad_strategy or '未知',
                    'total_cost': 0,
                    'total_impressions': 0,
                    'total_clicks': 0,
                    'total_private_messages': 0,
                    'lead_users': 0,
                    'opened_account_users': 0
                }

            note_stats[row.note_id]['total_cost'] += float(row.total_cost or 0)
            note_stats[row.note_id]['total_impressions'] += int(row.total_impressions or 0)
            note_stats[row.note_id]['total_clicks'] += int(row.total_clicks or 0)
            note_stats[row.note_id]['total_private_messages'] += int(row.total_private_messages or 0)
            note_stats[row.note_id]['lead_users'] += int(row.lead_users or 0)
            note_stats[row.note_id]['opened_account_users'] += int(row.opened_account_users or 0)
    else:
        note_stats = {}
        for note in notes_data:
            if note.note_id not in note_stats:
                note_stats[note.note_id] = {
                    'note_id': note.note_id,
                    'note_title': note.note_title or '',
                    'note_publish_time': note.note_publish_time.strftime('%Y-%m-%d') if note.note_publish_time else '',
                    'note_url': note.note_url or '',
                    'producer': note.producer or '未知',
                    'ad_strategy': note.ad_strategy or '未知',
                    'total_cost': 0,
                    'total_impressions': 0,
                    'total_clicks': 0,
                    'total_private_messages': 0,
                    'lead_users': 0,
                    'opened_account_users': 0
                }

            note_stats[note.note_id]['total_cost'] += float(note.cost or 0)
            note_stats[note.note_id]['total_impressions'] += note.total_impressions or 0
            note_stats[note.note_id]['total_clicks'] += note.total_clicks or 0
            note_stats[note.note_id]['total_private_messages'] += note.total_private_messages or 0
            note_stats[note.note_id]['lead_users'] += note.lead_users or 0
            note_stats[note.note_id]['opened_account_users'] += note.opened_account_users or 0

    top_notes = sorted(note_stats.values(), key=lambda x: x['lead_users'], reverse=True)[:10]
    return top_notes


def get_agency_data(date_range):
    """
    获取代理商数据
    """
    agency_query = db.session.query(DailyMetricsUnified).filter(
        DailyMetricsUnified.platform == '小红书'
    )

    if date_range and len(date_range) == 2:
        agency_query = agency_query.filter(
            and_(
                DailyMetricsUnified.date >= date_range[0],
                DailyMetricsUnified.date <= date_range[1]
            )
        )

    agency_metrics_data = agency_query.all()

    agency_data = {}
    for metric in agency_metrics_data:
        if not metric.agency or metric.agency == '':
            continue

        agency = metric.agency

        if agency not in agency_data:
            agency_data[agency] = {
                'agency': agency,
                'total_cost': 0,
                'total_impressions': 0,
                'total_clicks': 0,
                'lead_users': 0,
                'potential_customers': 0,
                'customer_mouth_users': 0,
                'valid_lead_users': 0,
                'opened_account_users': 0,
                'valid_customer_users': 0
            }

        agency_data[agency]['total_cost'] += float(metric.cost or 0)
        agency_data[agency]['total_impressions'] += metric.impressions or 0
        agency_data[agency]['total_clicks'] += metric.click_users or 0
        agency_data[agency]['lead_users'] += metric.lead_users or 0
        agency_data[agency]['potential_customers'] += metric.potential_customers or 0
        agency_data[agency]['customer_mouth_users'] += metric.customer_mouth_users or 0
        agency_data[agency]['valid_lead_users'] += metric.valid_lead_users or 0
        agency_data[agency]['opened_account_users'] += metric.opened_account_users or 0
        agency_data[agency]['valid_customer_users'] += metric.valid_customer_users or 0

    agency_list = list(agency_data.values())
    agency_list.sort(key=lambda x: x['total_cost'], reverse=True)

    return agency_list


def get_conversion_trend(date_range):
    """
    获取转化趋势数据（双图表+表格）
    """
    weekly_conversion_query = db.session.query(
        func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
        func.count(BackendConversions.id).label('total_wechat_adds'),
        func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('total_customer_mouths'),
        func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),
        func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened_accounts')
    ).filter(
        and_(
            BackendConversions.platform_source == '小红书',
            BackendConversions.lead_date >= date_range[0],
            BackendConversions.lead_date <= date_range[1]
        )
    ).group_by(
        func.strftime('%Y-%W', BackendConversions.lead_date)
    ).order_by(
        func.strftime('%Y-%W', BackendConversions.lead_date)
    ).all()

    weekly_conversion_list = []

    for idx, row in enumerate(weekly_conversion_query):
        week_str = row.week
        year, week_num = week_str.split('-')

        week_start = datetime.strptime(f"{year}-{week_num}-0", "%Y-%W-%w")
        week_end = week_start + timedelta(days=6)
        date_range_str = f"{week_start.strftime('%m%d')}-{week_end.strftime('%m%d')}"

        lead_users_val = int(row.total_wechat_adds or 0)
        customer_mouth_users_val = int(row.total_customer_mouths or 0)
        valid_lead_users_val = int(row.total_valid_leads or 0)
        opened_account_users_val = int(row.total_opened_accounts or 0)

        weekly_conversion_list.append({
            'week': week_str,
            'date_range': date_range_str,
            'lead_users': lead_users_val,
            'customer_mouth_users': customer_mouth_users_val,
            'valid_lead_users': valid_lead_users_val,
            'opened_account_users': opened_account_users_val
        })

    conversion_trend = {
        'weeks': [item['week'] for item in weekly_conversion_list],
        'dateRanges': [item['date_range'] for item in weekly_conversion_list],
        'lead_users': [item['lead_users'] for item in weekly_conversion_list],
        'customer_mouth_users': [item['customer_mouth_users'] for item in weekly_conversion_list],
        'valid_lead_users': [item['valid_lead_users'] for item in weekly_conversion_list],
        'opened_account_users': [item['opened_account_users'] for item in weekly_conversion_list]
    }

    return conversion_trend, weekly_conversion_list


def get_employee_conversion(date_range, end_date):
    """
    获取员工转化数据和周度转化率
    """
    employee_query = db.session.query(
        func.coalesce(BackendConversions.add_employee_name, '未知').label('employee_name'),
        func.count(BackendConversions.id).label('total_wechat_adds'),
        func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),
        func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened_accounts'),
        func.sum(case((BackendConversions.is_valid_customer == True, 1), else_=0)).label('total_valid_customers'),
        func.sum(BackendConversions.assets).label('total_assets')
    ).filter(
        BackendConversions.platform_source == '小红书'
    )

    if date_range and len(date_range) == 2:
        employee_query = employee_query.filter(
            and_(
                BackendConversions.lead_date >= date_range[0],
                BackendConversions.lead_date <= date_range[1]
            )
        )

    employee_stats = employee_query.group_by(
        func.coalesce(BackendConversions.add_employee_name, '未知')
    ).all()

    employee_conversion_ranking = []
    for stat in employee_stats:
        employee_name = stat.employee_name

        wechat_adds_count = int(stat.total_wechat_adds) if stat.total_wechat_adds is not None else 0
        valid_leads_count = int(stat.total_valid_leads) if stat.total_valid_leads is not None else 0
        opened_account_count = int(stat.total_opened_accounts) if stat.total_opened_accounts is not None else 0
        valid_customer_count = int(stat.total_valid_customers) if stat.total_valid_customers is not None else 0

        opening_rate = (opened_account_count / wechat_adds_count * 100) if wechat_adds_count > 0 else 0
        valid_customer_rate = (valid_customer_count / opened_account_count * 100) if opened_account_count > 0 else 0

        employee_conversion_ranking.append({
            'employee_name': employee_name,
            'lead_users': wechat_adds_count,
            'wechat_adds': wechat_adds_count,
            'valid_lead_users': valid_leads_count,
            'opened_account_users': opened_account_count,
            'valid_customer_users': valid_customer_count,
            'opening_rate': round(opening_rate, 2),
            'valid_customer_rate': round(valid_customer_rate, 2),
            'total_assets': float(stat.total_assets or 0)
        })

    employee_conversion_ranking.sort(key=lambda x: x['opened_account_users'], reverse=True)

    start_date_8weeks = end_date - timedelta(weeks=8)

    weekly_employee_query = db.session.query(
        func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
        BackendConversions.add_employee_name,
        func.count(BackendConversions.id).label('total_wechat_adds'),
        func.sum(
            case(
                (BackendConversions.is_opened_account == True, 1),
                else_=0
            )
        ).label('opened_accounts')
    ).filter(
        and_(
            BackendConversions.platform_source == '小红书',
            BackendConversions.lead_date >= start_date_8weeks,
            BackendConversions.lead_date <= end_date
        )
    ).group_by(
        func.strftime('%Y-%W', BackendConversions.lead_date),
        BackendConversions.add_employee_name
    ).all()

    weekly_data = {
        'weeks': [],
        'employees': set(),
        'rates': {}
    }

    for row in weekly_employee_query:
        if not row.add_employee_name:
            continue

        week = row.week
        wechat_adds = row.total_wechat_adds or 0
        opened_accounts = row.opened_accounts or 0

        rate = (opened_accounts / wechat_adds * 100) if wechat_adds > 0 else 0

        weekly_data['weeks'].append(week)
        weekly_data['employees'].add(row.add_employee_name)

        if row.add_employee_name not in weekly_data['rates']:
            weekly_data['rates'][row.add_employee_name] = {}

        weekly_data['rates'][row.add_employee_name][week] = round(rate, 2)

    sorted_weeks = sorted(list(set(weekly_data['weeks'])))[:8]

    top_employees = sorted(
        employee_conversion_ranking[:5],
        key=lambda x: x['opened_account_users'],
        reverse=True
    ) if employee_conversion_ranking else []

    employee_weekly_conversion = {
        'weeks': sorted_weeks,
        'employees': [emp['employee_name'] for emp in top_employees],
        'series': []
    }

    for emp in top_employees:
        emp_name = emp['employee_name']
        series_data = []

        for week in sorted_weeks:
            rate = weekly_data['rates'].get(emp_name, {}).get(week, 0)
            series_data.append(rate)

        employee_weekly_conversion['series'].append(series_data)

    return employee_conversion_ranking, employee_weekly_conversion
