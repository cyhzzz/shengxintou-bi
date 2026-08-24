# -*- coding: utf-8 -*-
"""应用市场 · 归因转化率分析（v3.8.1）

数据源：fact_conv_appmarket 表（设备级漏斗，1 行=1 APP 下载）
按周（周一~周日）聚合各步骤转化率：
  激活 → 开户注册 → 身份证 → 银行卡 → 提交开户 → 开户成功 → 广告开户

广告开户（复合条件节点）：是否创建完资金账号=是 AND 渠道类型=互联网引流 AND 是否新开户=是

返回：
  1. daily_data — 每日各步骤计数 + 步骤间转化率
  2. weekly_data — 每周各步骤计数 + 步骤间转化率
"""
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from sqlalchemy import case, func

from backend.models_v2 import FactConvAppmarket
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.dialect_helpers import make_week_start_expr

bp = Blueprint('app_market_attribution', __name__, url_prefix='/api/v1/reports/app-market')

_META = {
    'version': 'v3.8.1',
    'source': 'fact_conv_appmarket 数据库表',
    'note': '按周(周一~周日)聚合各步骤转化率，含开户成功→广告开户节点',
}

# 仅统计以下 7 个应用市场，其他一律排除
ALLOWED_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']

# 漏斗步骤列 → 别名映射（与 app_market.py FUNNEL_STAGES 前 6 步一致）
FUNNEL_STAGES = [
    ('是否激活APP', 'activate'),
    ('是否开户注册', 'register'),
    ('是否注册身份证', 'id_card'),
    ('是否注册银行卡', 'bank_card'),
    ('是否提交开户', 'submit'),
    # 开户成功阶段口径：必须用「是否创建完资金账号」（与 app_market.py 一致，
    # 上游存在「开户成功=0 但 创建完资金账号=1」倒挂数据，见 business-invariants.md 第3节）
    ('是否创建完资金账号', 'success'),
]

# 广告开户：开户成功之后的复合条件节点
#   是否创建完资金账号 = 是（1）AND 渠道类型 = 互联网引流 AND 是否新开户 = 是（1）
AD_ACCOUNT_CONDITIONS = (
    (FactConvAppmarket.是否创建完资金账号 == 1)
    & (FactConvAppmarket.渠道类型 == '互联网引流')
    & (FactConvAppmarket.是否新开户 == 1)
)

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
    """安全比率计算，分母为 0 返回 0.0（前端展示为 '-'）"""
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def _build_query(platforms, start_date, end_date):
    """构建基础过滤查询

    归因转化率分析关注全渠道各步骤转化率，不做渠道类型过滤。
    仅统计 ALLOWED_PLATFORMS 中的 7 个应用市场。
    platforms: list[str] — 选中的应用市场列表，空列表表示全部（仅限白名单内）
    """
    q = db.session.query(FactConvAppmarket)
    q = q.filter(FactConvAppmarket.应用市场.in_(ALLOWED_PLATFORMS))
    if platforms:
        q = q.filter(FactConvAppmarket.应用市场.in_(platforms))
    if start_date:
        q = q.filter(FactConvAppmarket.下载日期 >= start_date)
    if end_date:
        q = q.filter(FactConvAppmarket.下载日期 <= end_date)
    return q


def _stage_columns():
    """构建漏斗步骤的 SUM 聚合列列表（含广告开户复合条件节点，可复用）"""
    cols = [
        func.coalesce(func.sum(getattr(FactConvAppmarket, col)), 0).label(alias)
        for col, alias in FUNNEL_STAGES
    ]
    # 广告开户：复合条件节点，满足三个条件才计 1
    cols.append(
        func.coalesce(
            func.sum(case((AD_ACCOUNT_CONDITIONS, 1), else_=0)), 0
        ).label('ad_account')
    )
    return cols


def _row_to_record(row):
    """将聚合行转为带计数和转化率的记录（每日/每周通用）"""
    activate = int(getattr(row, 'activate', 0) or 0)
    register = int(getattr(row, 'register', 0) or 0)
    id_card = int(getattr(row, 'id_card', 0) or 0)
    bank_card = int(getattr(row, 'bank_card', 0) or 0)
    submit = int(getattr(row, 'submit', 0) or 0)
    success = int(getattr(row, 'success', 0) or 0)
    ad_account = int(getattr(row, 'ad_account', 0) or 0)

    return {
        'activate': activate,
        'register': register,
        'id_card': id_card,
        'bank_card': bank_card,
        'submit': submit,
        'success': success,
        'ad_account': ad_account,
        'rate_activate_register': _rate(register, activate),
        'rate_register_idcard': _rate(id_card, register),
        'rate_idcard_bankcard': _rate(bank_card, id_card),
        'rate_bankcard_submit': _rate(submit, bank_card),
        'rate_submit_success': _rate(success, submit),
        'rate_success_adaccount': _rate(ad_account, success),
    }


def _aggregate(platforms, start_date, end_date):
    """按日期+周聚合各步骤计数，并计算转化率（SQL 聚合）

    platforms: list[str] — 选中的应用市场列表，空列表表示全部
    """
    stage_cols = _stage_columns()

    # ---- 每日聚合 ----
    daily_q = _build_query(platforms, start_date, end_date)
    daily_q = daily_q.with_entities(
        FactConvAppmarket.下载日期,
        *stage_cols,
    ).group_by(FactConvAppmarket.下载日期).order_by(FactConvAppmarket.下载日期)

    daily_records = []
    for row in daily_q.all():
        date_str = row.下载日期
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            continue
        rec = _row_to_record(row)
        rec['date'] = date_str
        rec['weekday'] = WEEKDAY_MAP[d.weekday()]
        rec['week_start'] = _week_start(d).isoformat()
        daily_records.append(rec)

    # ---- 周聚合 ----
    week_expr = make_week_start_expr(FactConvAppmarket.下载日期).label('week_start')
    weekly_q = _build_query(platforms, start_date, end_date)
    weekly_q = weekly_q.with_entities(
        week_expr,
        *stage_cols,
    ).group_by(week_expr).order_by(week_expr)

    weekly_records = []
    for row in weekly_q.all():
        ws_val = row.week_start
        if isinstance(ws_val, str):
            ws_date = datetime.strptime(ws_val, '%Y-%m-%d').date()
        else:
            ws_date = ws_val
        rec = _row_to_record(row)
        rec['week_start'] = ws_date.isoformat()
        rec['week_end'] = _week_end(ws_date).isoformat()
        weekly_records.append(rec)

    return daily_records, weekly_records


@bp.route('/attribution-conversion', methods=['POST'])
@handle_exceptions
def attribution_conversion():
    """归因转化率分析 — 每日 + 每周各步骤转化率"""
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    platforms = filters.get('platforms', [])
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # 获取白名单内实际存在的平台列表
    available_platforms = sorted(
        [r[0] for r in db.session.query(FactConvAppmarket.应用市场)
         .filter(FactConvAppmarket.应用市场.in_(ALLOWED_PLATFORMS))
         .distinct().all() if r[0]]
    )

    daily_data, weekly_data = _aggregate(platforms, start_date, end_date)

    return jsonify({
        'success': True,
        'data': {
            'daily_data': daily_data,
            'weekly_data': weekly_data,
            'platforms': available_platforms,
            'selected_platforms': platforms,
        },
        'meta': _META,
    })
