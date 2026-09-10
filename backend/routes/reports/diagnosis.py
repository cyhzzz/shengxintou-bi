# -*- coding: utf-8 -*-
"""智能辅助诊断（GET，只读聚合）

业务定位：把「三段式投放分析」沉淀的诊断经验固化为规则引擎，
按月对内容平台（小红书等）/ 应用市场 / 全局数据健康度自动体检，
输出 error/warn/info 分级信号与修复建议，供前端「智能诊断」页与移动端复用。

- GET /api/v1/reports/diagnosis?month=YYYY-MM
    month 缺省取库内最新月份；格式非法返回 400 INVALID_PARAMETER
    （run_diagnosis 抛 ValueError，由 handle_exceptions 统一映射）。

规则引擎与取数实现见 backend/utils/diagnosis/（metrics/rules/engine）；
离线验证入口见 backend/scripts/run_diagnosis.py。
输出契约：{month, generated_at, snapshot_dates, summary, items}
"""
from flask import Blueprint, request, jsonify

from backend.utils.decorators import handle_exceptions
from backend.utils.diagnosis import run_diagnosis

bp = Blueprint('diagnosis_report', __name__, url_prefix='/api/v1/reports')


@bp.route('/diagnosis', methods=['GET'])
@handle_exceptions
def get_diagnosis():
    """智能辅助诊断报告（按月体检，只读）"""
    month = request.args.get('month') or None
    result = run_diagnosis(month)
    return jsonify({
        'success': True,
        'data': result,
    })
