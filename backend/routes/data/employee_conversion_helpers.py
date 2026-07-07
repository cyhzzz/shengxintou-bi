# -*- coding: utf-8 -*-
"""员工转化查询辅助函数（v2 - 查 fact_conv_content）"""
from sqlalchemy import func, case, and_, or_
from backend.models_v2 import FactConvContent
from backend.database import db
import logging

logger = logging.getLogger(__name__)


def _f(v):
    try: return float(v or 0)
    except: return 0.0
def _i(v):
    try: return int(v or 0)
    except: return 0


def get_qualified_employees(min_leads=30):
    q = db.session.query(
        FactConvContent.添加员工姓名,
        func.count(FactConvContent.id).label('n')
    ).filter(
        and_(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '')
    ).group_by(FactConvContent.添加员工姓名)
    rows = q.all()
    return [r.添加员工姓名 for r in rows if r.n >= min_leads]


def get_platform_filter(platform):
    return FactConvContent.平台来源 == str(platform)


def get_employee_conversion_ranking(platforms, start_date=None, end_date=None, lead_type='all', employees=None):
    q = db.session.query(
        FactConvContent.添加员工姓名,
        FactConvContent.平台来源,
        func.count(FactConvContent.id).label('total_leads'),
        func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
        func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
        func.coalesce(func.sum(case((FactConvContent.是否开户 == 1, 1), else_=0)), 0).label('opened'),
        func.coalesce(func.sum(case((FactConvContent.是否为有效户 == 1, 1), else_=0)), 0).label('valid_customer'),
        func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
    ).filter(
        and_(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '')
    )
    if start_date and end_date:
        q = q.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
    qualified = get_qualified_employees(min_leads=5)
    if qualified:
        q = q.filter(FactConvContent.添加员工姓名.in_(qualified))
    if employees:
        q = q.filter(FactConvContent.添加员工姓名.in_([str(e) for e in employees]))
    pfs = [get_platform_filter(p) for p in platforms]
    if pfs:
        q = q.filter(or_(*pfs))
    if lead_type == 'existing':
        q = q.filter(FactConvContent.是否为存量客户 == 1)
    elif lead_type == 'new':
        q = q.filter(or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)))
    rows = q.group_by(FactConvContent.添加员工姓名, FactConvContent.平台来源).all()
    ranking = []
    for r in rows:
        leads, opened, valid = _i(r.total_leads), _i(r.opened), _i(r.valid_customer)
        ranking.append({
            'employee_name': r.添加员工姓名,
            'platform': r.平台来源,
            'total_leads': leads,
            'mouth_count': _i(r.mouth),
            'valid_lead_count': _i(r.valid_lead),
            'opened_count': opened,
            'valid_customer_count': valid,
            'total_assets': round(_f(r.assets), 2),
            'opening_rate': round(opened / leads * 100, 2) if leads > 0 else 0,
        })
    ranking.sort(key=lambda x: x['opening_rate'], reverse=True)
    return ranking


def get_weekly_trend_data(platforms, start_date=None, end_date=None):
    q = db.session.query(
        func.substr(FactConvContent.线索日期, 1, 7).label('period'),
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(case((FactConvContent.是否开户 == 1, 1), else_=0)), 0).label('opened'),
        func.coalesce(func.sum(case((FactConvContent.是否为有效户 == 1, 1), else_=0)), 0).label('valid'),
    )
    if start_date and end_date:
        q = q.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
    pfs = [get_platform_filter(p) for p in platforms]
    if pfs:
        q = q.filter(or_(*pfs))
    rows = q.group_by('period').order_by('period').all()
    return [{'period': r.period, 'leads': _i(r.leads), 'opened': _i(r.opened), 'valid': _i(r.valid)} for r in rows]


def get_employee_rate_trend(platforms, start_date=None, end_date=None):
    return get_weekly_trend_data(platforms, start_date, end_date)


def get_weekly_report_data(platforms, start_date=None, end_date=None):
    return get_weekly_trend_data(platforms, start_date, end_date)


def get_employee_list():
    qualified = get_qualified_employees(min_leads=5)
    return sorted(qualified)


def get_platform_overview(platforms, start_date=None, end_date=None):
    overview = {}
    for p in platforms:
        q = db.session.query(
            func.count(FactConvContent.id).label('leads'),
            func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
            func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
            func.coalesce(func.sum(case((FactConvContent.是否开户 == 1, 1), else_=0)), 0).label('opened'),
            func.coalesce(func.sum(case((FactConvContent.是否为有效户 == 1, 1), else_=0)), 0).label('valid'),
            func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
        ).filter(get_platform_filter(p))
        if start_date and end_date:
            q = q.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
        r = q.first()
        leads, opened = _i(r.leads), _i(r.opened)
        overview[p] = {
            'total_leads': leads,
            'mouth_count': _i(r.mouth),
            'valid_lead_count': _i(r.valid_lead),
            'opened_count': opened,
            'valid_customer_count': _i(r.valid),
            'total_assets': round(_f(r.assets), 2),
            'opening_rate': round(opened / leads * 100, 2) if leads > 0 else 0,
        }
    return overview
