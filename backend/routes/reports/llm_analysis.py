# -*- coding: utf-8 -*-
"""LLM 智能分析 API（POST，手动触发）

- POST /api/v1/reports/llm-analysis {month?, force?}
    对目标月 + 前 3 个月分别跑智能诊断，用内置 prompt 交给配置好的 LLM
    生成含「跨月趋势对比」章节的 Markdown 分析；结果按（信号哈希 + 模型）缓存。

错误约定：未配置 LLM → 400 LLM_NOT_CONFIGURED；
month 非法 / 无数据 → 400 INVALID_PARAMETER；上游失败 → 502 LLM_REQUEST_FAILED。
"""
from flask import Blueprint, request, jsonify

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
