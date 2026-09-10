# -*- coding: utf-8 -*-
"""LLM Provider 配置 API（OpenAI 协议）

- GET  /api/v1/system/llm-config       查看配置（api_key 永远脱敏）
- PUT  /api/v1/system/llm-config       保存配置（api_key / model / timeout 留空 = 沿用已存值）
- POST /api/v1/system/llm-config/test  连通性测试（可用未保存的表单值）

配置存储在 USER_DATA_DIR/llm_config.json（本机文件，不入库、不分发）。
"""
from flask import Blueprint, request, jsonify

from backend.utils.decorators import handle_exceptions
from backend.utils import llm

bp = Blueprint('llm_config', __name__, url_prefix='/api/v1/system')


@bp.route('/llm-config', methods=['GET'])
@handle_exceptions
def get_llm_config():
    """查看 LLM 配置（api_key 脱敏）"""
    return jsonify({'success': True, 'data': llm.config_view()})


@bp.route('/llm-config', methods=['PUT'])
@handle_exceptions
def put_llm_config():
    """保存 LLM 配置（api_key 留空表示保留原值）"""
    llm.save_config(request.get_json(silent=True) or {})
    return jsonify({'success': True, 'data': llm.config_view()})


@bp.route('/llm-config/test', methods=['POST'])
@handle_exceptions
def test_llm_config():
    """连通性测试：优先用请求体里的表单值，缺省回落到已存配置"""
    merged = llm.resolve_config(request.get_json(silent=True) or {})
    if not merged['api_key'] or not merged['model']:
        return jsonify({
            'success': False,
            'error': 'LLM_NOT_CONFIGURED',
            'message': '请先填写 api_key 与 model',
        }), 400
    try:
        # v4.2.0: max_tokens 放宽到 16，且允许空 content——思考型模型（GLM 系列）
        # 会把小预算花在思考上导致正文为空，连通性以 HTTP 200 + 响应结构合法为准
        _, latency_ms = llm.call_chat(
            merged, [{'role': 'user', 'content': 'ping'}],
            max_tokens=16, allow_empty_content=True,
        )
    except llm.LlmRequestError as e:
        return jsonify({'success': False, 'error': 'LLM_REQUEST_FAILED', 'message': str(e)}), 502
    return jsonify({'success': True, 'data': {'ok': True, 'latency_ms': latency_ms}})
