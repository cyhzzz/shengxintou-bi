# -*- coding: utf-8 -*-
"""LLM 智能分析支撑层（OpenAI 协议）

- 配置读写：USER_DATA_DIR/llm_config.json（本机文件，不入库、不分发）；
  api_key 只落盘并用于上游调用，禁止写入日志或经 GET 明文回传。
- 跨月取数：目标月 + 前 3 个月各跑一次 run_diagnosis，无信号月份剔除。
- prompt 组装：system = 领域框架 + 合规约束 + 固定输出结构（强制含「跨月趋势对比」章节）；
  user = 各月诊断结果 JSON。
- 结果缓存：USER_DATA_DIR/llm_analysis_cache/{month}.json，
  命中键 = 信号内容 sha256 + model，信号变化或换模型自动失效；force 跳过读缓存。
- 上游调用：POST {base_url}/chat/completions，网络/状态码/解析失败抛 LlmRequestError。
"""
import hashlib
import json
import logging
import os
import time
from datetime import datetime

import requests

import config
from backend.utils.diagnosis import run_diagnosis
from backend.utils.diagnosis.engine import MONTH_RE, shift_month

log = logging.getLogger(__name__)

CONFIG_FILENAME = 'llm_config.json'
CACHE_DIRNAME = 'llm_analysis_cache'
DEFAULT_BASE_URL = 'https://api.openai.com/v1'
DEFAULT_TIMEOUT = 60
TREND_MONTHS = 4

SYSTEM_PROMPT = """你是一名给券商投放运营同学写数据体检解读的资深同事。你的读者不是数据分析师：请用大白话，先给结论，再给证据，避免专业黑话；必须出现的指标名（开口率、零互动占比、有效线索率）要顺带用一句话解释。

你会收到两部分输入：
1. items：自动体检规则产出的异常清单，每条含 chain（链路）、level（warn/error）、title（标题）、detail（详情）、evidence（数值证据）、suggestion（建议）。
2. content_evidence（仅最后一个月提供）：内容平台证据包，键含义——
   - platform_monthly：分平台「当月 vs 前 3 月基线」对比（leads 线索数、open_rate 当月开口率、prev3_open_rate 前 3 月开口率、zero_interaction_rate 当月零互动占比、prev3_zero_interaction_rate 前 3 月零互动占比）；
   - daily：分平台逐日线索数与开口率；
   - xun：平台 × 旬（上旬 1-10 日 / 中旬 11-20 日 / 下旬 21-月末）走势；
   - recovery：目标月最后 5 个有数据自然日的开口率是否恢复到前 3 月基线的八成（recovered=true 表示已恢复）。
   「零互动」指线索的互动次数为空或 0：通常是上游平台没有把互动数据回写回来，不一定是真的没人互动。

归因判断规则（引擎只提供数据，结论由你给出，必须加「疑似」二字）：
1. 疑似上游数据回写缺失：开口率下降的同时，两个及以上平台的零互动占比同步明显抬升，且恢复判定 recovered=true（月末数据快速恢复）；这种形态更像数据回写问题，而非业务真的变差。
2. 疑似素材或运营问题：只有单个平台恶化、零互动占比没有同步抬升、且月末持续无恢复。
3. 证据互相矛盾或不足：不要强行下结论，把疑问写进「需要人工核对的事项」。

置信度只允许三档：高 / 中 / 低，每处归因必须说明主要依据（引用具体数值）。

铁律：
- 所有归因结论必须以「疑似」开头，不得写成确定性事实。
- 引用任何数字必须来自输入数据，禁止编造或推算输入中不存在的数字。
- 内容合规：遵守证券行业宣传规范，不给投资建议，不承诺收益。
- 行动建议面向投放运营同学（素材、投放、跟单核对），按优先级排序，注明对应月份与信号。

输出使用 Markdown，固定包含以下章节（按顺序）：
## 总体判断
第一句用大白话给出本月最重要的一个结论（例：「8 月内容平台开口率下降，大概率是数据回写问题，不是开户真的变差」），再展开 2-3 句。
## 分链路解读（内容平台 / 应用市场）
每个链路三段式：一句白话判断 → 最多 2 条数值证据 → 归因方向与置信度。
## 跨月趋势对比
逐链路对比最近三个月走势，指出拐点月份与对应信号。
## 需要人工核对的事项
列出无法从数据确认、需要人工核对的疑问（如上游 ETL 回写、平台口径变化）。
## 行动建议
按优先级列出 3-5 条，注明对应月份与信号，落实到投放运营可执行的动作。"""

# v4.2.0: prompt 结构性变更时递增；缓存命中需校验，避免旧缓存掩盖新 prompt 效果
PROMPT_VERSION = 3


