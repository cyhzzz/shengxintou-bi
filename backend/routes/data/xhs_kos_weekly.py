# -*- coding: utf-8 -*-
"""分支KOS转化周报（v3.8.0 新增）

数据口径：fact_conv_content.笔记ID 关联 agg_xhs_note.笔记ID，
agg_xhs_note.创作者 属于分支KOS投顾名单（何慧敏/刘贝/张永强/张靖月/李荣志/汤凯/盛睿雪/陈小芳/黄天平/赵茜）。
榜单指标与员工转化周报（/employee-conversion/weekly）对齐：微信线索数 / 开口 / 有效线索 /
开户 / 有效户 / 资产 / 开户率 / 有效户率。

榜单口径（与员工转化周报对齐）：
- total：截至 end_date 的全量历史累计（不按 start_date 过滤）
- existing：线索日期落在 [start, end] 内的存量客户
- new：线索日期落在 [start, end] 内的全部新进线索（含存量客户）
- existing_new_open：线索日期 < start + 开户时间落在 [start, end] + 是否开户==1（存量线索新开户）
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import and_

from backend.database import db
from backend.models_v2 import AggXhsNote, FactConvContent
from backend.utils.decorators import handle_exceptions

bp = Blueprint('xhs_kos_weekly', __name__)

# 分支KOS投顾名单（agg_xhs_note.创作者 取值）
KOS_ROSTER = [
    '何慧敏', '刘贝', '张永强', '张靖月', '李荣志',
    '汤凯', '盛睿雪', '陈小芳', '黄天平', '赵茜',
]

PLATFORM = '小红书'


def is_kos_creator(creator):
    """创作者是否属于分支KOS投顾名单。

    子串匹配：兼容「轮岗（赵茜）」这类带前缀/括号的写法；名单内无互相包含冲突。
    """
    if not creator:
        return False
    return any(name in creator for name in KOS_ROSTER)


def kos_name_of(creator):
    """取创作者命中的分支KOS投顾姓名；未命中返回 None。"""
    if not creator:
        return None
    for name in KOS_ROSTER:
        if name in creator:
            return name
    return None


def _parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], '%Y-%m-%d').date()
    except Exception:
        return None


def _load_kos_leads():
    """拉取分支KOS笔记关联的全部 fact_conv_content 行（内存聚合，量级小）。

    agg_xhs_note.笔记ID 存在少量重复（实测 2 组），按 fact_conv_content.id 去重，
    避免同一线索因笔记重复而重复计数。
    """
    rows = db.session.query(
        FactConvContent.id,
        FactConvContent.线索日期,
        FactConvContent.是否客户开口,
        FactConvContent.是否有效线索,
        FactConvContent.是否开户,
        FactConvContent.是否为有效户,
        FactConvContent.是否为存量客户,
        FactConvContent.开户时间,
        FactConvContent.资产,
        AggXhsNote.创作者,
    ).join(AggXhsNote, and_(AggXhsNote.笔记ID == FactConvContent.笔记ID)).all()

    seen = set()
    out = []
    for r in rows:
        if r.id in seen:
            continue
        seen.add(r.id)
        kos = kos_name_of(r.创作者)
        if kos is None:
            continue
        out.append({
            'kos': kos,
            '线索日期': r.线索日期,
            '线索日期_obj': _parse_date(r.线索日期),
            '开户时间_obj': _parse_date(r.开户时间),
            '是否客户开口': int(r.是否客户开口 or 0),
            '是否有效线索': int(r.是否有效线索 or 0),
            '是否开户': int(r.是否开户 or 0),
            '是否为有效户': int(r.是否为有效户 or 0),
            '是否为存量客户': int(r.是否为存量客户 or 0),
            '资产': float(r.资产 or 0),
        })
    return out


def _aggregate(leads):
    """按 KOS 名单聚合榜单指标（无数据成员补 0），按开户率降序。"""
    agg = defaultdict(lambda: {
        'total_leads': 0, 'mouth': 0, 'valid_lead': 0,
        'opened': 0, 'valid': 0, 'assets': 0.0,
    })
    for l in leads:
        a = agg[l['kos']]
        a['total_leads'] += 1
        a['mouth'] += l['是否客户开口']
        a['valid_lead'] += l['是否有效线索']
        a['opened'] += l['是否开户']
        a['valid'] += l['是否为有效户']
        a['assets'] += l['资产']
    items = []
    for kos in KOS_ROSTER:
        a = agg.get(kos)
        leads_n = a['total_leads'] if a else 0
        opened = a['opened'] if a else 0
        valid = a['valid'] if a else 0
        items.append({
            'kos_name': kos,
            'platform': PLATFORM,
            'total_leads': leads_n,
            'mouth_count': a['mouth'] if a else 0,
            'valid_lead_count': a['valid_lead'] if a else 0,
            'opened_count': opened,
            'valid_customer_count': valid,
            'total_assets': round(a['assets'], 2) if a else 0,
            'opening_rate': round(opened / leads_n * 100, 2) if leads_n else 0,
            'valid_customer_rate': round(valid / opened * 100, 2) if opened else 0,
        })
    items.sort(key=lambda x: x['opening_rate'], reverse=True)
    return items


def _aggregate_existing_new_open(old_leads, old_opened):
    """存量线索新开户榜（口径与员工转化周报对齐）：
    total_leads = 线索日期 < start 的老线索总数（不论是否开户）；
    opened 等指标 = 老线索中本周开户（开户时间落在区间内且是否开户==1）的线索。
    """
    total_map = defaultdict(int)
    for l in old_leads:
        total_map[l['kos']] += 1
    opened_map = {i['kos_name']: i for i in _aggregate(old_opened)}
    items = []
    for kos in KOS_ROSTER:
        t = total_map.get(kos, 0)
        o = opened_map.get(kos)
        opened = o['opened_count'] if o else 0
        valid = o['valid_customer_count'] if o else 0
        items.append({
            'kos_name': kos,
            'platform': PLATFORM,
            'total_leads': t,
            'mouth_count': o['mouth_count'] if o else 0,
            'valid_lead_count': o['valid_lead_count'] if o else 0,
            'opened_count': opened,
            'valid_customer_count': valid,
            'total_assets': o['total_assets'] if o else 0,
            'opening_rate': round(opened / t * 100, 2) if t else 0,
            'valid_customer_rate': round(valid / opened * 100, 2) if opened else 0,
        })
    items.sort(key=lambda x: x['opening_rate'], reverse=True)
    return items


def _build_rankings(leads, start_date, end_date):
    sd, ed = _parse_date(start_date), _parse_date(end_date)

    def _in_range(d, s, e):
        if d is None:
            return False
        if s and d < s:
            return False
        if e and d > e:
            return False
        return True

    total = [l for l in leads if ed is None or _in_range(l['线索日期_obj'], None, ed)]
    existing = [l for l in leads if _in_range(l['线索日期_obj'], sd, ed) and l['是否为存量客户'] == 1]
    new = [l for l in leads if _in_range(l['线索日期_obj'], sd, ed) and l['是否为存量客户'] != 1]
    old_leads = [l for l in leads if sd and l['线索日期_obj'] and l['线索日期_obj'] < sd]
    old_opened = [
        l for l in old_leads
        if _in_range(l['开户时间_obj'], sd, ed) and l['是否开户'] == 1
    ]
    return {
        'total': _aggregate(total),
        'existing': _aggregate(existing),
        'new': _aggregate(new),
        'existing_new_open': _aggregate_existing_new_open(old_leads, old_opened),
    }


def _build_overview(leads, start_date, end_date):
    sd, ed = _parse_date(start_date), _parse_date(end_date)
    items = _aggregate([
        l for l in leads
        if l['线索日期_obj'] and (sd is None or l['线索日期_obj'] >= sd)
        and (ed is None or l['线索日期_obj'] <= ed)
    ])
    total_leads = sum(i['total_leads'] for i in items)
    opened = sum(i['opened_count'] for i in items)
    return {
        'total_leads': total_leads,
        'mouth_count': sum(i['mouth_count'] for i in items),
        'valid_lead_count': sum(i['valid_lead_count'] for i in items),
        'opened_count': opened,
        'valid_customer_count': sum(i['valid_customer_count'] for i in items),
        'total_assets': round(sum(i['total_assets'] for i in items), 2),
        'opening_rate': round(opened / total_leads * 100, 2) if total_leads else 0,
    }


def _build_year_breakdown(leads, end_date):
    ed = _parse_date(end_date)
    result = {}
    for year in (2025, 2026):
        ys, ye = date(year, 1, 1), date(year, 12, 31)
        items = _aggregate([
            l for l in leads
            if l['线索日期_obj'] and ys <= l['线索日期_obj'] <= ye
            and (ed is None or l['线索日期_obj'] <= ed)
        ])
        total_leads = sum(i['total_leads'] for i in items)
        opened = sum(i['opened_count'] for i in items)
        valid = sum(i['valid_customer_count'] for i in items)
        result[f'y{year}'] = {
            'label': f'{year % 100}年线索\n{year % 100}年开户',
            'total_leads': total_leads,
            'opened_count': opened,
            'valid_customer_count': valid,
            'total_assets': round(sum(i['total_assets'] for i in items), 2),
            'opening_rate': round(opened / total_leads * 100, 2) if total_leads else 0,
            'valid_customer_rate': round(valid / opened * 100, 2) if opened else 0,
        }
    return result


def _build_trend(leads, start_date, end_date):
    sd, ed = _parse_date(start_date), _parse_date(end_date)
    agg = defaultdict(lambda: {'leads': 0, 'opened': 0, 'valid': 0})
    for l in leads:
        d = l['线索日期_obj']
        if d is None:
            continue
        if sd and d < sd:
            continue
        if ed and d > ed:
            continue
        key = d.strftime('%Y-%m')
        agg[key]['leads'] += 1
        agg[key]['opened'] += l['是否开户']
        agg[key]['valid'] += l['是否为有效户']
    return [{'period': k, **agg[k]} for k in sorted(agg)]


def _latest_kos_week_range(leads):
    """默认周：以 KOS 线索最新日期所在自然周（周一~周日）为默认周期。"""
    latest = max((l['线索日期_obj'] for l in leads if l['线索日期_obj']), default=None)
    if latest is None:
        today = date.today()
        start = today - timedelta(days=today.weekday())
    else:
        start = latest - timedelta(days=latest.weekday())
    end = start + timedelta(days=6)
    return {
        'latest_date': latest.isoformat() if latest else '',
        'default_week_start': start.isoformat(),
        'default_week_end': end.isoformat(),
    }


@bp.route('/xhs/kos-weekly', methods=['POST'])
@handle_exceptions
def get_kos_weekly():
    """分支KOS转化周报数据。

    请求体（JSON）：{ "start_date": "2026-07-01", "end_date": "2026-07-31" }（可选）
    响应 data 结构与 /employee-conversion/weekly 对齐（单平台：小红书）：
      rankings / year_breakdown / overview / trend / roster_count / roster / platform
    """
    data = request.get_json(silent=True) or {}
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    leads = _load_kos_leads()
    return jsonify({
        'success': True,
        'data': {
            'platform': PLATFORM,
            'roster_count': len(KOS_ROSTER),
            'roster': KOS_ROSTER,
            'rankings': {PLATFORM: _build_rankings(leads, start_date, end_date)},
            'year_breakdown': {PLATFORM: _build_year_breakdown(leads, end_date)},
            'overview': {PLATFORM: _build_overview(leads, start_date, end_date)},
            'trend': _build_trend(leads, start_date, end_date),
        },
    })


@bp.route('/xhs/kos-weekly/filter-options', methods=['GET'])
@handle_exceptions
def get_kos_weekly_filter_options():
    """分支KOS转化周报筛选元数据：默认周范围 + 名单。"""
    leads = _load_kos_leads()
    return jsonify({
        'success': True,
        'data': {
            'platform': PLATFORM,
            'roster': KOS_ROSTER,
            'roster_count': len(KOS_ROSTER),
            **_latest_kos_week_range(leads),
        },
    })
