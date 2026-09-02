# -*- coding: utf-8 -*-
"""应用市场 · 消耗和成本分析（v3.6.3）

数据源：
  - 消耗：agg_vendor_daily（厂商日聚合，平台=应用市场）
  - 开户数：fact_conv_appmarket 广告开户节点（是否创建完资金账号=1 AND 渠道类型=互联网引流 AND 是否新开户=1）
维度：平台 ∈ {oppo, vivo, 荣耀, 小米, 华为, 鸿蒙, 苹果}（7 大应用市场）

4 部分：
  1. 总览指标卡 — 总消耗、总开户、开户成本
  2. 分市场累计 — 各应用市场累计消耗、累计开户、开户成本
  3. 月度消耗 — 各应用市场每月消耗，柱状图
  4. 周度消耗 — 各应用市场每周消耗，柱状图
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, case
from backend.models_v2 import AggVendorDaily, FactConvAppmarket
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('app_market_cost', __name__, url_prefix='/api/v1/reports/app-market')

# 7 大应用市场（与归因转化率 / 广告计划分析口径一致，含 鸿蒙）
APP_MARKET_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']

# 广告开户复合条件（与归因转化率 / 广告计划分析一致）
AD_ACCOUNT_CONDITIONS = (
    (FactConvAppmarket.是否创建完资金账号 == 1)
    & (FactConvAppmarket.渠道类型 == '互联网引流')
    & (FactConvAppmarket.是否新开户 == 1)
)

_META = {
    'version': 'v3.6.3',
    'source_table': 'agg_vendor_daily + fact_conv_appmarket',
    'note': '消耗来自 agg_vendor_daily.花费；开户数来自 fact_conv_appmarket 广告开户节点（资金账号+互联网引流+新开户）',
}


def _parse_filters(data):
    filters = data.get('filters') or {}
    sd = filters.get('start_date', '2026-01-01')
    ed = filters.get('end_date', '2026-12-31')
    platforms = filters.get('platforms') or None
    return sd, ed, platforms


def _app_market_open_map(platforms, sd, ed):
    """各应用市场的广告开户节点数（fact_conv_appmarket，按 应用市场 聚合）。

    口径与 广告计划分析 / 归因转化率 一致：是否创建完资金账号=1 AND 互联网引流 AND 新开户=1。
    注意：agg_vendor_daily.开户人数 在最新源文件（9.3厂商广告计划维度明细）中为空，
    不能作为开户数来源，开户数一律取 fact_conv_appmarket。
    """
    q = db.session.query(
        FactConvAppmarket.应用市场,
        func.coalesce(
            func.sum(case((AD_ACCOUNT_CONDITIONS, 1), else_=0)), 0
        ).label('open_cnt'),
    ).filter(FactConvAppmarket.应用市场.in_(platforms))
    if sd:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 >= sd)
    if ed:
        q = q.filter(FactConvAppmarket.资金账号创建完成时间 <= ed)
    q = q.group_by(FactConvAppmarket.应用市场)
    return {r.应用市场: int(r.open_cnt or 0) for r in q.all()}


def _base_query(sd, ed, platforms=None):
    q = db.session.query(AggVendorDaily).filter(
        and_(
            AggVendorDaily.日期 >= sd,
            AggVendorDaily.日期 <= ed,
            AggVendorDaily.花费 > 0,
        )
    )
    if platforms:
        q = q.filter(AggVendorDaily.平台.in_(platforms))
    else:
        q = q.filter(AggVendorDaily.平台.in_(APP_MARKET_PLATFORMS))
    return q


# 周起始工具函数：给定日期字符串 YYYY-MM-DD，返回该周周一 YYYY-MM-DD
def _week_start(date_str):
    from datetime import datetime, timedelta
    d = datetime.strptime(date_str, '%Y-%m-%d')
    monday = d - timedelta(days=d.weekday())
    return monday.strftime('%Y-%m-%d')


@bp.route('/cost-analysis', methods=['POST'])
@handle_exceptions
def cost_analysis():
    """
    消耗和成本分析 — 4 部分聚合数据

    Request:
        {
            "filters": {
                "start_date": "2026-01-01",  // 可选
                "end_date": "2026-12-31"     // 可选
            }
        }

    Response:
        {
            "success": true,
            "data": {
                "summary": { "total_spend": float, "total_open": int, "cost_per_open": float },
                "by_market": [ { "platform": str, "total_spend": float, "total_open": int, "cost_per_open": float } ],
                "by_month": [ { "month": str, "platform": str, "spend": float } ],
                "by_week": [ { "week_start": str, "platform": str, "spend": float } ]
            }
        }
    """
    data = request.get_json() or {}
    sd, ed, platforms = _parse_filters(data)
    scope_platforms = platforms or APP_MARKET_PLATFORMS

    # 开户数来源：fact_conv_appmarket 广告开户节点（agg_vendor_daily.开户人数 在最新源文件中为空）
    open_map = _app_market_open_map(scope_platforms, sd, ed)

    # ---- Part 1 & 2: 总体 + 分市场聚合 ----
    market_q = db.session.query(
        AggVendorDaily.平台,
        func.sum(AggVendorDaily.花费).label('total_spend'),
    ).filter(
        and_(
            AggVendorDaily.日期 >= sd,
            AggVendorDaily.日期 <= ed,
            AggVendorDaily.花费 > 0,
        )
    )
    if platforms:
        market_q = market_q.filter(AggVendorDaily.平台.in_(platforms))
    else:
        market_q = market_q.filter(AggVendorDaily.平台.in_(APP_MARKET_PLATFORMS))
    market_q = market_q.group_by(AggVendorDaily.平台).order_by(AggVendorDaily.平台)

    spend_map = {row.平台: round(float(row.total_spend or 0), 2) for row in market_q.all()}

    by_market = []
    total_spend = 0.0
    total_open = 0
    for p in scope_platforms:
        spend = spend_map.get(p, 0.0)
        open_cnt = open_map.get(p, 0)
        total_spend += spend
        total_open += open_cnt
        by_market.append({
            'platform': p,
            'total_spend': spend,
            'total_open': open_cnt,
            'cost_per_open': round(spend / open_cnt, 2) if open_cnt > 0 else 0,
        })
    by_market.sort(key=lambda x: -x['total_spend'])

    summary = {
        'total_spend': round(total_spend, 2),
        'total_open': total_open,
        'cost_per_open': round(total_spend / total_open, 2) if total_open > 0 else 0,
    }

    # ---- Part 3: 月度消耗 ----
    month_q = db.session.query(
        func.substr(AggVendorDaily.日期, 1, 7).label('month'),
        AggVendorDaily.平台,
        func.sum(AggVendorDaily.花费).label('spend'),
    ).filter(
        and_(
            AggVendorDaily.日期 >= sd,
            AggVendorDaily.日期 <= ed,
            AggVendorDaily.花费 > 0,
        )
    )
    if platforms:
        month_q = month_q.filter(AggVendorDaily.平台.in_(platforms))
    else:
        month_q = month_q.filter(AggVendorDaily.平台.in_(APP_MARKET_PLATFORMS))
    month_q = month_q.group_by('month', AggVendorDaily.平台).order_by('month', AggVendorDaily.平台)

    by_month = []
    for row in month_q.all():
        by_month.append({
            'month': row.month,
            'platform': row.平台,
            'spend': round(float(row.spend or 0), 2),
        })

    # ---- Part 4: 周度消耗 ----
    # 由于数据库没有周字段，用 Python 侧按日期聚合
    week_rows = db.session.query(
        AggVendorDaily.日期,
        AggVendorDaily.平台,
        func.sum(AggVendorDaily.花费).label('spend'),
    ).filter(
        and_(
            AggVendorDaily.日期 >= sd,
            AggVendorDaily.日期 <= ed,
            AggVendorDaily.花费 > 0,
        )
    )
    if platforms:
        week_rows = week_rows.filter(AggVendorDaily.平台.in_(platforms))
    else:
        week_rows = week_rows.filter(AggVendorDaily.平台.in_(APP_MARKET_PLATFORMS))
    week_rows = week_rows.group_by(AggVendorDaily.日期, AggVendorDaily.平台).order_by(AggVendorDaily.日期)

    week_agg = {}
    for row in week_rows.all():
        ws = _week_start(row.日期)
        key = (ws, row.平台)
        if key not in week_agg:
            week_agg[key] = 0.0
        week_agg[key] += float(row.spend or 0)

    by_week = []
    for (ws, plat), spend in sorted(week_agg.items()):
        by_week.append({
            'week_start': ws,
            'platform': plat,
            'spend': round(spend, 2),
        })

    return jsonify({
        'success': True,
        'data': {
            'summary': summary,
            'by_market': by_market,
            'by_month': by_month,
            'by_week': by_week,
            'platforms': APP_MARKET_PLATFORMS,
        },
        'meta': _META,
    })
