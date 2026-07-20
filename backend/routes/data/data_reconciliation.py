# -*- coding: utf-8 -*-
"""抖音青鸟线索通数据对账端点（v3.3.6 新增）

将 fact_qingniao_leads 与 fact_conv_content 抖音引流线索做联合匹配，
比对 3 个标志位（开口 / 有效 / 开户），输出 4 类对账状态：
- 未匹到：青鸟侧有记录但系统侧抖音引流线索中找不到候选
- 疑似漏打标：青鸟侧某标志位「未打」但系统侧对应标志=1
- 疑似误打标：青鸟侧某标志位「已打」但系统侧对应标志=0
- 正确：3 个标志位两边一致

匹配字段：青鸟侧「微信线索昵称 + 日期」vs 系统侧「微信昵称 + 线索日期」
匹配方式：归一化昵称精确匹配 + 日期容差 ±N 天
"""
import re
import unicodedata
from collections import defaultdict
from datetime import datetime

from flask import Blueprint, request, jsonify
from sqlalchemy import text

from backend.models_v2 import FactConvContent, FactQingniaoLeads
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('data_reconciliation', __name__)


# ============================================================================
# 昵称归一化
# ============================================================================

# Emoji Unicode 区段（覆盖常见 emoji + 变体选择符 + ZWJ）
_EMOJI_RANGES = [
    (0x1F600, 0x1F64F),   # emoticons
    (0x1F300, 0x1F5FF),   # symbols & pictographs
    (0x1F680, 0x1F6FF),   # transport & map symbols
    (0x1F1E0, 0x1F1FF),   # flags
    (0x2600, 0x26FF),     # misc symbols
    (0x2700, 0x27BF),     # dingbats
    (0x1F900, 0x1F9FF),   # supplemental symbols
    (0x1FA70, 0x1FAFF),   # extended-a
    (0x1F018, 0x1F270),   # various extended
    (0x2300, 0x23FF),     # misc technical (含部分 emoji)
    (0x2B00, 0x2BFF),     # misc symbols and arrows
]

# 零宽字符 + BOM
_ZERO_WIDTH_RANGES = [
    (0x200B, 0x200F),     # zero width space/joiner/non-joiner 等
    (0x202A, 0x202E),     # directional formatting
    (0x2060, 0x206F),     # word joiner 等
    (0xFEFF, 0xFEFF),     # BOM
]


def _strip_ranges(s, ranges):
    if not s:
        return s
    out = []
    for ch in s:
        cp = ord(ch)
        if any(start <= cp <= end for start, end in ranges):
            continue
        out.append(ch)
    return "".join(out)


def normalize_nickname(s, scheme='A'):
    """按方案 A/B/C 归一化昵称。

    A（推荐）：剥 emoji + 剥零宽 + NFC + 小写
    B：剥零宽 + NFC + 小写（不剥 emoji）
    C：原样 + 小写（基线对照）
    """
    if s is None:
        return None
    s = str(s)
    if scheme == 'A':
        s = _strip_ranges(s, _EMOJI_RANGES)
        s = _strip_ranges(s, _ZERO_WIDTH_RANGES)
        s = unicodedata.normalize('NFC', s)
    elif scheme == 'B':
        s = _strip_ranges(s, _ZERO_WIDTH_RANGES)
        s = unicodedata.normalize('NFC', s)
    else:  # C
        s = unicodedata.normalize('NFC', s)
    return s.strip().lower()


def _parse_date(d):
    """解析日期字符串/对象为 date 对象，失败返回 None。"""
    if d is None:
        return None
    if hasattr(d, 'year') and hasattr(d, 'month'):
        # 已经是 date/datetime 对象
        return d.date() if hasattr(d, 'date') else d
    try:
        s = str(d).strip()
        if not s:
            return None
        return datetime.strptime(s[:10], '%Y-%m-%d').date()
    except Exception:
        return None


def _qn_flag_to_int(v):
    """青鸟侧标志位「已打」/「未打」 -> 1/0。空值视为 0。"""
    if v is None:
        return 0
    s = str(v).strip()
    if '已打' in s or s == '1' or s == '是':
        return 1
    return 0


def _bool_to_str(v):
    """系统侧 0/1 -> 是/否；None -> None。"""
    if v is None:
        return None
    return '是' if int(v) == 1 else '否'


def _qn_flag_to_str(v):
    """青鸟侧「已打」/「未打」 -> 是/否；空值 -> 否。"""
    return '是' if _qn_flag_to_int(v) == 1 else '否'


# ============================================================================
# 端点
# ============================================================================

