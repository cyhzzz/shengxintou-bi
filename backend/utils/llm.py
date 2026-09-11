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
from backend.utils import llm_evidence

log = logging.getLogger(__name__)

CONFIG_FILENAME = 'llm_config.json'
CACHE_DIRNAME = 'llm_analysis_cache'
DEFAULT_BASE_URL = 'https://api.openai.com/v1'
# v4.2.8：业务证据包入 prompt 后生成时长普遍超过 60s，默认超时 60 → 180（两端同步）
DEFAULT_TIMEOUT = 180
TREND_MONTHS = 4

SYSTEM_PROMPT = """你是一名券商投放运营团队的经营分析搭档。读者是一线投放与运营同学：请用大白话，先给结论再给证据，避免专业黑话；首次出现的指标（开口率、零互动占比、新开户率、户均资产等）顺带一句话解释。报告的重心是「下一步怎么投」，数据质量问题只作可信度提示，不要喧宾夺主。

你会收到两部分输入：
1. diagnosis：自动体检的异常信号清单（chain 链路 / level 级别 / title / detail / evidence / suggestion），以及最后一个月的 content_evidence（分平台当月 vs 前 3 月、逐日、旬级、月末恢复判定）。这部分主要回答「数据有没有问题、可信度如何」。
2. business：经营证据包（仅当月视角，当月 vs 前 3 月对比在包内部）。三个子包，任一为 null 表示该维度数据缺失，跳过对应解读、不要编造：
   - vendor：厂商经营（量子、绩牛等）。current=当月、prev3=前 3 月合计、platforms_current=当月平台拆分。注意该表是统一漏斗超集：leads/opened/valid/accounts 是内容平台值，app_downloads/app_activations 是应用市场值，同一厂商可能只占其中一类。派生指标：open_rate 开口率、lead_cost 线索成本、account_cost 开户成本、eff_account_cost 有效户成本。
   - note：小红书笔记分层。watch_top=当月开口线索最多的笔记（值得加投/模仿）；declining=前 3 月月均开口 ≥10 且当月跌破 30% 的衰退笔记（对应选题需要补充）；stop_candidates=累计消费 ≥1000 且企微加微 ≤2 的停投候选；content_types=按内容类型的聚合表现（选题方向参考）；new_notes=当月新发笔记。注意：笔记归属仅部分线索携带（主要为小红书链路）；snapshot 是累计快照无月度趋势，衰退判定基于转化侧月度开口。
   - appmarket：应用市场经营。stores=各商店（oppo/vivo/华为/小米/荣耀/鸿蒙/苹果）当月 vs 前 3 月漏斗（downloads 下载→activated 激活→registered 注册→funded 完资金账号→opened_accounts 开户成功→new_accounts 新开户→deposited 入金→eff_accounts 有效户）+ 资产/创收；placement_potential=当月新开户最多的商店×版位组合；placement_watchlist=下载 ≥30 但新开户率最低的组合（需关注）；plans_top=当月下载 TOP 计划。口径：仅互联网引流，新开户为漏斗末段。客群质量看 asset_per_new_account / revenue_per_new_account（户均资产/户均创收）。

经营解读规则：
- 厂商对比：钱花得值不值看「线索成本 / 开口率 / 有效户成本」当月 vs 前 3 月变化，别只看花费绝对值。
- 笔记建议：watch_top 给「值得继续投/放大」的理由，declining 给「选题正在衰退、需要补新内容」的具体方向（从标题归纳选题），stop_candidates 给停投理由。
- 应用市场：商店间比新开户率与客群质量，版位比效率，区分「量大的」和「质量好的」。

归因与置信度（涉及数据问题或经营判断的原因时）：
- 所有归因必须以「疑似」开头，置信度只允许 高 / 中 / 低 三档并引用具体数值。
- 数据侧形态参考：开口率下降且多平台零互动占比同步抬升 → 疑似上游回写缺失；单平台恶化且无零互动抬升 → 疑似素材或运营问题；证据矛盾 → 转入「需要人工核对」。

铁律：
- 引用任何数字必须来自输入数据，禁止编造或推算输入中不存在的数字。
- 内容合规：遵守证券行业宣传规范，不给投资建议，不承诺收益。
- 行动建议面向投放运营（预算分配、素材与选题、渠道与版位取舍、跟单核对），按优先级排序，注明对应月份与数据依据。

输出使用 Markdown，固定包含以下章节（按顺序）：
## 总体判断
第一句大白话给本月最重要的经营结论（谁做得好、哪里该动），再用一句话说明数据可信度（体检有无 error/warn、是否影响结论）。
## 内容平台经营解读
### 厂商对比
哪家厂商（量子/绩牛等）当月表现好/差：线索成本、开口率、有效户成本的变化，钱花得值不值。
### 笔记表现与选题
值得关注的笔记（watch_top）、衰退笔记与选题补充方向（declining）、停投候选（stop_candidates）、内容类型选题参考（content_types）。
## 应用市场经营解读
### 渠道（商店）对比
各商店当月 vs 前 3 月：下载量、新开户率、客群质量（户均资产/创收），哪家强、哪家弱。
### 版位与计划
有潜力的版位组合（placement_potential）、需关注的低效组合（placement_watchlist）、下载 TOP 计划（plans_top）。
## 跨月趋势对比
逐链路对比最近三个月走势，指出拐点月份与对应信号。
## 需要人工核对的事项
数据质量问题与无法从数据确认的疑问（上游回写、平台口径、抽样核对）集中在此。
## 行动建议
按优先级列 4-6 条，聚焦投放动作（预算、素材/选题、渠道/版位取舍），注明对应月份与数据依据。"""

