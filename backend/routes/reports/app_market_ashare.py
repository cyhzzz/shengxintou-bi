# -*- coding: utf-8 -*-
"""应用市场 · A股成交金额（系统自主从东方财富获取，无需用户上传）

端点：POST /api/v1/reports/app-market/ashare-turnover
请求体：{ "filters": { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" } }
返回：按自然日的 A 股总成交金额（沪市「上证指数」成交额 + 深市「深证成指」成交额）。

设计要点：
  - 数据由后端自主从东方财富公开行情接口拉取，不依赖用户上传。
  - 按日期缓存到 USER_DATA_DIR/cache/ashare_turnover.json，仅在缺失对应日期时联网拉取，
    既降低对第三方接口的依赖，也支持离线展示历史数据。
  - 东方财富对过宽的日期区间会主动断连，因此按月分片拉取再合并；
    该接口在本环境网络偶发不稳定，故使用 requests.Session + Retry 适配器与多次退避重试，
    单次分片失败仅该片段为空，已成功的片段仍写入缓存（按日期降级）。
  - 东方财富仅返回交易日（周末/节假日无数据），非交易日交付 null，由前端折线自然断点。
"""
import json
import os
from datetime import datetime, timedelta

import requests
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

# requests.Session 复用连接 + 自动重试，规避东方财富偶发断连
_SESSION = requests.Session()
_SESSION.headers.update({'User-Agent': _UA, 'Referer': _REFERER})
_RETRY = requests.adapters.Retry(
    total=4, backoff_factor=0.6, status_forcelist=(502, 503, 504),
    allowed_methods=frozenset(['GET']),
)
_SESSION.mount('https://', requests.adapters.HTTPAdapter(max_retries=_RETRY))


def _http_get_json(url: str) -> dict:
    # 单次请求；网络层异常由调用方重试循环捕获
    with _SESSION.get(url, timeout=25) as resp:
        resp.raise_for_status()
        return resp.json()


def _fetch_one(secid: str, beg: str, end: str) -> dict:
    """拉取单个指数的日 K 线成交额，返回 {日期: 成交额(元)}。

    东方财富在本环境偶发断连（RemoteDisconnected），这里做多次退避重试；
    仍失败则返回空 dict，由调用方按日期降级到缓存。
    """
    url = (
        f'{EASTMONEY_BASE}?secid={secid}&fields1=f1,f2,f3'
        f'&fields2=f51,f57&klt=101&fqt=1&beg={beg}&end={end}'
    )
    last_err = None
    for attempt in range(4):
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
        except Exception as e:  # 偶发断连，退避后重试
            last_err = e
            if attempt < 3:
                import time
                time.sleep(0.6 * (attempt + 1))
            continue
    if last_err:
        print(f'[ashare-turnover] 东方财富拉取失败（{secid} {beg}-{end}）：{last_err}', flush=True)
    return {}


def _date_range(start_date: str, end_date: str):
    d = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    while d <= end:
        yield d.strftime('%Y-%m-%d')
        d += timedelta(days=1)


def _month_chunks(start_date: str, end_date: str):
    """把 [start, end] 切成按月的小段，规避东方财富对宽区间请求的断连限制。

    end 超过今天时截断到今天（未来日期无行情）。返回 (seg_start, seg_end) 迭代。
    """
    s = datetime.strptime(start_date, '%Y-%m-%d')
    e = datetime.strptime(end_date, '%Y-%m-%d')
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if e > today:
        e = today
    cur = s
    while cur <= e:
        # 当月最后一天
        nxt = cur.replace(day=28) + timedelta(days=4)
        month_end = nxt - timedelta(days=nxt.day)
        seg_end = min(month_end, e)
        yield cur.strftime('%Y-%m-%d'), seg_end.strftime('%Y-%m-%d')
        cur = seg_end + timedelta(days=1)


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
        # 东方财富对宽区间（如整年）会主动断连，必须按月分片拉取并合并；
        # 单段失败返回空 dict，已成功的片段仍写入缓存（按日期降级）。
        sh: dict = {}
        sz: dict = {}
        try:
            for cs, ce in _month_chunks(start_date, end_date):
                for market, code in _SECIDS:
                    sec = _fetch_one(f'{market}.{code}', cs.replace('-', ''), ce.replace('-', ''))
                    if code == '000001':
                        sh.update(sec)
                    else:
                        sz.update(sec)
        except Exception as e:  # 极少见：整段拉取异常，降级返回已缓存数据
            print(f'[ashare-turnover] EastMoney 拉取异常，降级使用缓存：{e}', flush=True)
        if sh or sz:
            for d in set(sh) | set(sz):
                cache[d] = round((sh.get(d, 0) + sz.get(d, 0)), 2)
            _save_cache(cache)
            fetched_new = True

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