@bp.route('/data-reconciliation/douyin-qingniao/match', methods=['POST'])
@handle_exceptions
def douyin_qingniao_match():
    """抖音青鸟线索通对账：标志位差异比对。

    请求体（JSON）：
    {
        "start_date": "2026-07-01",       # 可选，青鸟侧日期范围起
        "end_date": "2026-07-31",         # 可选，青鸟侧日期范围止
        "date_tolerance_days": 3,         # 默认 3，日期容差 ±N 天
        "normalization_scheme": "A"       # 默认 A，候选 A/B/C
    }

    响应（JSON）：
    {
        "summary": {
            "qingniao_total": 1115,
            "matched_count": 950,
            "missed_count": 165,
            "suspected_missed_tag": 30,
            "suspected_wrong_tag": 20,
            "correct_count": 900
        },
        "records": [...],   # 每行 = 青鸟侧一条记录
        "normalization_scheme": "A",
        "date_tolerance_days": 3
    }
    """
    payload = request.get_json(force=True, silent=True) or {}
    date_tolerance_days = int(payload.get('date_tolerance_days', 3))
    normalization_scheme = str(payload.get('normalization_scheme', 'A')).upper()
    start_date = payload.get('start_date')
    end_date = payload.get('end_date')

    # 参数校验
    if normalization_scheme not in ('A', 'B', 'C'):
        return jsonify({'error': 'INVALID_NORMALIZATION_SCHEME',
                        'message': 'normalization_scheme 必须为 A/B/C'}), 400
    if date_tolerance_days < 0 or date_tolerance_days > 30:
        return jsonify({'error': 'INVALID_DATE_TOLERANCE',
                        'message': 'date_tolerance_days 必须在 0-30 之间'}), 400

    # 1. 查青鸟侧数据
    qn_q = db.session.query(FactQingniaoLeads)
    if start_date:
        qn_q = qn_q.filter(FactQingniaoLeads.日期 >= start_date)
    if end_date:
        qn_q = qn_q.filter(FactQingniaoLeads.日期 <= end_date)
    qn_rows = qn_q.all()

    empty_summary = {
        'qingniao_total': 0,
        'matched_count': 0,
        'missed_count': 0,
        'suspected_missed_tag': 0,
        'suspected_wrong_tag': 0,
        'correct_count': 0,
    }

    if not qn_rows:
        return jsonify({
            'summary': empty_summary,
            'records': [],
            'normalization_scheme': normalization_scheme,
            'date_tolerance_days': date_tolerance_days,
        })

    # 2. 查系统侧抖音引流线索（一次性拉，内存匹配）
    sys_rows = db.session.query(
        FactConvContent.微信昵称,
        FactConvContent.线索日期,
        FactConvContent.是否客户开口,
        FactConvContent.是否有效线索,
        FactConvContent.是否开户,
        FactConvContent.客户来源,
        FactConvContent.添加员工姓名,
    ).filter(FactConvContent.客户来源.like('%抖音引流%')).all()

    # 构建系统侧索引：normalized_nickname -> list of dicts
    sys_index = defaultdict(list)
    for r in sys_rows:
        if r.微信昵称 is None or r.线索日期 is None:
            continue
        key = normalize_nickname(r.微信昵称, normalization_scheme)
        if not key:
            continue
        d_obj = _parse_date(r.线索日期)
        if d_obj is None:
            continue
        sys_index[key].append({
            '微信昵称': r.微信昵称,
            '线索日期': r.线索日期 if isinstance(r.线索日期, str) else str(r.线索日期),
            '是否客户开口': int(r.是否客户开口 or 0),
            '是否有效线索': int(r.是否有效线索 or 0),
            '是否开户': int(r.是否开户 or 0),
            '客户来源': r.客户来源,
            '添加员工姓名': r.添加员工姓名,
            '_date_obj': d_obj,
        })

    # 3. 对每条青鸟记录做匹配
    records = []
    summary = {
        'qingniao_total': len(qn_rows),
        'matched_count': 0,
        'missed_count': 0,
        'suspected_missed_tag': 0,
        'suspected_wrong_tag': 0,
        'correct_count': 0,
    }

    for qn in qn_rows:
        qn_nickname = qn.微信线索昵称
        qn_date = qn.日期
        qn_date_str = qn_date if isinstance(qn_date, str) else (str(qn_date) if qn_date else None)
        qn_date_obj = _parse_date(qn_date)

        # 青鸟侧 3 个标志位
        qn_kouhao = _qn_flag_to_int(qn.微信用户首次消息)
        qn_youxiao = _qn_flag_to_int(qn.微信用户确认意向)
        qn_kaihu = _qn_flag_to_int(qn.开户)

        # 归一化昵称
        key = normalize_nickname(qn_nickname, normalization_scheme) if qn_nickname else None

        # 在系统侧找候选
        candidates = []
        if key and qn_date_obj:
            for c in sys_index.get(key, []):
                delta = abs((c['_date_obj'] - qn_date_obj).days)
                if delta <= date_tolerance_days:
                    candidates.append(c)

        if not candidates:
            # 未匹到
            records.append({
                '企微昵称': None,
                '线索日期': None,
                '青鸟昵称': qn_nickname,
                '青鸟日期': qn_date_str,
                '后台是否开口': None,
                '后台是否有效': None,
                '后台是否开户': None,
                '青鸟是否开口': _qn_flag_to_str(qn.微信用户首次消息),
                '青鸟是否有效': _qn_flag_to_str(qn.微信用户确认意向),
                '青鸟是否开户': _qn_flag_to_str(qn.开户),
                '状态': '未匹到',
                '差异详情': None,
                '青鸟线索ID': qn.id,
                '客户来源': None,
                '添加员工姓名': None,
            })
            summary['missed_count'] += 1
            continue

        # 取日期最接近的那条（候选集已确保容差内）
        candidates.sort(key=lambda c: abs((c['_date_obj'] - qn_date_obj).days))
        best = candidates[0]
        summary['matched_count'] += 1

        # 比对 3 个标志位
        # 每个标志：系统值 vs 青鸟值
        # 系统 1 + 青鸟 0 → 疑似漏打标（青鸟漏标）
        # 系统 0 + 青鸟 1 → 疑似误打标（青鸟误标）
        # 两边一致 → 正确
        diff_flags = []
        has_missed = False  # 系统有+青鸟无 → 漏打标
        has_wrong = False    # 系统无+青鸟有 → 误打标
        flag_pairs = [
            ('开口', best['是否客户开口'], qn_kouhao),
            ('有效', best['是否有效线索'], qn_youxiao),
            ('开户', best['是否开户'], qn_kaihu),
        ]
        for name, sys_v, qn_v in flag_pairs:
            if sys_v == qn_v:
                continue
            if sys_v == 1 and qn_v == 0:
                diff_flags.append(f'{name}(系统有青鸟无)')
                has_missed = True
            elif sys_v == 0 and qn_v == 1:
                diff_flags.append(f'{name}(系统无青鸟有)')
                has_wrong = True

        # 综合状态（优先级：疑似漏打标 > 疑似误打标 > 正确；混合时优先报漏打标）
        if has_missed:
            state = '疑似漏打标'
            summary['suspected_missed_tag'] += 1
        elif has_wrong:
            state = '疑似误打标'
            summary['suspected_wrong_tag'] += 1
        else:
            state = '正确'
            summary['correct_count'] += 1

        records.append({
            '企微昵称': best['微信昵称'],
            '线索日期': best['线索日期'],
            '青鸟昵称': qn_nickname,
            '青鸟日期': qn_date_str,
            '后台是否开口': _bool_to_str(best['是否客户开口']),
            '后台是否有效': _bool_to_str(best['是否有效线索']),
            '后台是否开户': _bool_to_str(best['是否开户']),
            '青鸟是否开口': _qn_flag_to_str(qn.微信用户首次消息),
            '青鸟是否有效': _qn_flag_to_str(qn.微信用户确认意向),
            '青鸟是否开户': _qn_flag_to_str(qn.开户),
            '状态': state,
            '差异详情': '; '.join(diff_flags) if diff_flags else None,
            '青鸟线索ID': qn.id,
            '客户来源': best['客户来源'],
            '添加员工姓名': best['添加员工姓名'],
        })

    return jsonify({
        'summary': summary,
        'records': records,
        'normalization_scheme': normalization_scheme,
        'date_tolerance_days': date_tolerance_days,
    })


@bp.route('/data-reconciliation/douyin-qingniao/date-range', methods=['GET'])
@handle_exceptions
def douyin_qingniao_date_range():
    """获取青鸟侧数据的日期范围，前端用于默认填充。"""
    result = db.session.execute(text(
        "SELECT MIN(日期) as min_date, MAX(日期) as max_date, COUNT(*) as total "
        "FROM fact_qingniao_leads"
    )).mappings().first()

    if not result or result.total == 0:
        return jsonify({
            'has_data': False,
            'min_date': None,
            'max_date': None,
            'total': 0,
        })

    return jsonify({
        'has_data': True,
        'min_date': str(result.min_date) if result.min_date else None,
        'max_date': str(result.max_date) if result.max_date else None,
        'total': int(result.total),
    })
