# -*- coding: utf-8 -*-
"""
WebDAV 数据库备份 API 路由
"""

from flask import Blueprint, request, jsonify, current_app
import threading
import uuid
import os
from datetime import datetime
import shutil

bp = Blueprint('webdav_backup', __name__)

# 存储任务状态（内存）
backup_tasks = {}


@bp.route('/backup', methods=['POST'])
def create_backup():
    """
    创建数据库备份到坚果云

    Request:
        {
            "description": "备份说明"  // 可选
        }

    Response:
        {
            "success": true,
            "task_id": "uuid",
            "message": "备份任务已启动"
        }
    """
    data = request.get_json() or {}
    description = data.get('description', '')

    task_id = str(uuid.uuid4())
    backup_tasks[task_id] = {
        'status': 'running',
        'progress': 0,
        'message': '正在创建备份...',
        'type': 'backup'
    }

    # 异步执行
    thread = threading.Thread(
        target=_backup_async,
        args=(task_id, description)
    )
    thread.start()

    return jsonify({
        'success': True,
        'task_id': task_id,
        'message': '备份任务已启动'
    })


@bp.route('/restore', methods=['POST'])
def restore_backup():
    """
    从坚果云恢复数据库

    Request:
        {
            "filename": "backup_20260122_153000.db"
        }

    Response:
        {
            "success": true,
            "task_id": "uuid",
            "message": "恢复任务已启动"
        }
    """
    data = request.get_json()
    filename = data.get('filename')

    if not filename:
        return jsonify({
            'success': False,
            'error': 'MISSING_FILENAME',
            'message': '缺少备份文件名'
        }), 400

    task_id = str(uuid.uuid4())
    backup_tasks[task_id] = {
        'status': 'running',
        'progress': 0,
        'message': '正在准备恢复...',
        'type': 'restore'
    }

    # 异步执行
    thread = threading.Thread(
        target=_restore_async,
        args=(task_id, filename)
    )
    thread.start()

    return jsonify({
        'success': True,
        'task_id': task_id,
        'message': '恢复任务已启动'
    })


@bp.route('/list', methods=['GET'])
def list_backups():
    """
    获取备份列表

    Response:
        {
            "success": true,
            "data": [
                {
                    "filename": "backup_20260122_153000.db",
                    "size": 1024000,
                    "created": "2026-01-22 15:30:00",
                    "description": ""
                },
                ...
            ]
        }
    """
    try:
        from backend.utils.webdav_client import WebDAVBackupClient
        import config

        client = WebDAVBackupClient(
            url=config.WEBDAV_URL,
            username=config.WEBDAV_USERNAME,
            password=config.WEBDAV_PASSWORD,
            backup_dir=config.WEBDAV_BACKUP_DIR
        )

        backups = client.list_backups()

        return jsonify({
            'success': True,
            'data': backups
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'LIST_FAILED',
            'message': f'获取备份列表失败: {str(e)}'
        }), 500


@bp.route('/delete', methods=['POST'])
def delete_backup():
    """
    删除备份文件

    Request:
        {
            "filename": "backup_20260122_153000.db"
        }

    Response:
        {
            "success": true,
            "message": "备份已删除"
        }
    """
    data = request.get_json()
    filename = data.get('filename')

    if not filename:
        return jsonify({
            'success': False,
            'error': 'MISSING_FILENAME',
            'message': '缺少备份文件名'
        }), 400

    try:
        from backend.utils.webdav_client import WebDAVBackupClient
        import config

        client = WebDAVBackupClient(
            url=config.WEBDAV_URL,
            username=config.WEBDAV_USERNAME,
            password=config.WEBDAV_PASSWORD,
            backup_dir=config.WEBDAV_BACKUP_DIR
        )

        client.delete_backup(filename)

        return jsonify({
            'success': True,
            'message': '备份已删除'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'DELETE_FAILED',
            'message': f'删除失败: {str(e)}'
        }), 500


