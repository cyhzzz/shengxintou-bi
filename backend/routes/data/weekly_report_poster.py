# -*- coding: utf-8 -*-
"""
员工转化周报海报API

提供海报模板服务和数据导出功能
"""

import os
from flask import Blueprint, request, jsonify, render_template_string, send_from_directory
from datetime import datetime
from backend.utils.decorators import handle_exceptions

bp = Blueprint('weekly_report_poster', __name__)

# 模板路径
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                           'frontend', 'templates', 'weekly-reports')


def get_platform_template(platform):
    """获取平台对应的模板文件名"""
    template_map = {
        'xiaohongshu': 'xiaohongshu-template.html',
        'tencent': 'tencent-template.html',
        'douyin': 'douyin-template.html',
        '小红书': 'xiaohongshu-template.html',
        '腾讯': 'tencent-template.html',
        '抖音': 'douyin-template.html'
    }
    return template_map.get(platform)


@bp.route('/api/v1/weekly-report/poster/preview', methods=['POST'])
@handle_exceptions
def preview_poster():
    """
    预览海报

    请求参数:
    {
        "platform": "xiaohongshu|tencent|douyin",
        "start_date": "2025-01-01",
        "end_date": "2025-01-07",
        "rankings": {
            "total": [...],
            "existing": [...],
            "new": [...]
        }
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'INVALID_PARAMS',
            'message': '请求参数不能为空'
        }), 400

    platform = data.get('platform')
    if not platform:
        return jsonify({
            'success': False,
            'error': 'MISSING_PLATFORM',
            'message': '请指定平台'
        }), 400

    template_file = get_platform_template(platform)
    if not template_file:
        return jsonify({
            'success': False,
            'error': 'INVALID_PLATFORM',
            'message': f'不支持的平台: {platform}'
        }), 400

    # 读取模板文件
    template_path = os.path.join(TEMPLATE_DIR, template_file)
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
    except FileNotFoundError:
        return jsonify({
            'success': False,
            'error': 'TEMPLATE_NOT_FOUND',
            'message': f'模板文件不存在: {template_file}'
        }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'TEMPLATE_READ_ERROR',
            'message': f'读取模板失败: {str(e)}'
        }), 500

    # 准备数据
    poster_data = {
        'start_date': data.get('start_date', ''),
        'end_date': data.get('end_date', ''),
        'rankings': data.get('rankings', {
            'total': [],
            'existing': [],
            'new': []
        })
    }

    # 将数据注入到模板中
    script_injection = f"""
<script>
    // 自动初始化海报数据
    window.posterData = {poster_data};
    if (typeof initPoster === 'function') {{
        initPoster(window.posterData);
    }} else {{
        // 等待脚本加载完成
        window.addEventListener('load', function() {{
            if (typeof initPoster === 'function') {{
                initPoster(window.posterData);
            }}
        }});
    }}
</script>
"""

    # 在</body>前插入脚本
    template_content = template_content.replace('</body>', f'{script_injection}</body>')

    return template_content


@bp.route('/api/v1/weekly-report/poster/export', methods=['POST'])
@handle_exceptions
def export_poster():
    """
    导出海报数据（供前端截图使用）

    返回完整的HTML内容，前端可以使用html2canvas截图
    """
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'INVALID_PARAMS',
            'message': '请求参数不能为空'
        }), 400

    platform = data.get('platform')
    if not platform:
        return jsonify({
            'success': False,
            'error': 'MISSING_PLATFORM',
            'message': '请指定平台'
        }), 400

    template_file = get_platform_template(platform)
    if not template_file:
        return jsonify({
            'success': False,
            'error': 'INVALID_PLATFORM',
            'message': f'不支持的平台: {platform}'
        }), 400

    # 读取模板文件
    template_path = os.path.join(TEMPLATE_DIR, template_file)
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
    except FileNotFoundError:
        return jsonify({
            'success': False,
            'error': 'TEMPLATE_NOT_FOUND',
            'message': f'模板文件不存在: {template_file}'
        }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'TEMPLATE_READ_ERROR',
            'message': f'读取模板失败: {str(e)}'
        }), 500

    # 返回完整HTML和数据
    return jsonify({
        'success': True,
        'data': {
            'html': template_content,
            'poster_data': {
                'start_date': data.get('start_date', ''),
                'end_date': data.get('end_date', ''),
                'rankings': data.get('rankings', {
                    'total': [],
                    'existing': [],
                    'new': []
                })
            }
        }
    })


@bp.route('/templates/weekly-reports/<path:filename>')
def serve_template(filename):
    """提供模板文件访问"""
    return send_from_directory(TEMPLATE_DIR, filename)
