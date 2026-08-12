# -*- coding: utf-8 -*-
"""应用市场 · 归因转化率分析（v3.7.3）

数据源：归因明细 Excel 文件（C:\\省心投-元昊手搓\\归因明细\\）
每行记录一个设备号 OAID 的开户进展。

按周（周一~周日）聚合各步骤转化率：
  激活 → 开户注册 → 身份证 → 银行卡 → 提交开户 → 开户成功

返回：
  1. daily_data — 每日各步骤计数 + 步骤间转化率
  2. weekly_data — 每周各步骤计数 + 步骤间转化率
"""
import os
import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from backend.utils.decorators import handle_exceptions

bp = Blueprint('app_market_attribution', __name__, url_prefix='/api/v1/reports/app-market')

# 归因明细 Excel 文件目录（可通过环境变量覆盖）
ATTRIBUTION_DIR = os.environ.get(
    'ATTRIBUTION_DIR',
    r'C:\省心投-元昊手搓\归因明细'
)

APP_MARKET_PLATFORMS = ['华为', '小米', '荣耀', 'oppo', 'vivo', '苹果']

_META = {
    'version': 'v3.7.3',
    'source': '归因明细 Excel',
    'note': '各应用市场每设备号OAID开户进展，按周(周一~周日)聚合各步骤转化率',
}

# ---------------------------------------------------------------------------
# 内存缓存：避免每次请求都重读 Excel（~20 万行）
# ---------------------------------------------------------------------------
_cache = {
    'df': None,          # pandas DataFrame
    'mtime': 0,          # 上次读取时文件的最大修改时间戳
    'loaded_at': 0,      # 加载时刻
}


def _get_files():
    """返回目录下所有 .xlsx 文件（排除临时文件）"""
    if not os.path.isdir(ATTRIBUTION_DIR):
        return []
    return [
        os.path.join(ATTRIBUTION_DIR, f)
        for f in os.listdir(ATTRIBUTION_DIR)
        if f.endswith('.xlsx') and not f.startswith('~')
    ]


def _latest_mtime(files):
    return max(os.path.getmtime(f) for f in files) if files else 0


def _load_data():
    """加载 Excel 数据，带文件修改时间缓存"""
    import pandas as pd

    files = _get_files()
    if not files:
        return None

    mtime = _latest_mtime(files)
    if _cache['df'] is not None and mtime == _cache['mtime']:
        return _cache['df']

    dfs = []
    for f in files:
        try:
            df = pd.read_excel(f, engine='openpyxl')
            dfs.append(df)
        except Exception:
            pass

    if not dfs:
        return None

    df = pd.concat(dfs, ignore_index=True)
    # 清洗列名
    df.columns = df.columns.str.strip()

    # 清洗"是否"列（有些值带前导空格，如 ' 否'）
    bool_cols = [
        '是否激活APP', '是否开户注册', '是否注册身份证',
        '是否注册银行卡', '是否提交开户', '是否开户成功',
    ]
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # 转换下载日期
    df['下载日期'] = pd.to_datetime(df['下载日期'], errors='coerce')
    df = df.dropna(subset=['下载日期'])

    # 缓存
    _cache['df'] = df
    _cache['mtime'] = mtime
    _cache['loaded_at'] = time.time()

    return df


def _week_start(d):
    """返回日期 d 所在周的周一日期"""
    return d - timedelta(days=d.weekday())


def _week_end(d):
    """返回日期 d 所在周的周日日期"""
    return d + timedelta(days=6 - d.weekday())


WEEKDAY_MAP = {0: '周一', 1: '周二', 2: '周三', 3: '周四', 4: '周五', 5: '周六', 6: '周日'}


def _aggregate(df, platform=None, start_date=None, end_date=None):
    """按日期+平台聚合各步骤计数，并计算转化率"""
    import pandas as pd

    # 过滤平台
    if platform and platform != '全部':
        df = df[df['应用市场'] == platform]

    # 过滤日期
    if start_date:
        df = df[df['下载日期'] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df['下载日期'] <= pd.to_datetime(end_date)]

    if df.empty:
        return [], []

    bool_cols = [
        '是否激活APP', '是否开户注册', '是否注册身份证',
        '是否注册银行卡', '是否提交开户', '是否开户成功',
    ]
    col_map = {
        '是否激活APP': '激活',
        '是否开户注册': '开户注册',
        '是否注册身份证': '身份证',
        '是否注册银行卡': '银行卡',
        '是否提交开户': '提交开户',
        '是否开户成功': '开户成功',
    }

    # 按日期聚合（"全部"平台时合并所有平台）
    df['_date'] = df['下载日期'].dt.date
    daily = df.groupby('_date').apply(lambda g: pd.Series({
        col_map[col]: (g[col] == '是').sum() for col in bool_cols if col in g.columns
    })).reset_index()

    daily = daily.sort_values('_date')

    # 添加星期和周开始
    daily['星期'] = daily['_date'].apply(lambda d: WEEKDAY_MAP[d.weekday()])
    daily['周开始'] = daily['_date'].apply(lambda d: _week_start(d))

    # 计算转化率
    def _rate(numerator, denominator):
        if denominator == 0:
            return 0.0
        return round(numerator / denominator, 4)

    daily_records = []
    for _, row in daily.iterrows():
        activate = int(row['激活'])
        register = int(row['开户注册'])
        id_card = int(row['身份证'])
        bank_card = int(row['银行卡'])
        submit = int(row['提交开户'])
        success = int(row['开户成功'])

        daily_records.append({
            'date': row['_date'].isoformat(),
            'weekday': row['星期'],
            'week_start': row['周开始'].isoformat(),
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

    # 周聚合
    df['_week_start'] = df['下载日期'].apply(lambda d: _week_start(d))
    weekly = df.groupby('_week_start').apply(
        lambda g: pd.Series({
            col_map[col]: (g[col] == '是').sum() for col in bool_cols if col in g.columns
        })
    ).reset_index()
    weekly = weekly.rename(columns={'_week_start': '周开始'})

    weekly = weekly.sort_values('周开始')

    weekly_records = []
    for _, row in weekly.iterrows():
        ws = row['周开始']
        activate = int(row['激活'])
        register = int(row['开户注册'])
        id_card = int(row['身份证'])
        bank_card = int(row['银行卡'])
        submit = int(row['提交开户'])
        success = int(row['开户成功'])

        weekly_records.append({
            'week_start': ws.strftime('%Y-%m-%d') if hasattr(ws, 'strftime') else str(ws),
            'week_end': _week_end(ws).strftime('%Y-%m-%d') if hasattr(ws, 'strftime') else str(_week_end(ws)),
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

    df = _load_data()
    if df is None:
        return jsonify({
            'success': False,
            'error': f'未找到归因明细 Excel 文件，请检查目录: {ATTRIBUTION_DIR}',
            'data': {'daily_data': [], 'weekly_data': [], 'platforms': APP_MARKET_PLATFORMS},
            'meta': _META,
        })

    # 获取数据中实际存在的平台列表
    available_platforms = sorted(df['应用市场'].dropna().unique().tolist())

    daily_data, weekly_data = _aggregate(df, platform, start_date, end_date)

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
