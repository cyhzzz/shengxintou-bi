# -*- coding: utf-8 -*-
"""应用市场 · 归因转化率分析（v3.7.3 → v3.7.4 改用数据库）

数据源：fact_conv_appmarket 表（设备级漏斗，1 行=1 APP 下载）
按周（周一~周日）聚合各步骤转化率：
  激活 → 开户注册 → 身份证 → 银行卡 → 提交开户 → 开户成功

返回：
  1. daily_data — 每日各步骤计数 + 步骤间转化率
  2. weekly_data — 每周各步骤计数 + 步骤间转化率
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import FactConvAppmarket
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.dialect_helpers import make_week_start_expr

bp = Blueprint('app_market_attribution', __name__, url_prefix='/api/v1/reports/app-market')

APP_MARKET_PLATFORMS = ['华为', '小米', '荣耀', 'oppo', 'vivo', '苹果']

_META = {
    'version': 'v3.7.4',
    'source': 'fact_conv_appmarket 数据库表',
    'note': '各应用市场每设备号OAID开户进展，按周(周一~周日)聚合各步骤转化率',
}

# 漏斗步骤列 → 别名映射
FUNNEL_STAGES = [
    ('是否激活APP', 'activate'),
    ('是否开户注册', 'register'),
    ('是否注册身份证', 'id_card'),
    ('是否注册银行卡', 'bank_card'),
    ('是否提交开户', 'submit'),
    ('是否开户成功', 'success'),
]

WEEKDAY_MAP = {0: '周一', 1: '周二', 2: '周三', 3: '周四', 4: '周五', 5: '周六', 6: '周日'}


def _week_start(d):
    """返回日期 d 所在周的周一日期"""
    if isinstance(d, str):
        d = datetime.strptime(d, '%Y-%m-%d').date()
    return d - timedelta(days=d.weekday())


def _week_end(d):
    """返回日期 d 所在周的周日日期"""
    if isinstance(d, str):
        d = datetime.strptime(d, '%Y-%m-%d').date()
    return d + timedelta(days=6 - d.weekday())


def _rate(numerator, denominator):
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def _build_query(platform, start_date, end_date):
    """构建基础过滤查询"""
    q = db.session.query(FactConvAppmarket)
    if platform and platform != '全部':
        q = q.filter(FactConvAppmarket.应用市场 == platform)
    if start_date:
        q = q.filter(FactConvAppmarket.下载日期 >= start_date)
    if end_date:
        q = q.filter(FactConvAppmarket.下载日期 <= end_date)
    return q


def _aggregate(platform, start_date, end_date):
    """按日期+平台聚合各步骤计数，并计算转化率（SQL 聚合）"""

    # ---- 每日聚合 ----
    daily_q = _build_query(platform, start_date, end_date)
    daily_q = daily_q.with_entities(
        FactConvAppmarket.下载日期,
        *[func.coalesce(func.sum(getattr(FactConvAppmarket, col)), 0).label(alias)
          for col, alias in FUNNEL_STAGES],
    ).group_by(FactConvAppmarket.下载日期).order_by(FactConvAppmarket.下载日期)

    daily_rows = daily_q.all()

    daily_records = []
    for row in daily_rows:
        date_str = row.下载日期
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            continue

        activate = int(getattr(row, 'activate', 0) or 0)
        register = int(getattr(row, 'register', 0) or 0)
        id_card = int(getattr(row, 'id_card', 0) or 0)
        bank_card = int(getattr(row, 'bank_card', 0) or 0)
        submit = int(getattr(row, 'submit', 0) or 0)
        success = int(getattr(row, 'success', 0) or 0)

        ws = _week_start(d)
        daily_records.append({
            'date': date_str,
            'weekday': WEEKDAY_MAP[d.weekday()],
            'week_start': ws.isoformat(),
            'activate': activate,
            'register': register,
            'id_card': id_card,
            'bank_card': bank_card,
            'submit': submit,
            'success': success,
            'rate_activate_register': _rate(register, activate),
            'rate_register_idcard': _rate(id_card, register),
            'rate_idcard_bankcard': _rate(bank_card, id_card),
            'rate_bankcard_submit': _rate(submit, bank_card),
            'rate_submit_success': _rate(success, submit),
        })

    # ---- 周聚合 ----
    week_expr = make_week_start_expr(FactConvAppmarket.下载日期).label('week_start')
    weekly_q = _build_query(platform, start_date, end_date)
    weekly_q = weekly_q.with_entities(
        week_expr,
        *[func.coalesce(func.sum(getattr(FactConvAppmarket, col)), 0).label(alias)
          for col, alias in FUNNEL_STAGES],
    ).group_by(week_expr).order_by(week_expr)

    weekly_rows = weekly_q.all()

    weekly_records = []
    for row in weekly_rows:
        ws_val = row.week_start
        if isinstance(ws_val, str):
            ws_date = datetime.strptime(ws_val, '%Y-%m-%d').date()
        else:
            ws_date = ws_val

        activate = int(getattr(row, 'activate', 0) or 0)
        register = int(getattr(row, 'register', 0) or 0)
        id_card = int(getattr(row, 'id_card', 0) or 0)
        bank_card = int(getattr(row, 'bank_card', 0) or 0)
        submit = int(getattr(row, 'submit', 0) or 0)
        success = int(getattr(row, 'success', 0) or 0)

        weekly_records.append({
            'week_start': ws_date.isoformat(),
            'week_end': _week_end(ws_date).isoformat(),
            'activate': activate,
            'register': register,
            'id_card': id_card,
            'bank_card': bank_card,
            'submit': submit,
            'success': success,
            'rate_activate_register': _rate(register, activate),
            'rate_register_idcard': _rate(id_card, register),
            'rate_idcard_bankcard': _rate(bank_card, id_card),
            'rate_bankcard_submit': _rate(submit, bank_card),
            'rate_submit_success': _rate(success, submit),
        })

    return daily_records, weekly_records


@bp.route('/attribution-conversion', methods=['POST'])
@handle_exceptions
def attribution_conversion():
    """归因转化率分析 — 每日 + 每周各步骤转化率"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    platform = filters.get('platform', '全部')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # 获取数据中实际存在的平台列表
    available_platforms = sorted(
        [r[0] for r in db.session.query(FactConvAppmarket.应用市场)
         .distinct().all() if r[0]]
    )

    daily_data, weekly_data = _aggregate(platform, start_date, end_date)

    return jsonify({
        'success': True,
        'data': {
            'daily_data': daily_data,
            'weekly_data': weekly_data,
            'platforms': available_platforms,
            'platform': platform,
        },
        'meta': _META,
    })
