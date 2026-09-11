# -*- coding: utf-8 -*-
"""LLM 智能分析 API（POST，手动触发）

- POST /api/v1/reports/llm-analysis {month?, force?}
    对目标月 + 前 3 个月分别跑智能诊断，用内置 prompt 交给配置好的 LLM
    生成含「跨月趋势对比」章节的 Markdown 分析；结果按（信号哈希 + 模型）缓存。
- POST /api/v1/reports/llm-analysis/stream {month?, force?}（v4.2.8）
    同口径流式版：SSE 事件流 meta（取数完成，含证据包）→ delta*（增量文本）→ done；
    生成前失败返回 JSON（与非流式一致）；生成中失败发 error 事件；完成后写同一份缓存。

错误约定：未配置 LLM → 400 LLM_NOT_CONFIGURED；
month 非法 / 无数据 → 400 INVALID_PARAMETER；上游失败 → 502 LLM_REQUEST_FAILED（流式中为 error 事件）。
"""
import json
from datetime import datetime

from flask import Blueprint, Response, jsonify, request, stream_with_context

from backend.utils.decorators import handle_exceptions
from backend.utils import llm

bp = Blueprint('llm_analysis_report', __name__, url_prefix='/api/v1/reports')


@bp.route('/llm-analysis', methods=['POST'])
@handle_exceptions
def run_llm_analysis():
    """跨月诊断信号 + 内置 prompt → LLM 生成 Markdown 分析"""
    payload = request.get_json(silent=True) or {}
    data, error = llm.run_analysis(payload.get('month') or None, force=bool(payload.get('force')))
    if error:
        code, message = error
        status = 502 if code == 'LLM_REQUEST_FAILED' else 400
        return jsonify({'success': False, 'error': code, 'message': message}), status
    return jsonify({'success': True, 'data': data})


@bp.route('/llm-analysis/stream', methods=['POST'])
@handle_exceptions
def run_llm_analysis_stream():
    """流式版：SSE meta → delta* → done；取数/校验失败返回 JSON 错误（与非流式一致）"""
    payload = request.get_json(silent=True) or {}
    prep, error = llm.prepare_analysis(payload.get('month') or None, force=bool(payload.get('force')))
    if error:
        code, message = error
        status = 502 if code == 'LLM_REQUEST_FAILED' else 400
        return jsonify({'success': False, 'error': code, 'message': message}), status

    def sse(event, data):
        return 'event: %s\ndata: %s\n\n' % (event, json.dumps(data, ensure_ascii=False))

    def generate():
        if prep['cached']:
            # 缓存命中：meta + 整段 delta + done，前端秒回渲染
            yield sse('meta', {
                'months_used': prep['months_used'],
                'model': prep['model'],
                'cached': True,
                'evidence': prep['business'],
            })
            yield sse('delta', {'text': prep['cached']['content']})
            yield sse('done', {'generated_at': prep['cached'].get('generated_at', '')})
            return
        # meta 先行：证据包随事件下发，前端在 LLM 生成期间即可核验证据卡
        yield sse('meta', {
            'months_used': prep['months_used'],
            'model': prep['model'],
            'cached': False,
            'evidence': prep['business'],
        })
        parts = []
        try:
            for delta in llm.stream_chat(prep['cfg'], [
                {'role': 'system', 'content': llm.SYSTEM_PROMPT},
                {'role': 'user', 'content': prep['user_prompt']},
            ]):
                parts.append(delta)
                yield sse('delta', {'text': delta})
        except llm.LlmRequestError as e:
            yield sse('error', {'message': str(e)})
            return
        content = ''.join(parts)
        if not content:
            yield sse('error', {'message': 'LLM 返回内容为空'})
            return
        llm.save_cache(prep['target'], prep['signals_hash'], prep['model'], content)
        yield sse('done', {'generated_at': datetime.now().isoformat(timespec='seconds')})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
