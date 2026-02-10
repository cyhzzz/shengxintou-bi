# -*- coding: utf-8 -*-
"""
版本管理 API 路由
"""

from flask import Blueprint, request, jsonify, current_app
import os
import json
from datetime import datetime

bp = Blueprint('version', __name__)


def get_local_version():
    """获取本地版本信息"""
    # 通过当前文件位置定位项目根目录，避免中文路径编码问题
    # backend/routes/version.py -> backend -> project_root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    version_file = os.path.join(project_root, 'version.json')

    current_app.logger.info(f"版本文件路径: {version_file}")
    current_app.logger.info(f"文件是否存在: {os.path.exists(version_file)}")

    if not os.path.exists(version_file):
        current_app.logger.warning(f"版本文件不存在: {version_file}，返回默认值")
        return {
            'version': '1.0.0',
            'release_date': '2026-01-16',
            'changelog': ['初始版本'],
            'cloud_version_file': 'version_cloud.json',
            'update_url': '',
            'support_contact': '产品经理 陈元昊'
        }

    try:
        with open(version_file, 'r', encoding='utf-8') as f:
            version_data = json.load(f)
            current_app.logger.info(f"成功读取版本文件: v{version_data.get('version', 'unknown')}")
            return version_data
    except Exception as e:
        current_app.logger.error(f"读取版本文件失败: {str(e)}")
        return None


def get_cloud_version():
    """获取云端版本信息"""
    local_version = get_local_version()
    if not local_version:
        return None

    cloud_file = local_version.get('cloud_version_file', 'version_cloud.json')
    # 使用与本地版本文件相同的路径计算方式
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    cloud_path = os.path.join(project_root, cloud_file)

    if not os.path.exists(cloud_path):
        return None

    try:
        with open(cloud_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"读取云端版本文件失败: {str(e)}")
        return None


def compare_versions(version1, version2):
    """
    比较两个版本号

    Returns:
        1: version1 > version2
        0: version1 == version2
        -1: version1 < version2
    """
    v1_parts = [int(x) for x in version1.split('.')]
    v2_parts = [int(x) for x in version2.split('.')]

    for v1, v2 in zip(v1_parts, v2_parts):
        if v1 > v2:
            return 1
        elif v1 < v2:
            return -1

    return 0


@bp.route('/local', methods=['GET'])
def get_version_info():
    """
    获取本地版本信息

    Response:
        {
            "success": true,
            "data": {
                "version": "1.2.0",
                "release_date": "2026-01-27",
                "changelog": [...]
            }
        }
    """
    version_info = get_local_version()

    if version_info:
        return jsonify({
            'success': True,
            'data': version_info
        })
    else:
        return jsonify({
            'success': False,
            'error': 'FAILED_TO_READ_VERSION',
            'message': '无法读取版本信息'
        }), 500


@bp.route('/compare', methods=['GET'])
def compare_with_cloud():
    """
    比较本地版本与云端版本

    Response:
        {
            "success": true,
            "data": {
                "local_version": "1.2.0",
                "cloud_version": "1.1.0",
                "comparison": "greater",  // greater, equal, less, error
                "needs_update": false,
                "message": "本地版本高于云端版本"
            }
        }
    """
    local_version = get_local_version()
    cloud_version = get_cloud_version()

    if not local_version:
        return jsonify({
            'success': False,
            'error': 'NO_LOCAL_VERSION',
            'message': '无法读取本地版本信息'
        }), 500

    local_ver = local_version.get('version', '0.0.0')

    if not cloud_version:
        # 云端版本不存在，视为需要创建
        return jsonify({
            'success': True,
            'data': {
                'local_version': local_ver,
                'cloud_version': None,
                'comparison': 'no_cloud',
                'needs_update': False,
                'message': '云端版本文件不存在',
                'support_contact': local_version.get('support_contact', '')
            }
        })

    cloud_ver = cloud_version.get('version', '0.0.0')

    # 比较版本号
    comparison_result = compare_versions(local_ver, cloud_ver)

    if comparison_result > 0:
        comparison = 'greater'
        needs_update = False
        message = '本地版本高于云端版本'
    elif comparison_result < 0:
        comparison = 'less'
        needs_update = True
        message = f'存在更新版本 ({cloud_ver})，请联系管理员获取最新版软件'
    else:
        comparison = 'equal'
        needs_update = False
        message = '本地版本与云端版本一致'

    return jsonify({
        'success': True,
        'data': {
            'local_version': local_ver,
            'cloud_version': cloud_ver,
            'comparison': comparison,
            'needs_update': needs_update,
            'message': message,
            'cloud_changelog': cloud_version.get('changelog', []),
            'support_contact': local_version.get('support_contact', '')
        }
    })


@bp.route('/sync-to-cloud', methods=['POST'])
def sync_version_to_cloud():
    """
    将本地版本同步到云端

    会在坚果云备份时自动调用，如果本地版本 > 云端版本

    Response:
        {
            "success": true,
            "message": "版本信息已同步到云端"
        }
    """
    local_version = get_local_version()

    if not local_version:
        return jsonify({
            'success': False,
            'error': 'NO_LOCAL_VERSION',
            'message': '无法读取本地版本信息'
        }), 500

    cloud_file = local_version.get('cloud_version_file', 'version_cloud.json')
    # 使用与本地版本文件相同的路径计算方式
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    cloud_path = os.path.join(project_root, cloud_file)

    try:
        # 写入云端版本文件
        with open(cloud_path, 'w', encoding='utf-8') as f:
            json.dump(local_version, f, ensure_ascii=False, indent=2)

        current_app.logger.info(f"版本信息已同步到云端: {local_version['version']}")

        return jsonify({
            'success': True,
            'message': '版本信息已同步到云端'
        })
    except Exception as e:
        current_app.logger.error(f"同步版本到云端失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'SYNC_FAILED',
            'message': f'同步失败: {str(e)}'
        }), 500
