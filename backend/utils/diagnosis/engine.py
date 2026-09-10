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


RECOVERY_WINDOW_DAYS = 5
RECOVERY_OPEN_RATIO = 0.8


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


def build_content_evidence(month, platform_monthly, platform_daily):
    """构建内容平台证据包：分平台当月 vs 前 3 月基线、逐日走势、旬级聚合、月末恢复判定"""
    prev_month = shift_month(month, -1)
    baseline_months = [shift_month(month, -3), shift_month(month, -2), prev_month]
    target_rows = [row for row in platform_monthly if row['month'] == month]
    prev_rows = [row for row in platform_monthly if row['month'] == prev_month]
    baseline_rows = [row for row in platform_monthly if row['month'] in baseline_months]
    platforms = sorted({row['platform'] for row in target_rows} | {row['platform'] for row in prev_rows})

    baseline_totals = {}
    for row in baseline_rows:
        bucket = baseline_totals.setdefault(row['platform'], {'leads': 0, 'opened': 0, 'zero': 0})
        bucket['leads'] += row['leads']
        bucket['opened'] += row['opened']
        bucket['zero'] += row['zero']

    monthly_out = []
    for row in target_rows:
        baseline = baseline_totals.get(row['platform'], {})
        monthly_out.append({
            'platform': row['platform'],
            'leads': row['leads'],
            'open_rate': metrics.ratio(row['opened'], row['leads']),
            'zero_interaction_rate': metrics.ratio(row['zero'], row['leads']),
            'prev3_open_rate': metrics.ratio(baseline.get('opened'), baseline.get('leads')),
            'prev3_zero_interaction_rate': metrics.ratio(baseline.get('zero'), baseline.get('leads')),
        })

    daily_out = [
        {
            'platform': row['platform'],
            'date': row['date'].isoformat(),
            'leads': row['leads'],
            'open_rate': metrics.ratio(row['opened'], row['leads']),
            'zero_interaction_rate': metrics.ratio(row['zero'], row['leads']),
        }
        for row in sorted(platform_daily, key=lambda item: (item['platform'], item['date']))
    ]
    dates = sorted({row['date'] for row in platform_daily})
    window_dates = dates[-RECOVERY_WINDOW_DAYS:] if dates else []

    def _rate(rows):
        leads = sum(row['leads'] for row in rows)
        opened = sum(row['opened'] for row in rows)
        return metrics.ratio(opened, leads)

    window_rate = _rate([row for row in platform_daily if row['date'] in set(window_dates)])
    baseline_rate = metrics.ratio(
        sum(row['opened'] for row in baseline_rows),
        sum(row['leads'] for row in baseline_rows),
    )
    recovered = (
        window_rate is not None
        and baseline_rate is not None
        and baseline_rate > 0
        and window_rate / baseline_rate + 1e-9 >= RECOVERY_OPEN_RATIO
    )
    recovery = {
        'window': '月末最后 %d 天' % len(window_dates) if window_dates else '无数据',
        'dates': [day.isoformat() for day in window_dates],
        'open_rate': window_rate,
        'prev3_open_rate': baseline_rate,
        'recovered': recovered,
    }

    return {
        'month': month,
        'baseline_months': baseline_months,
        'platform_monthly': monthly_out,
        'daily': daily_out,
        'xun': metrics.summarize_xun_rows(platform_daily),
        'recovery': recovery,
    }


def _empty_result(month, snapshot_dates=None):
    return {
        'month': month,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'snapshot_dates': snapshot_dates or [],
        'summary': _build_summary([]),
        'items': [],
        'content_evidence': None,
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
    evidence_months = [shift_month(month, -3)] + months
    content_monthly = metrics.fetch_content_monthly(evidence_months)
    appmarket_monthly = metrics.fetch_appmarket_monthly(months)

    current = content_monthly.get(month, {'total': 0, 'opened': 0, 'valid': 0, 'zero': 0, 'stock': 0})
    current_appmarket = appmarket_monthly.get(month, {'downloads': 0})
    platform_daily = metrics.fetch_content_platform_daily(month)
    platform_monthly = metrics.fetch_content_platform_monthly(evidence_months)
    content_evidence = build_content_evidence(month, platform_monthly, platform_daily)
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
        'zero': sum(row.get('zero', 0) for row in mature_rows),
    }
    prev_window = {
        'total': sum(row['total'] for row in prev_rows),
        'opened': sum(row['opened'] for row in prev_rows),
        'valid': sum(row['valid'] for row in prev_rows),
        'zero': sum(row.get('zero', 0) for row in prev_rows),
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
        'baseline_months': evidence_months[:-1],
    }
    items = rules.build_items(ctx)
    return {
        'month': month,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'snapshot_dates': snapshot_dates,
        'summary': _build_summary(items),
        'items': items,
        'content_evidence': content_evidence,
    }