class LlmRequestError(Exception):
    """LLM 上游调用失败（网络/状态码/响应解析）"""


def _config_path():
    return os.path.join(config.USER_DATA_DIR, CONFIG_FILENAME)


def _cache_dir():
    return os.path.join(config.USER_DATA_DIR, CACHE_DIRNAME)


def load_config():
    """读取配置；文件缺失或损坏返回 None"""
    try:
        with open(_config_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def save_config(payload):
    """校验并保存配置；api_key / model / timeout 留空表示沿用已存值"""
    stored = load_config() or {}
    base_url = str(payload.get('base_url') or stored.get('base_url') or DEFAULT_BASE_URL).strip().rstrip('/')
    if not base_url.startswith(('http://', 'https://')):
        raise ValueError('base_url 必须以 http:// 或 https:// 开头')
    api_key = str(payload.get('api_key') or '').strip() or str(stored.get('api_key') or '')
    model = str(payload.get('model') or stored.get('model') or '').strip()
    raw_timeout = payload.get('timeout_seconds') or stored.get('timeout_seconds') or DEFAULT_TIMEOUT
    try:
        timeout = int(raw_timeout)
    except (TypeError, ValueError):
        raise ValueError('timeout_seconds 必须为整数')
    if not api_key:
        raise ValueError('api_key 不能为空')
    if not model:
        raise ValueError('model 不能为空')
    if timeout < 5 or timeout > 600:
        raise ValueError('timeout_seconds 需在 5~600 之间')
    data = {
        'base_url': base_url,
        'api_key': api_key,
        'model': model,
        'timeout_seconds': timeout,
        'updated_at': datetime.now().isoformat(timespec='seconds'),
    }
    os.makedirs(config.USER_DATA_DIR, exist_ok=True)
    with open(_config_path(), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def mask_key(api_key):
    if not api_key:
        return ''
    if len(api_key) <= 8:
        return '***'
    return api_key[:3] + '***' + api_key[-4:]


def config_view():
    cfg = load_config()
    if not cfg or not cfg.get('api_key'):
        return {
            'configured': False,
            'base_url': DEFAULT_BASE_URL,
            'api_key_masked': '',
            'model': '',
            'timeout_seconds': DEFAULT_TIMEOUT,
        }
    return {
        'configured': True,
        'base_url': cfg.get('base_url', DEFAULT_BASE_URL),
        'api_key_masked': mask_key(cfg.get('api_key', '')),
        'model': cfg.get('model', ''),
        'timeout_seconds': cfg.get('timeout_seconds', DEFAULT_TIMEOUT),
    }


def resolve_config(payload=None):
    """合并请求体与已存配置（用于保存前测试连接）"""
    stored = load_config() or {}
    body = payload or {}
    raw_timeout = body.get('timeout_seconds') or stored.get('timeout_seconds') or DEFAULT_TIMEOUT
    try:
        timeout = int(raw_timeout)
    except (TypeError, ValueError):
        timeout = DEFAULT_TIMEOUT
    return {
        'base_url': str(body.get('base_url') or stored.get('base_url') or DEFAULT_BASE_URL).strip().rstrip('/'),
        'api_key': str(body.get('api_key') or '').strip() or str(stored.get('api_key') or ''),
        'model': str(body.get('model') or stored.get('model') or '').strip(),
        'timeout_seconds': timeout,
    }


def call_chat(cfg, messages, max_tokens=None, allow_empty_content=False):
    """调用 OpenAI 协议 /chat/completions，返回 (content, latency_ms)"""
    timeout = cfg.get('timeout_seconds') or DEFAULT_TIMEOUT
    url = cfg['base_url'].rstrip('/') + '/chat/completions'
    payload = {'model': cfg['model'], 'messages': messages, 'temperature': 0.3}
    if max_tokens:
        payload['max_tokens'] = max_tokens
    headers = {'Authorization': 'Bearer ' + str(cfg.get('api_key') or ''), 'Content-Type': 'application/json'}
    started = time.time()
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException:
        log.warning('LLM 请求失败: base_url=%s model=%s（网络错误或超时）', cfg.get('base_url'), cfg.get('model'))
        raise LlmRequestError('LLM 请求失败：网络错误或超时，请检查 base_url / api_key / 超时配置')
    if resp.status_code != 200:
        raise LlmRequestError('LLM 返回异常状态 %s，请检查模型名称与 api_key' % resp.status_code)
    try:
        content = resp.json()['choices'][0]['message']['content']
    except (ValueError, KeyError, IndexError, TypeError):
        raise LlmRequestError('LLM 响应格式无法解析')
    # v4.2.0: 思考型模型（如 GLM 系列）在 max_tokens 极小时 content 可能为空，
    # 连通性测试允许空（200 + 结构合法即视为连通）；正式分析仍严格要求非空
    if not content and not allow_empty_content:
        raise LlmRequestError('LLM 返回内容为空')
    return content or '', int((time.time() - started) * 1000)


EVIDENCE_MONTHLY_LIMIT = 12
EVIDENCE_DAILY_LIMIT = 200
EVIDENCE_XUN_LIMIT = 200


def _slim_evidence(evidence):
    """证据包瘦身：截断大数组防止 payload 爆炸；非 dict 返回 None"""
    if not isinstance(evidence, dict):
        return None
    slim = dict(evidence)
    slim['platform_monthly'] = (evidence.get('platform_monthly') or [])[:EVIDENCE_MONTHLY_LIMIT]
    slim['daily'] = (evidence.get('daily') or [])[:EVIDENCE_DAILY_LIMIT]
    slim['xun'] = (evidence.get('xun') or [])[:EVIDENCE_XUN_LIMIT]
    return slim


def _slim_result(result, include_evidence=False):
    keys = ('id', 'chain', 'level', 'title', 'detail', 'evidence', 'suggestion')
    slim = {
        'month': result.get('month'),
        'snapshot_dates': result.get('snapshot_dates'),
        'summary': result.get('summary'),
        'items': [
            {key: item.get(key) for key in keys}
            for item in (result.get('items') or [])
        ],
    }
    if include_evidence and result.get('content_evidence') is not None:
        slim['content_evidence'] = _slim_evidence(result['content_evidence'])
    return slim


def _slim_results(results):
    """仅最后一个月携带证据（证据为当月视角，历史月证据不进 payload）"""
    return [
        _slim_result(result, include_evidence=(index == len(results) - 1))
        for index, result in enumerate(results)
    ]


def collect_trend_data(month=None):
    """返回 (target_month, results)；results 仅保留有信号 items 的月份（时间升序）"""
    if month is None:
        base = run_diagnosis(None).get('month')
        if not base:
            return '', []
    else:
        if not isinstance(month, str) or not MONTH_RE.match(month):
            raise ValueError('month 参数格式必须为 YYYY-MM')
        base = month
    results = []
    for delta in range(-(TREND_MONTHS - 1), 1):
        result = run_diagnosis(shift_month(base, delta))
        if result.get('items'):
            results.append(result)
    return base, results


def _signals_hash(results):
    return hashlib.sha1(
        json.dumps(_slim_results(results), ensure_ascii=False, sort_keys=True).encode('utf-8')
    ).hexdigest()


def build_user_prompt(results):
    return json.dumps(_slim_results(results), ensure_ascii=False)


def _cache_path(month):
    return os.path.join(_cache_dir(), '%s.json' % month)


def load_cache(month, signals_hash, model):
    try:
        with open(_cache_path(month), 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or not data.get('content'):
        return None
    # v4.2.0: prompt 结构性变更后旧缓存视为失效（旧文件无 prompt_version 字段）
    if data.get('prompt_version') != PROMPT_VERSION:
        return None
    if data.get('signals_hash') != signals_hash or data.get('model') != model:
        return None
    return data


def save_cache(month, signals_hash, model, content):
    try:
        os.makedirs(_cache_dir(), exist_ok=True)
        data = {
            'month': month,
            'signals_hash': signals_hash,
            'model': model,
            'prompt_version': PROMPT_VERSION,
            'content': content,
            'generated_at': datetime.now().isoformat(timespec='seconds'),
        }
        with open(_cache_path(month), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        log.warning('保存 LLM 分析缓存失败: %s', e)


def run_analysis(month=None, force=False):
    """智能分析主入口：跨月取数 → 缓存 → LLM；返回 (data, (code, message) | None)"""
    cfg = load_config()
    if not cfg or not cfg.get('api_key'):
        return None, ('LLM_NOT_CONFIGURED', '尚未配置 LLM，请先在「AI 分析报告」页点击「LLM 配置」完成设置')
    target, results = collect_trend_data(month)
    if not results:
        return None, ('INVALID_PARAMETER', '目标月及前 3 个月均无诊断数据，无法生成分析')
    months_used = [r['month'] for r in results]
    signals_hash = _signals_hash(results)
    model = cfg.get('model', '')
    if not force:
        cached = load_cache(target, signals_hash, model)
        if cached:
            return {
                'content': cached['content'],
                'months_used': months_used,
                'model': model,
                'generated_at': cached.get('generated_at', ''),
                'cached': True,
            }, None
    try:
        content, _ = call_chat(cfg, [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': build_user_prompt(results)},
        ])
    except LlmRequestError as e:
        return None, ('LLM_REQUEST_FAILED', str(e))
    save_cache(target, signals_hash, model, content)
    return {
        'content': content,
        'months_used': months_used,
        'model': model,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'cached': False,
    }, None