@bp.route('/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    """
    查询备份/恢复任务进度

    Response:
        {
            "success": true,
            "data": {
                "status": "running",  // running/completed/failed
                "progress": 50,
                "message": "正在上传...",
                "type": "backup"
            }
        }
    """
    task = backup_tasks.get(task_id)
    if not task:
        return jsonify({
            'success': False,
            'error': 'TASK_NOT_FOUND',
            'message': '任务不存在'
        }), 404

    return jsonify({
        'success': True,
        'data': task
    })


def _backup_async(task_id, description):
    """异步执行备份"""
    try:
        from app import app
        import config
        from backend.utils.webdav_client import WebDAVBackupClient

        with app.app_context():
            backup_tasks[task_id]['message'] = '正在连接坚果云...'
            backup_tasks[task_id]['progress'] = 10

            # 初始化 WebDAV 客户端
            client = WebDAVBackupClient(
                url=config.WEBDAV_URL,
                username=config.WEBDAV_USERNAME,
                password=config.WEBDAV_PASSWORD,
                backup_dir=config.WEBDAV_BACKUP_DIR
            )

            # 获取数据库路径
            db_path = app.config.get('DATABASE_PATH', 'database/shengxintou.db')

            # 如果是相对路径，转换为绝对路径
            if not os.path.isabs(db_path):
                db_path = os.path.join(app.root_path, '..', db_path)
                db_path = os.path.abspath(db_path)

            # 检查是否启用压缩
            use_compression = getattr(config, 'WEBDAV_USE_COMPRESSION', False)

            if use_compression:
                backup_tasks[task_id]['message'] = '正在压缩数据库...'
                backup_tasks[task_id]['progress'] = 20

            backup_tasks[task_id]['message'] = '正在上传数据库...'
            backup_tasks[task_id]['progress'] = 40

            # 上传备份
            result = client.upload_backup(db_path, description, use_compression=use_compression)

            backup_tasks[task_id]['progress'] = 90

            # 构建成功消息
            size_info = f"{result['size'] / 1024 / 1024:.2f} MB"
            if result.get('compressed'):
                original_mb = result['original_size'] / 1024 / 1024
                compressed_mb = result['size'] / 1024 / 1024
                compression_ratio = (1 - compressed_mb / original_mb) * 100
                size_info = f"{compressed_mb:.2f} MB (原始: {original_mb:.2f} MB, 压缩率: {compression_ratio:.1f}%)"

            backup_tasks[task_id]['message'] = f'备份成功: {result["filename"]} ({size_info})'

            # 清理旧备份（保留最近N个）
            backup_tasks[task_id]['message'] = '正在清理旧备份...'
            try:
                backups = client.list_backups()
                max_backups = getattr(config, 'WEBDAV_MAX_BACKUPS', 3)
                if len(backups) > max_backups:
                    deleted_count = 0
                    for old_backup in backups[max_backups:]:
                        try:
                            client.delete_backup(old_backup['filename'])
                            deleted_count += 1
                        except:
                            pass  # 忽略删除失败
                    if deleted_count > 0:
                        backup_tasks[task_id]['message'] = f'清理完成: 删除了 {deleted_count} 个旧备份'
            except Exception as e:
                # 清理失败不影响备份任务
                print(f"清理旧备份时出错: {str(e)}")

            # 步骤 4: 同步版本号到云端
            backup_tasks[task_id]['message'] = '正在同步版本信息...'
            backup_tasks[task_id]['progress'] = 95

            try:
                # 比较本地版本与云端版本
                from backend.routes.version import compare_versions, get_local_version, get_cloud_version
                from backend.utils.webdav_client import WebDAVBackupClient
                import config

                local_ver = get_local_version()
                cloud_ver = get_cloud_version()

                if local_ver and cloud_ver:
                    local_version_str = local_ver.get('version', '0.0.0')
                    cloud_version_str = cloud_ver.get('version', '0.0.0')

                    # 如果本地版本 > 云端版本，同步版本信息
                    if compare_versions(local_version_str, cloud_version_str) > 0:
                        # 读取本地版本文件
                        version_file = os.path.join(app.root_path, '..', 'version.json')
                        with open(version_file, 'r', encoding='utf-8') as f:
                            version_data = json.load(f)

                        # 上传到坚果云
                        client = WebDAVBackupClient(
                            url=config.WEBDAV_URL,
                            username=config.WEBDAV_USERNAME,
                            password=config.WEBDAV_PASSWORD,
                            backup_dir=config.WEBDAV_BACKUP_DIR
                        )

                        # 创建云端版本文件
                        cloud_version_file = local_ver.get('cloud_version_file', 'version_cloud.json')

                        # 先上传到临时文件
                        import tempfile
                        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as tmp:
                            json.dump(version_data, tmp, ensure_ascii=False, indent=2)
                            tmp.flush()

                            # 上传到坚果云
                            client.upload_file(
                                tmp.name,
                                cloud_version_file
                            )

                        backup_tasks[task_id]['message'] = f'版本信息已同步 (本地 {local_version_str} > 云端 {cloud_version_str})'
                    else:
                        backup_tasks[task_id]['message'] = f'版本信息已是最新 (本地 {local_version_str} <= 云端 {cloud_version_str})'
                else:
                    backup_tasks[task_id]['message'] = '版本信息同步完成'

                backup_tasks[task_id]['progress'] = 98

            except Exception as e:
                # 版本同步失败不影响备份任务
                current_app.logger.error(f"同步版本信息失败: {str(e)}")
                backup_tasks[task_id]['message'] = '版本同步失败，但备份成功'

            backup_tasks[task_id]['status'] = 'completed'
            backup_tasks[task_id]['progress'] = 100
            backup_tasks[task_id]['message'] = f'备份完成: {result["filename"]}'
            backup_tasks[task_id]['result'] = result

    except Exception as e:
        backup_tasks[task_id]['status'] = 'failed'
        backup_tasks[task_id]['message'] = f'备份失败: {str(e)}'
        import traceback
        traceback.print_exc()


def _restore_async(task_id, filename):
    """异步执行恢复"""
    try:
        from app import app
        import config
        from backend.utils.webdav_client import WebDAVBackupClient
        from backend.database import db

        with app.app_context():
            backup_tasks[task_id]['message'] = '正在连接坚果云...'
            backup_tasks[task_id]['progress'] = 5

            # 初始化 WebDAV 客户端
            client = WebDAVBackupClient(
                url=config.WEBDAV_URL,
                username=config.WEBDAV_USERNAME,
                password=config.WEBDAV_PASSWORD,
                backup_dir=config.WEBDAV_BACKUP_DIR
            )

            # 获取数据库路径
            db_path = app.config.get('DATABASE_PATH', 'database/shengxintou.db')

            # 如果是相对路径，转换为绝对路径
            if not os.path.isabs(db_path):
                db_path = os.path.join(app.root_path, '..', db_path)
                db_path = os.path.abspath(db_path)

            db_dir = os.path.dirname(db_path)

            # Step 1: 先备份当前数据库
            backup_tasks[task_id]['message'] = '正在备份当前数据库...'
            backup_tasks[task_id]['progress'] = 10

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            pre_restore_backup = f'pre_restore_{timestamp}.db'
            pre_restore_path = os.path.join(db_dir, pre_restore_backup)

            shutil.copy2(db_path, pre_restore_path)

            backup_tasks[task_id]['message'] = '正在下载备份文件...'
            backup_tasks[task_id]['progress'] = 30

            # Step 2: 下载备份到临时文件
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp:
                tmp_path = tmp.name

            try:
                client.download_backup(filename, tmp_path)

                backup_tasks[task_id]['message'] = '正在验证文件完整性...'
                backup_tasks[task_id]['progress'] = 60

                # Step 3: 验证文件完整性
                # 检查下载的文件是否存在且可读
                if not os.path.exists(tmp_path):
                    raise Exception("下载的备份文件不存在")

                file_size = os.path.getsize(tmp_path)
                if file_size == 0:
                    raise Exception("下载的备份文件为空")

                backup_tasks[task_id]['message'] = '正在恢复数据库...'
                backup_tasks[task_id]['progress'] = 70

                # Step 4: 关闭所有数据库连接
                db.session.close()
                db.engine.dispose()

                # Step 5: 替换数据库文件
                shutil.copy2(tmp_path, db_path)

                backup_tasks[task_id]['progress'] = 90
                backup_tasks[task_id]['message'] = f'恢复完成: {filename}'

                # 保存预恢复备份路径（用于回滚）
                backup_tasks[task_id]['pre_restore_backup'] = pre_restore_backup

                backup_tasks[task_id]['status'] = 'completed'
                backup_tasks[task_id]['progress'] = 100
                backup_tasks[task_id]['message'] = f'恢复成功: {filename}'

            except Exception as e:
                # 恢复失败，回滚
                backup_tasks[task_id]['message'] = f'恢复失败，正在回滚: {str(e)}'
                shutil.copy2(pre_restore_path, db_path)
                raise Exception(f'恢复失败并已回滚: {str(e)}')

            finally:
                # 清理临时文件
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

    except Exception as e:
        backup_tasks[task_id]['status'] = 'failed'
        backup_tasks[task_id]['message'] = f'恢复失败: {str(e)}'