# prompt 结构性变更时递增；缓存命中需校验，避免旧缓存掩盖新 prompt 效果
PROMPT_VERSION = 4


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


def stream_chat(cfg, messages):
    """流式调用 OpenAI 协议 /chat/completions（SSE），生成器逐步 yield 增量文本。

    - v4.2.8：供 /reports/llm-analysis/stream 端点使用，前端边生成边渲染。
    - 读超时 = timeout_seconds，作用于相邻 chunk 之间（每个 chunk 重置计时），
      流式响应长生成不会被总时长误杀。
    - 网络错误 / 非 200 / 流中断统一抛 LlmRequestError（与 call_chat 口径一致）。
    """
    timeout = cfg.get('timeout_seconds') or DEFAULT_TIMEOUT
    url = cfg['base_url'].rstrip('/') + '/chat/completions'
    payload = {'model': cfg['model'], 'messages': messages, 'temperature': 0.3, 'stream': True}
    headers = {'Authorization': 'Bearer ' + str(cfg.get('api_key') or ''), 'Content-Type': 'application/json'}
    try:
        resp = requests.post(url, json=payload, headers=headers, stream=True, timeout=(10, timeout))
    except requests.RequestException:
        log.warning('LLM 流式请求失败: base_url=%s model=%s（网络错误或超时）', cfg.get('base_url'), cfg.get('model'))
        raise LlmRequestError('LLM 请求失败：网络错误或超时，请检查 base_url / api_key / 超时配置')
    try:
        if resp.status_code != 200:
            raise LlmRequestError('LLM 返回异常状态 %s，请检查模型名称与 api_key' % resp.status_code)
        for raw_line in resp.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            line = raw_line.strip()
            if not line.startswith('data:'):
                continue  # 忽略 event:/注释/心跳行
            data_text = line[5:].strip()
            if data_text == '[DONE]':
                break
            try:
                chunk = json.loads(data_text)
            except ValueError:
                continue
            try:
                delta = chunk['choices'][0]['delta'].get('content') or ''
            except (KeyError, IndexError, TypeError, AttributeError):
                continue
            if delta:
                yield delta
    except requests.RequestException:
        raise LlmRequestError('LLM 流式响应中断：网络错误或超时')
    finally:
        resp.close()


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


def build_user_prompt(results, business=None):
    return json.dumps({'diagnosis': _slim_results(results), 'business': business}, ensure_ascii=False)


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


def prepare_analysis(month=None, force=False):
    """流式/非流式共用的前置阶段：配置校验 → 跨月取数 → 证据包 → 缓存判定。

    返回 (prep, None) 或 (None, (code, message))；prep 为 dict：
    {cfg, target, months_used, business, signals_hash, user_prompt, model, cached}
    （cached 命中时为缓存条目 dict，force 或未命中时为 None）
    """
    cfg = load_config()
    if not cfg or not cfg.get('api_key'):
        return None, ('LLM_NOT_CONFIGURED', '尚未配置 LLM，请先在「AI 分析报告」页点击「LLM 配置」完成设置')
    target, results = collect_trend_data(month)
    if not results:
        return None, ('INVALID_PARAMETER', '目标月及前 3 个月均无诊断数据，无法生成分析')
    months_used = [r['month'] for r in results]
    business = llm_evidence.build_business_evidence(target)
    user_prompt = build_user_prompt(results, business)
    # 缓存键覆盖整个 user prompt：诊断信号或业务证据任一变化均触发失效
    signals_hash = hashlib.sha1(user_prompt.encode('utf-8')).hexdigest()
    model = cfg.get('model', '')
    cached = None if force else load_cache(target, signals_hash, model)
    return {
        'cfg': cfg,
        'target': target,
        'months_used': months_used,
        'business': business,
        'signals_hash': signals_hash,
        'user_prompt': user_prompt,
        'model': model,
        'cached': cached,
    }, None


def run_analysis(month=None, force=False):
    """智能分析主入口：跨月取数 → 缓存 → LLM；返回 (data, (code, message) | None)"""
    prep, error = prepare_analysis(month, force)
    if error:
        return None, error
    if prep['cached']:
        return {
            'content': prep['cached']['content'],
            'months_used': prep['months_used'],
            'model': prep['model'],
            'generated_at': prep['cached'].get('generated_at', ''),
            'cached': True,
            'evidence': prep['business'],
        }, None
    try:
        content, _ = call_chat(prep['cfg'], [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': prep['user_prompt']},
        ])
    except LlmRequestError as e:
        return None, ('LLM_REQUEST_FAILED', str(e))
    save_cache(prep['target'], prep['signals_hash'], prep['model'], content)
    return {
        'content': content,
        'months_used': prep['months_used'],
        'model': prep['model'],
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'cached': False,
        'evidence': prep['business'],
    }, None
