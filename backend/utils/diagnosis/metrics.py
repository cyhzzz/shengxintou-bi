# -*- coding: utf-8 -*-
"""智能辅助诊断 - 快照与指标取数层

只做 SELECT/SUM/GROUP BY 聚合，不输出任何设备/线索级明细，遵守数据安全红线。
"""
from datetime import date, datetime

from sqlalchemy import and_, case, func, or_

from backend.database import db
from backend.models_v2 import (
    AggDailyChannelOpen,
    AggVendorDaily,
    AggXhsNote,
    FactConvAppmarket,
    FactConvContent,
    FactPlanDaily,
)

SNAPSHOT_SOURCES = [
    {'key': 'agg_vendor_daily', 'name': '厂商日聚合', 'model': AggVendorDaily, 'column': '日期'},
    {'key': 'fact_plan_daily', 'name': '计划日明细', 'model': FactPlanDaily, 'column': '日期'},
    {'key': 'agg_xhs_note', 'name': '小红书笔记', 'model': AggXhsNote, 'column': '发布时间'},
    {'key': 'fact_conv_content', 'name': '企微线索明细', 'model': FactConvContent, 'column': '线索日期'},
    {'key': 'fact_conv_appmarket', 'name': '应用市场明细', 'model': FactConvAppmarket, 'column': '下载日期'},
    {'key': 'agg_daily_channel_open', 'name': '渠道开户聚合', 'model': AggDailyChannelOpen, 'column': '时间区间'},
]

CONTENT_NON_STOCK = or_(FactConvContent.是否为存量客户.is_(None), FactConvContent.是否为存量客户 == 0)


def parse_date(value):
    if value is None:
        return None
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def _content_flag_sum(column):
    return func.sum(case((and_(CONTENT_NON_STOCK, column == 1), 1), else_=0))


def fetch_snapshot_dates():
    today = date.today()
    result = []
    for source in SNAPSHOT_SOURCES:
        column = getattr(source['model'], source['column'])
        latest = parse_date(db.session.query(func.max(column)).scalar())
        result.append({
            'key': source['key'],
            'name': source['name'],
            'latest': latest.isoformat() if latest else None,
            'days_ago': (today - latest).days if latest else None,
        })
    return result


def resolve_default_month():
    latest = db.session.query(func.max(FactConvContent.线索日期)).scalar()
    if not latest:
        return ''
    return str(latest)[:7]


def fetch_content_monthly(months):
    month_expr = func.substr(FactConvContent.线索日期, 1, 7)
    rows = db.session.query(
        month_expr.label('month'),
        func.count().label('total'),
        _content_flag_sum(FactConvContent.是否客户开口).label('opened'),
        _content_flag_sum(FactConvContent.是否有效线索).label('valid'),
        func.sum(case((FactConvContent.是否为存量客户 == 1, 1), else_=0)).label('stock'),
    ).filter(month_expr.in_(months)).group_by(month_expr).all()
    result = {}
    for row in rows:
        result[row.month] = {
            'total': int(row.total or 0),
            'opened': int(row.opened or 0),
            'valid': int(row.valid or 0),
            'stock': int(row.stock or 0),
        }
    return result


def fetch_content_daily(month):
    rows = db.session.query(
        FactConvContent.线索日期.label('date'),
        func.count().label('total'),
        _content_flag_sum(FactConvContent.是否客户开口).label('opened'),
        _content_flag_sum(FactConvContent.是否有效线索).label('valid'),
    ).filter(
        func.substr(FactConvContent.线索日期, 1, 7) == month,
    ).group_by(FactConvContent.线索日期).all()
    result = []
    for row in rows:
        parsed = parse_date(row.date)
        if not parsed:
            continue
        result.append({
            'date': parsed,
            'total': int(row.total or 0),
            'opened': int(row.opened or 0),
            'valid': int(row.valid or 0),
        })
    result.sort(key=lambda item: item['date'])
    return result


def fetch_platform_activity(window_start):
    rows = db.session.query(
        FactConvContent.平台来源.label('platform'),
        func.count().label('leads'),
        func.max(FactConvContent.线索日期).label('last_date'),
    ).filter(
        FactConvContent.线索日期 >= window_start.isoformat(),
        CONTENT_NON_STOCK,
        FactConvContent.平台来源.isnot(None),
        FactConvContent.平台来源 != '',
    ).group_by(FactConvContent.平台来源).all()
    result = []
    for row in rows:
        last_date = parse_date(row.last_date)
        result.append({
            'platform': str(row.platform),
            'leads': int(row.leads or 0),
            'last_date': last_date.isoformat() if last_date else None,
        })
    return result


def fetch_appmarket_monthly(months):
    month_expr = func.substr(FactConvAppmarket.下载日期, 1, 7)
    rows = db.session.query(
        month_expr.label('month'),
        func.count().label('downloads'),
        func.sum(case((FactConvAppmarket.是否激活APP == 1, 1), else_=0)).label('activated'),
        func.sum(case((FactConvAppmarket.是否开户注册 == 1, 1), else_=0)).label('registered'),
        func.sum(case((FactConvAppmarket.是否创建完资金账号 == 1, 1), else_=0)).label('account_created'),
        func.count(func.distinct(FactConvAppmarket.设备号)).label('devices'),
        func.sum(case((FactConvAppmarket.是否新开户 == 1, 1), else_=0)).label('new_accounts'),
        func.sum(case((FactConvAppmarket.是否新开户 == 1, FactConvAppmarket.总资产), else_=0)).label('new_assets'),
    ).filter(
        month_expr.in_(months),
        FactConvAppmarket.渠道类型 == '互联网引流',
    ).group_by(month_expr).all()
    result = {}
    for row in rows:
        result[row.month] = {
            'downloads': int(row.downloads or 0),
            'activated': int(row.activated or 0),
            'registered': int(row.registered or 0),
            'account_created': int(row.account_created or 0),
            'devices': int(row.devices or 0),
            'new_accounts': int(row.new_accounts or 0),
            'new_assets': float(row.new_assets or 0.0),
        }
    return result
