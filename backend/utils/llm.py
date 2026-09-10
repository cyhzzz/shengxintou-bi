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

SYSTEM_PROMPT = (
    '你是一名券商财富管理场景下的广告投放与开户转化分析专家。'
    '用户提供的是「省心投 BI」智能诊断规则引擎对连续几个月投放数据的体检结果（JSON）：'
    '信号分三类链路——内容平台（xhs，线索→客户开口→有效线索→开户）、'
    '应用市场（appmarket，互联网引流：下载→激活→注册→完资金账号→新开户）、'
    '全局健康度（global）；每条信号含分级（error/warn/info）、标题、明细、数据证据与修复建议。\n'
    '分析要求：\n'
    '1. 严格基于给定 JSON 推理，不得编造数据；引用结论时必须附带具体数值证据。\n'
    '2. 遵循「量级 × 成本 × 质量」诊断框架，区分内容平台与应用市场（互联网引流）双链路，不混算。\n'
    '3. 遵守证券投顾合规约束：不得输出向不特定公众推荐具体证券、承诺收益等违规表述；'
    '建议聚焦投放运营动作（素材、计划、出价、落地页、时段、承接链路等）。\n'
    '4. 必须包含「跨月趋势对比」章节：逐链路对比各月关键指标与信号分级变化，'
    '明确指出持续恶化、持续改善或新出现的趋势。\n'
    '5. 用简体中文输出 Markdown，章节结构固定为：\n'
    '## 总体判断\n## 跨月趋势对比\n## 分链路解读（内容平台 / 应用市场）\n## 关键风险信号\n## 行动建议\n'
    '其中「行动建议」按优先级排序，每条注明针对的月份与对应信号。'
)

# v4.2.0: prompt 结构性变更时递增；缓存命中需校验，避免旧缓存掩盖新 prompt 效果
PROMPT_VERSION = 2


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


def _slim_result(result):
    keys = ('id', 'chain', 'level', 'title', 'detail', 'evidence', 'suggestion')
    return {
        'month': result.get('month'),
        'snapshot_dates': result.get('snapshot_dates'),
        'summary': result.get('summary'),
        'items': [{k: item.get(k) for k in keys} for item in result.get('items', [])],
    }


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
    payload = json.dumps([_slim_result(r) for r in results], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def build_user_prompt(results):
    return json.dumps([_slim_result(r) for r in results], ensure_ascii=False, indent=2)


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
        return None, ('LLM_NOT_CONFIGURED', '尚未配置 LLM，请先在「智能分析」页点击「LLM 配置」完成设置')
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
