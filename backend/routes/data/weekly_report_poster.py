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


@bp.route('/weekly-report/poster/preview', methods=['POST'])
@handle_exceptions
def preview_poster():
    """
    预览海报
    ---
    tags:
      - Weekly Report Poster
    summary: 预览周报海报
    description: |
      根据平台和数据生成预览海报HTML。
      支持三个平台：小红书、腾讯、抖音。
      返回注入了数据的完整HTML页面，可直接渲染展示。
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - platform
          properties:
            platform:
              type: string
              description: 平台标识
              enum: [xiaohongshu, tencent, douyin, 小红书, 腾讯, 抖音]
              example: "xiaohongshu"
            start_date:
              type: string
              format: date
              description: 周报开始日期
              example: "2025-01-01"
            end_date:
              type: string
              format: date
              description: 周报结束日期
              example: "2025-01-07"
            rankings:
              type: object
              description: 排行榜数据
              properties:
                total:
                  type: array
                  description: 总排行榜
                  items:
                    type: object
                existing:
                  type: array
                  description: 存量排行榜
                  items:
                    type: object
                new:
                  type: array
                  description: 新增排行榜
                  items:
                    type: object
    produces:
      - text/html
    responses:
      200:
        description: 返回渲染好的HTML页面
        schema:
          type: string
          description: 完整的HTML内容
      400:
        description: 请求参数错误
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "MISSING_PLATFORM"
            message:
              type: string
              example: "请指定平台"
      404:
        description: 模板文件不存在
      500:
        description: 服务器错误
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


@bp.route('/weekly-report/poster/export', methods=['POST'])
@handle_exceptions
def export_poster():
    """
    导出海报数据
    ---
    tags:
      - Weekly Report Poster
    summary: 导出周报海报数据
    description: |
      返回完整的HTML模板和数据，前端可以使用html2canvas等工具截图。
      与预览接口不同，此接口返回JSON格式数据，包含分离的HTML和海报数据。
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - platform
          properties:
            platform:
              type: string
              description: 平台标识
              enum: [xiaohongshu, tencent, douyin, 小红书, 腾讯, 抖音]
              example: "xiaohongshu"
            start_date:
              type: string
              format: date
              description: 周报开始日期
              example: "2025-01-01"
            end_date:
              type: string
              format: date
              description: 周报结束日期
              example: "2025-01-07"
            rankings:
              type: object
              description: 排行榜数据
              properties:
                total:
                  type: array
                  description: 总排行榜
                  items:
                    type: object
                existing:
                  type: array
                  description: 存量排行榜
                  items:
                    type: object
                new:
                  type: array
                  description: 新增排行榜
                  items:
                    type: object
    produces:
      - application/json
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: object
              properties:
                html:
                  type: string
                  description: 模板HTML内容
                poster_data:
                  type: object
                  description: 海报数据
                  properties:
                    start_date:
                      type: string
                      example: "2025-01-01"
                    end_date:
                      type: string
                      example: "2025-01-07"
                    rankings:
                      type: object
      400:
        description: 请求参数错误
      404:
        description: 模板文件不存在
      500:
        description: 服务器错误
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
@handle_exceptions
def serve_template(filename):
    """
    提供模板文件访问
    ---
    tags:
      - Weekly Report Poster
    summary: 获取周报模板文件
    description: |
      提供周报海报模板文件的静态访问。
      模板文件位于 frontend/templates/weekly-reports/ 目录下。
    parameters:
      - name: filename
        in: path
        type: string
        required: true
        description: 模板文件名
        example: "xiaohongshu-template.html"
    produces:
      - text/html
    responses:
      200:
        description: 返回模板文件内容
        schema:
          type: string
          description: HTML模板内容
      404:
        description: 文件不存在
    """
    return send_from_directory(TEMPLATE_DIR, filename)
