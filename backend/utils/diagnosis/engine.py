# -*- coding: utf-8 -*-
"""智能辅助诊断 - 编排层

取数（metrics）-> 规则评估（rules）-> 汇总输出；仅 date.today() 涉及时钟，
其余窗口全部由数据快照日推导，保证跨端口径一致。
"""
import re
from datetime import datetime, timedelta

from backend.utils.diagnosis import metrics, rules

MONTH_RE = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')
CHAIN_KEYS = ('xhs', 'appmarket', 'global')
STATUS_RANK = {'ok': 0, 'info': 1, 'warn': 2, 'error': 3}


def shift_month(month, delta):
    total = int(month[:4]) * 12 + int(month[5:7]) - 1 + delta
    return '{:04d}-{:02d}'.format(total // 12, total % 12 + 1)


def _build_summary(items):
    chains = {}
    for key in CHAIN_KEYS:
        counts = {'error': 0, 'warn': 0, 'info': 0, 'status': 'ok'}
        for item in items:
            if item['chain'] == key:
                counts[item['level']] += 1
        for level in ('error', 'warn', 'info'):
            if counts[level]:
                counts['status'] = level
                break
        chains[key] = counts
    overall = 'ok'
    for key in CHAIN_KEYS:
        if STATUS_RANK[chains[key]['status']] > STATUS_RANK[overall]:
            overall = chains[key]['status']
    return {'overall': overall, 'chains': chains}


def _empty_result(month, snapshot_dates=None):
    return {
        'month': month,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'snapshot_dates': snapshot_dates or [],
        'summary': _build_summary([]),
        'items': [],
    }


def run_diagnosis(month=None):
    if not month:
        month = metrics.resolve_default_month()
        if not month:
            return _empty_result('')
    if not MONTH_RE.match(month):
        raise ValueError('month 参数格式必须为 YYYY-MM')

    snapshot_dates = metrics.fetch_snapshot_dates()
    dated = [value for value in (metrics.parse_date(item['latest']) for item in snapshot_dates) if value]
    snapshot_max = max(dated) if dated else None
    snapshot_min = min(dated) if dated else None
    eval_cutoff = snapshot_max - timedelta(days=rules.MATURITY_DAYS) if snapshot_max else None

    months = [shift_month(month, -2), shift_month(month, -1), month]
    content_monthly = metrics.fetch_content_monthly(months)
    appmarket_monthly = metrics.fetch_appmarket_monthly(months)

    current = content_monthly.get(month, {'total': 0, 'opened': 0, 'valid': 0, 'stock': 0})
    current_appmarket = appmarket_monthly.get(month, {'downloads': 0})
    if current['total'] == 0 and current_appmarket['downloads'] == 0:
        return _empty_result(month, snapshot_dates)

    content_daily = metrics.fetch_content_daily(month)
    prev_content_daily = metrics.fetch_content_daily(shift_month(month, -1))
    window_start = snapshot_max - timedelta(days=rules.STALLED_WINDOW_DAYS) if snapshot_max else None
    platform_activity = metrics.fetch_platform_activity(window_start) if window_start else []

    mature_rows = []
    prev_rows = []
    if eval_cutoff:
        mature_rows = [row for row in content_daily if row['date'] <= eval_cutoff]
        prev_rows = [row for row in prev_content_daily if row['date'].day <= eval_cutoff.day]
    cur_mature = {
        'total': sum(row['total'] for row in mature_rows),
        'opened': sum(row['opened'] for row in mature_rows),
        'valid': sum(row['valid'] for row in mature_rows),
    }
    prev_window = {
        'total': sum(row['total'] for row in prev_rows),
        'opened': sum(row['opened'] for row in prev_rows),
        'valid': sum(row['valid'] for row in prev_rows),
    }

    ctx = {
        'month': month,
        'prev_month': shift_month(month, -1),
        'snapshot_dates': snapshot_dates,
        'snapshot_min': snapshot_min,
        'snapshot_max': snapshot_max,
        'eval_cutoff': eval_cutoff,
        'content_monthly': content_monthly,
        'appmarket_monthly': appmarket_monthly,
        'content_daily': content_daily,
        'platform_activity': platform_activity,
        'cur_mature': cur_mature,
        'prev_window': prev_window,
    }
    items = rules.build_items(ctx)
    return {
        'month': month,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'snapshot_dates': snapshot_dates,
        'summary': _build_summary(items),
        'items': items,
    }
