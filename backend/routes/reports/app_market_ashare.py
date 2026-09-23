# -*- coding: utf-8 -*-
"""应用市场 · A股成交金额（系统自主从东方财富获取，无需用户上传）

端点：POST /api/v1/reports/app-market/ashare-turnover
请求体：{ "filters": { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" } }
返回：按自然日的 A 股总成交金额（沪市「上证指数」成交额 + 深市「深证成指」成交额）。

设计要点：
  - 数据由后端自主从东方财富公开行情接口拉取，不依赖用户上传。
  - 按日期缓存到 USER_DATA_DIR/cache/ashare_turnover.json，仅在缺失对应日期时联网拉取，
    既降低对第三方接口的依赖，也支持离线展示历史数据。
  - 东方财富仅返回交易日（周末/节假日无数据），非交易日交付 null，由前端折线自然断点。
"""
import json
import os
import urllib.request
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

from config import USER_DATA_DIR
from backend.utils.decorators import handle_exceptions

bp = Blueprint('app_market_ashare', __name__, url_prefix='/api/v1/reports/app-market')

CACHE_FILE = os.path.join(USER_DATA_DIR, 'cache', 'ashare_turnover.json')
EASTMONEY_BASE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
# (市场代码, 指数代码)：上证指数 / 深证成指
_SECIDS = [('1', '000001'), ('0', '399001')]
_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
_REFERER = 'https://quote.eastmoney.com/'


def _http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={'User-Agent': _UA, 'Referer': _REFERER})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))


def _fetch_one(secid: str, beg: str, end: str) -> dict:
    """拉取单个指数的日 K 线成交额，返回 {日期: 成交额(元)}。东方财富偶发断连，失败重试 2 次。"""
    url = (
        f'{EASTMONEY_BASE}?secid={secid}&fields1=f1,f2,f3'
        f'&fields2=f51,f57&klt=101&fqt=1&beg={beg}&end={end}'
    )
    last_err = None
    for _ in range(2):
        try:
            data = _http_get_json(url) or {}
            klines = (data.get('data') or {}).get('klines') or []
            out: dict = {}
            for k in klines:
                parts = str(k).split(',')
                if len(parts) >= 2:
                    try:
                        out[parts[0]] = float(parts[1])
                    except ValueError:
                        pass
            return out
        except Exception as e:  # 偶发断连，重试
            last_err = e
            continue
    if last_err:
        raise last_err
    return {}


def _date_range(start_date: str, end_date: str):
    d = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    while d <= end:
        yield d.strftime('%Y-%m-%d')
        d += timedelta(days=1)


def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False)


@bp.route('/ashare-turnover', methods=['POST'])
@handle_exceptions
def ashare_turnover():
    """返回指定日期区间的 A 股每日总成交金额（沪+深）。"""
    payload = request.get_json(silent=True) or {}
    filters = payload.get('filters') or {}
    start_date = filters.get('start_date') or (payload.get('start_date'))
    end_date = filters.get('end_date') or (payload.get('end_date'))
    if not start_date or not end_date:
        return jsonify({'success': False, 'message': '缺少 start_date / end_date'}), 400

    cache = _load_cache()
    dates = list(_date_range(start_date, end_date))
    # 仅当区间内存在缺失日期时才联网拉取，避免重复请求
    need_fetch = any(d not in cache for d in dates)

    fetched_new = False
    if need_fetch:
        try:
            sh: dict = {}
            sz: dict = {}
            for market, code in _SECIDS:
                data = _fetch_one(f'{market}.{code}', start_date.replace('-', ''), end_date.replace('-', ''))
                if code == '000001':
                    sh = data
                else:
                    sz = data
            for d in set(sh) | set(sz):
                cache[d] = round((sh.get(d, 0) + sz.get(d, 0)), 2)
            _save_cache(cache)
            fetched_new = True
        except Exception as e:  # 网络异常：降级返回已缓存数据
            print(f'[ashare-turnover] EastMoney 拉取失败，降级使用缓存：{e}', flush=True)

    turnover = []
    for d in dates:
        amount = cache.get(d)
        turnover.append({'date': d, 'amount': amount})  # 非交易日 amount=None → 折线断点

    return jsonify({
        'success': True,
        'data': {
            'turnover': turnover,
            'source': '东方财富（上证指数 + 深证成指 成交额，系统自主获取）',
            'cached_dates': len(cache),
            'fetched_new': fetched_new,
            'updated_at': datetime.now().isoformat(timespec='seconds'),
            'note': 'A股成交金额由系统自主从东方财富公开行情接口按自然日拉取并缓存，无需手动上传；'
                    '非交易日（周末/节假日）无成交，折线自动断点。',
        },
    })
