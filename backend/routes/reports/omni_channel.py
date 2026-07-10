# -*- coding: utf-8 -*-
"""全渠道获客情况报表 v3.1（v3.1 §二.5 重构）

数据源（按用户口径，**单一独立数据源**）:
- agg_daily_channel_open  渠道类别粒度 4 大类 + 子渠道

agg_daily_channel_open 字段（5 个业务字段）:
- 开户成功人数 / 入金户数 / 有效户数（counts）
- 入金率 / 有效户率（rates，已在源表算好）

v3.1 重构:
- 6 端点合并为 4 端点
- 移除 fact_conv_content / fact_conv_appmarket / agg_vendor_daily（**与 agg_daily_channel_open 独立**，不能混合）
- 移除月度趋势，改为日趋势
- content-detail / appmarket-detail / nonad-detail 合并为 by-channel（按渠道类别筛选）
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_
from backend.models_v2 import AggDailyChannelOpen
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('omni_channel_report', __name__, url_prefix='/api/v1/reports/omni-channel')

_META = {
    'version': 'v3.1',
    'source_tables': ['agg_daily_channel_open'],
    'note': 'v3.1 重构：单一独立数据源 agg_daily_channel_open（4739 行 / 4 大类 / 31 子渠道）。前端按响应数据实时算占比。',
    'raw_sums_keys': ['opens', 'deposit', 'valid'],
    'derived_keys': ['valid_rate', 'deposit_rate', 'share'],
}

# 4 大类固定顺序（按实际 SUM 开户降序：合作 > 自然 > 员工 > 互联网）
# 实际数据: 合作 470,556 / 自然 226,987 / 员工 100,358 / 互联网 9,950
# v3.1 §二.5: 严格基于 agg_daily_channel_open 全表 SUM 排序
CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流']


def _i(v):
    try:
        return int(float(v or 0))
    except (TypeError, ValueError):
        return 0


def _f(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0


def _apply_date(filters):
    """返回 (sd, ed) 元组，时间区间是 TEXT 字段，使用字符串比较"""
    return filters.get('start_date'), filters.get('end_date')


def _date_filter(model, col, sd, ed):
    if sd and ed:
        return and_(getattr(model, col) >= sd, getattr(model, col) <= ed)
    return None

def _parse_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return [s.strip() for s in v.split(',') if s.strip()]
    return [str(v)]


def _channel_filter_clause(filters):
    """读取 channel_categories / sub_channels，返回 (cat_clause, sub_clause)"""
    channel_categories = _parse_list(filters.get('channel_categories') or filters.get('channel_category'))
    sub_channels = _parse_list(filters.get('sub_channels') or filters.get('sub_channel'))
    cat_clause = AggDailyChannelOpen.渠道类别.in_(channel_categories) if channel_categories else None
    sub_clause = AggDailyChannelOpen.渠道名称.in_(sub_channels) if sub_channels else None
    return cat_clause, sub_clause


@bp.route('/summary', methods=['POST'])
@handle_exceptions
def omni_channel_summary():
    u"""总览：4 大类 + 子渠道聚合（仅基于 agg_daily_channel_open）

    v3.1 §二.5 顶部 4 指标卡数据源（总开户/总入金/总有效户 + TOP 渠道类别+占比）。
    支持 filters.channel_categories / filters.sub_channels 联动筛选。
    """
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    sd, ed = _apply_date(filters)
    cond = _date_filter(AggDailyChannelOpen, '时间区间', sd, ed)
    cat_clause, sub_clause = _channel_filter_clause(filters)

    # ---- 4 大类汇总 ----
    cat_q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposit'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    )
    if cond is not None:
        cat_q = cat_q.filter(cond)
    if cat_clause is not None:
        cat_q = cat_q.filter(cat_clause)
    if sub_clause is not None:
        cat_q = cat_q.filter(sub_clause)
    cat_q = cat_q.group_by(AggDailyChannelOpen.渠道类别)
    cat_rows = cat_q.all()

    # 按固定顺序返回 + 补全缺失类别（保证 4 类齐全）
    cat_map = {r.channel_category: r for r in cat_rows}
    by_category = []
    total_opens = 0
    total_deposit = 0
    total_valid = 0
    for cat in CATEGORY_ORDER:
        r = cat_map.get(cat)
        if r is None:
            by_category.append({
                'channel_category': cat,
                'opens': 0, 'deposit': 0, 'valid': 0,
                'valid_rate': 0, 'deposit_rate': 0,
            })
            continue
        o, dp, v = _i(r.opens), _i(r.deposit), _i(r.valid)
        total_opens += o
        total_deposit += dp
        total_valid += v
        by_category.append({
            'channel_category': cat,
            'opens': o,
            'deposit': dp,
            'valid': v,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
            'deposit_rate': round(dp / o * 100, 2) if o > 0 else 0,
        })

    # share 在前端按 opens/total_opens 算（plan §二.5: 占比由前端计算）

    # ---- 子渠道明细 ----
    sub_q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        AggDailyChannelOpen.渠道名称.label('channel_name'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposit'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    )
    if cond is not None:
        sub_q = sub_q.filter(cond)
    if cat_clause is not None:
        sub_q = sub_q.filter(cat_clause)
    if sub_clause is not None:
        sub_q = sub_q.filter(sub_clause)
    sub_q = sub_q.group_by(AggDailyChannelOpen.渠道类别, AggDailyChannelOpen.渠道名称)
    by_subchannel = []
    for r in sub_q.all():
        o, dp, v = _i(r.opens), _i(r.deposit), _i(r.valid)
        if o == 0 and dp == 0 and v == 0:
            continue
        by_subchannel.append({
            'channel_category': r.channel_category or '未归因',
            'channel_name': r.channel_name or '未归因',
            'opens': o,
            'deposit': dp,
            'valid': v,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
            'deposit_rate': round(dp / o * 100, 2) if o > 0 else 0,
        })
    by_subchannel.sort(key=lambda x: (-x['opens'], x['channel_category'], x['channel_name']))

    # v3.1 §二.5 顶部第 4 张「4 类渠道开户 TOP + 占比」
    non_empty = [c for c in by_category if (c['opens'] or c['deposit'] or c['valid'])]
    top_row = max(non_empty, key=lambda x: x['opens'], default=None) if non_empty else None
    top_category_name = top_row['channel_category'] if top_row else ''
    top_opens = top_row['opens'] if top_row else 0
    top_share = round(top_opens / total_opens * 100, 2) if total_opens > 0 and top_row else 0

    return jsonify({
        'success': True,
        'data': {
            'totals': {
                'opens': total_opens,
                'deposit': total_deposit,
                'valid': total_valid,
                'total_opens': total_opens,
                'total_deposit': total_deposit,
                'total_valid': total_valid,
            },
            'by_category': by_category,
            'by_subchannel': by_subchannel,
            'top_category': {
                'channel_category': top_category_name,
                'opens': top_opens,
                'share': top_share,
            },
        },
        'meta': _META,
    })


@bp.route('/daily-trend', methods=['POST'])
@handle_exceptions
def omni_channel_daily_trend():
    u"""渠道日趋势（长格式：每行 = (日期, 渠道类别, 渠道名称) 的 3 个指标）

    含二级渠道，前端可按一级渠道类别聚合或下钻二级。
    支持 filters.channel_categories / filters.sub_channels 联动筛选。
    响应键：daily_trend（v3.1 标准），trend 旧键保留 1 个 release。
    """
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    sd, ed = _apply_date(filters)
    cond = _date_filter(AggDailyChannelOpen, '时间区间', sd, ed)
    cat_clause, sub_clause = _channel_filter_clause(filters)

    q = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        AggDailyChannelOpen.渠道名称.label('channel_name'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposit'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    )
    if cond is not None:
        q = q.filter(cond)
    if cat_clause is not None:
        q = q.filter(cat_clause)
    if sub_clause is not None:
        q = q.filter(sub_clause)
    q = q.group_by(
        AggDailyChannelOpen.时间区间,
        AggDailyChannelOpen.渠道类别,
        AggDailyChannelOpen.渠道名称,
    )
    rows = q.all()

    trend = []
    for r in rows:
        d = str(r.date or '')[:10]
        if not d or not r.channel_category:
            continue
        trend.append({
            'date': d,
            'channel_category': r.channel_category,
            'channel_name': r.channel_name or '未归因',
            'opens': _i(r.opens),
            'deposit': _i(r.deposit),
            'valid': _i(r.valid),
        })
    trend.sort(key=lambda x: (x['date'], x['channel_category'], x['channel_name']))

    return jsonify({
        'success': True,
        'data': {'daily_trend': trend, 'trend': trend},  # trend 保留兼容
        'meta': _META,
    })


@bp.route('/by-channel', methods=['POST'])
@handle_exceptions
def omni_channel_by_channel():
    """按渠道类别→渠道名称分组明细（4 Tab 数据）

    request body: { filters: {...}, channel_category?: '互联网引流'|'合作机构'|... }
    无 channel_category 时返回全部类别 + 子渠道（前端 4 Tab 切换）
    """
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    channel_category = (data.get('channel_category') or '').strip()
    sub_channels = filters.get('sub_channels') or filters.get('sub_channel') or []
    if isinstance(sub_channels, str):
        sub_channels = [s for s in sub_channels.split(',') if s.strip()]
    # v3.1 §二.5：filters.channel_categories 多选也支持（与 channel_category 单值互不冲突）
    cat_clause, sub_clause_from_filters = _channel_filter_clause(filters)
    sd, ed = _apply_date(filters)
    cond = _date_filter(AggDailyChannelOpen, '时间区间', sd, ed)

    q = db.session.query(
        AggDailyChannelOpen.渠道类别.label('channel_category'),
        AggDailyChannelOpen.渠道名称.label('channel_name'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposit'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    )
    if cond is not None:
        q = q.filter(cond)
    if channel_category:
        q = q.filter(AggDailyChannelOpen.渠道类别 == channel_category)
    elif cat_clause is not None:
        q = q.filter(cat_clause)
    if sub_channels:
        q = q.filter(AggDailyChannelOpen.渠道名称.in_(sub_channels))
    elif sub_clause_from_filters is not None:
        q = q.filter(sub_clause_from_filters)
    q = q.group_by(AggDailyChannelOpen.渠道类别, AggDailyChannelOpen.渠道名称)
    rows = q.all()

    items = []
    for r in rows:
        o, dp, v = _i(r.opens), _i(r.deposit), _i(r.valid)
        if o == 0 and dp == 0 and v == 0:
            continue
        items.append({
            'channel_category': r.channel_category or '未归因',
            'channel_name': r.channel_name or '未归因',
            'opens': o,
            'deposit': dp,
            'valid': v,
            'valid_rate': round(v / o * 100, 2) if o > 0 else 0,
            'deposit_rate': round(dp / o * 100, 2) if o > 0 else 0,
        })
    items.sort(key=lambda x: -x['opens'])

    return jsonify({
        'success': True,
        'data': {
            'items': items,
            'channel_category': channel_category or 'all',
        },
        'meta': _META,
    })


@bp.route('/filter-options', methods=['GET'])
@handle_exceptions
def omni_channel_filter_options():
    cats = sorted({r[0] for r in db.session.query(AggDailyChannelOpen.渠道类别).distinct().all() if r[0]})
    sub_channels = sorted({r[0] for r in db.session.query(AggDailyChannelOpen.渠道名称).distinct().all() if r[0]})
    return jsonify({
        'success': True,
        'data': {
            'channel_categories': cats,
            'sub_channels': sub_channels,
        },
        'meta': _META,
    })
