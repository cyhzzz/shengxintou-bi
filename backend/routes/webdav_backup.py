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
from backend.utils.decorators import handle_exceptions

bp = Blueprint('webdav_backup', __name__)

# 存储任务状态（内存）
backup_tasks = {}


def _is_webdav_configured() -> bool:
    """检测 WebDAV 必需配置是否齐全（URL/USERNAME/PASSWORD）。

    v3.5.10：未配置时所有 WebDAV 端点统一返回 not_configured=true，
    前端显示「尚未配置 WebDAV 服务器」友好引导，而不是报错。
    """
    try:
        import config
        return bool(config.WEBDAV_URL and config.WEBDAV_USERNAME and config.WEBDAV_PASSWORD)
    except Exception:
        return False


@bp.route('/backup', methods=['POST'])
@handle_exceptions
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
@handle_exceptions
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


@bp.route('/sync-check', methods=['GET'])
@handle_exceptions
def sync_check():
    """检查坚果云最新备份 vs 本地业务数据最新日期，判断是否需要同步。

    返回结构：
    {
        "success": true,
        "data": {
            "cloud_available": true,        # WebDAV 是否可达
            "cloud_latest": "2026-07-21 10:30:00",  # 云端最新备份 created（北京时间）
            "cloud_filename": "backup_xxx.db",
            "local_latest": "2026-07-20",  # 本地 5 张业务表 MAX(日期字段) 并集
            "need_sync": true,              # 云端更新于本地
            "diff_hours": 18,               # 时差（小时，向下取整）
            "local_sources": {              # 各业务表最新日期明细（debug 用）
                "vendor_daily": "2026-07-20",
                ...
            }
        }
    }

    任何一层失败（WebDAV 连不上 / 数据库查询失败）都返回 success: true + cloud_available: false，
    前端静默显示「无法连接坚果云」，不报错弹窗。
    """
    result = _check_sync_status()
    return jsonify(result)


@bp.route('/auto-sync', methods=['POST'])
@handle_exceptions
def auto_sync():
    """一键同步——自动从坚果云拉取最新备份恢复本地数据库。
    复用 _restore_async 完整流程（含 pre_restore 备份 + 失败回滚）。
    不接 filename 参数，自动选云端最新一份。
    """
    # meta 校验门——避免「云端 created 看着新但其实是本地数据」的误触发
    #   1. 调 _check_sync_status 拿到 cloud_data_latest / need_sync / meta_source
    #   2. 若 needs_meta_rebuild（云端最新备份缺 meta）→ 拒绝执行，要求先做一次备份补 meta
    #   3. 若 !need_sync → 拒绝执行（防止无限循环同步）
    status = _check_sync_status()
    sd = (status or {}).get('data') or {}
    if not sd.get('cloud_available'):
        return jsonify({
            'success': False,
            'error': 'CLOUD_UNAVAILABLE',
            'message': '坚果云不可达，无法执行同步',
        }), 502
    if sd.get('needs_meta_rebuild'):
        return jsonify({
            'success': False,
            'error': 'META_MISSING',
            'message': '云端最新备份缺少 meta 信息，请先在本地做一次备份（会自动生成 meta），再执行同步',
            'cloud_filename': sd.get('cloud_filename'),
        }), 400
    if not sd.get('need_sync'):
        return jsonify({
            'success': False,
            'error': 'NO_SYNC_NEEDED',
            'message': '云端数据日期不新于本地，无需同步（避免无限循环）',
            'cloud_data_latest': sd.get('cloud_data_latest'),
            'local_latest': sd.get('local_latest'),
        }), 400

    try:
        from backend.utils.webdav_client import WebDAVBackupClient
        from webdav3.exceptions import RemoteResourceNotFound
        import config

        client = WebDAVBackupClient(
            url=config.WEBDAV_URL,
            username=config.WEBDAV_USERNAME,
            password=config.WEBDAV_PASSWORD,
            backup_dir=config.WEBDAV_BACKUP_DIR
        )

        # 拉云端最新一份
        backups = client.list_backups()
        if not backups:
            return jsonify({
                'success': False,
                'error': 'NO_CLOUD_BACKUP',
                'message': '坚果云暂无备份文件',
            }), 404

        latest = backups[0]  # list_backups 已按 created 倒序

        # 二次校验: meta 必须在场(防止 check_sync_status 与本端点之间 meta 被删)
        try:
            client.download_json(client.meta_filename_for(latest['filename']))
        except RemoteResourceNotFound:
            return jsonify({
                'success': False,
                'error': 'META_MISSING',
                'message': '云端最新备份缺少 meta（已被并发删除？）',
                'cloud_filename': latest['filename'],
            }), 400

        task_id = str(uuid.uuid4())
        backup_tasks[task_id] = {
            'status': 'running',
            'progress': 0,
            'message': f'正在从坚果云同步最新备份 {latest["filename"]}...',
            'type': 'restore',
        }

        thread = threading.Thread(
            target=_restore_async,
            args=(task_id, latest['filename'])
        )
        thread.start()

        return jsonify({
            'success': True,
            'task_id': task_id,
            'filename': latest['filename'],
            'cloud_latest': latest.get('created'),
            'message': '同步任务已启动',
        })
    except Exception as e:
        msg = str(e)
        is_conn_err = (
            ('无法连接' in msg) or
            ('WebDAV' in msg and ('SSL' in msg or '握手' in msg or '重置' in msg or '拒绝' in msg))
        )
        if is_conn_err:
            status_code = 502
            error_code = 'UPSTREAM_UNAVAILABLE'
        else:
            status_code = 500
            error_code = 'AUTO_SYNC_FAILED'
        return jsonify({
            'success': False,
            'error': error_code,
            'message': f'同步启动失败: {msg}',
        }), status_code


def _compute_local_sources(app):
    """计算本地 5 张业务表各自的 MAX 日期 + 整体 MAX。

    抽出来给 _check_sync_status 和 _backup_async 共享——
    保证备份时的 meta 与 sync-check 时对比的 local_latest 来自同一份查询逻辑。
    返回 (local_sources: dict, local_latest: str|None)。
    """
    from backend.database import db
    from backend.models_v2 import (
        AggVendorDaily, AggXhsNote, FactConvContent,
        FactConvAppmarket, AggDailyChannelOpen,
    )
    from sqlalchemy import func as _func

    local_sources = {}
    with app.app_context():
        with db.engine.connect() as conn:
            for table_key, col in [
                ('vendor_daily', AggVendorDaily.日期),
                ('xhs_note', AggXhsNote.发布时间),
                ('fact_conv_content', FactConvContent.线索日期),
                ('fact_conv_appmarket', FactConvAppmarket.下载日期),
                ('agg_daily_channel_open', AggDailyChannelOpen.时间区间),
            ]:
                try:
                    v = conn.execute(_func.max(col).select()).scalar()
                    if v:
                        local_sources[table_key] = str(v)[:10]
                except Exception:
                    pass
    local_latest = max(local_sources.values()) if local_sources else None
    return local_sources, local_latest


def _check_sync_status():
    """v3.4.1: 内部同步状态计算逻辑（供 sync_check 端点 + 启动检查共用）。

    关键修正：避免「坚果云 created 时间 vs 业务数据日期」的误判。
      - 优先读云端最新备份的 .meta.json，从中取 data_latest（这是真正的"数据日期"）
      - 若 meta 不存在（旧备份），fallback 到文件 modified time 并标 needs_meta_rebuild=True
        （前端提示用户下次备份会自动补充 meta，不阻断当前流程）

    返回结构同 sync_check 响应。任何异常一律返回 success: true + cloud_available: false，
    不抛出（避免阻断正常使用 / 启动流程）。
    """
    empty_data = {
        'cloud_available': False,
        'cloud_latest': None,
        'cloud_filename': None,
        'local_latest': None,
        'need_sync': False,
        'diff_hours': 0,
        'local_sources': {},
        'needs_meta_rebuild': False,
        'meta_source': None,           # 'meta' / 'file_mtime' / None
        'cloud_data_latest': None,      # 云端备份里真正的"业务数据日期"
        'not_configured': False,         # v3.5.10：未配置时前端友好引导
    }

    # v3.5.10：未配置时直接返回，不进入 try 链路（避免日志噪声）
    if not _is_webdav_configured():
        return {
            'success': True,
            'data': {**empty_data, 'not_configured': True},
        }

    try:
        # 1. 本地最新日期：5 张业务表 MAX(日期字段) 取并集
        from backend.database import db
        from backend.models_v2 import (
            AggVendorDaily, AggXhsNote, FactConvContent,
            FactConvAppmarket, AggDailyChannelOpen,
        )
        from sqlalchemy import func as _func

        local_sources = {}
        with db.engine.connect() as conn:
            for table_key, col in [
                ('vendor_daily', AggVendorDaily.日期),
                ('xhs_note', AggXhsNote.发布时间),
                ('fact_conv_content', FactConvContent.线索日期),
                ('fact_conv_appmarket', FactConvAppmarket.下载日期),
                ('agg_daily_channel_open', AggDailyChannelOpen.时间区间),
            ]:
                try:
                    v = conn.execute(_func.max(col).select()).scalar()
                    if v:
                        local_sources[table_key] = str(v)[:10]
                except Exception:
                    pass

        local_latest = max(local_sources.values()) if local_sources else None

        # 2. 云端最新备份
        from backend.utils.webdav_client import WebDAVBackupClient
        from webdav3.exceptions import RemoteResourceNotFound
        import config

        client = WebDAVBackupClient(
            url=config.WEBDAV_URL,
            username=config.WEBDAV_USERNAME,
            password=config.WEBDAV_PASSWORD,
            backup_dir=config.WEBDAV_BACKUP_DIR
        )
        backups = client.list_backups()
        if not backups:
            return {
                'success': True,
                'data': {
                    **empty_data,
                    'local_latest': local_latest,
                    'local_sources': local_sources,
                }
            }

        latest_backup = backups[0]
        cloud_filename = latest_backup.get('filename')
        cloud_latest_str = latest_backup.get('created')  # YYYY-MM-DD HH:MM:SS 北京时间

        # 3. 优先读 .meta.json 拿真正的 data_latest
        meta_source = None
        cloud_data_latest = None
        needs_meta_rebuild = False
        meta_filename = client.meta_filename_for(cloud_filename)
        try:
            meta = client.download_json(meta_filename)
            cloud_data_latest = meta.get('data_latest')  # YYYY-MM-DD
            meta_source = 'meta'
        except RemoteResourceNotFound:
            # 旧备份没有 meta：fallback 到文件 modified time，标记需补 meta
            cloud_data_latest = (cloud_latest_str or '')[:10]
            meta_source = 'file_mtime'
            needs_meta_rebuild = True
        except Exception:
            cloud_data_latest = (cloud_latest_str or '')[:10]
            meta_source = 'file_mtime'
            needs_meta_rebuild = True

        # 4. 比较：用 cloud_data_latest（真正的"数据日期"） vs local_latest
        need_sync = False
        diff_hours = 0
        if cloud_data_latest and local_latest:
            need_sync = cloud_data_latest > local_latest
            try:
                from datetime import datetime as _dt
                cloud_dt = _dt.strptime(cloud_data_latest, '%Y-%m-%d')
                local_dt = _dt.strptime(local_latest, '%Y-%m-%d')
                diff_hours = max(0, int((cloud_dt - local_dt).total_seconds() // 3600))
            except Exception:
                pass

        return {
            'success': True,
            'data': {
                'cloud_available': True,
                'cloud_latest': cloud_latest_str,
                'cloud_filename': cloud_filename,
                'cloud_data_latest': cloud_data_latest,
                'meta_source': meta_source,
                'needs_meta_rebuild': needs_meta_rebuild,
                'local_latest': local_latest,
                'need_sync': need_sync,
                'diff_hours': diff_hours,
                'local_sources': local_sources,
            }
        }
    except Exception:
        # 静默：返回云端不可达
        return {
            'success': True,
            'data': {**empty_data, 'local_sources': {}},
        }


@bp.route('/list', methods=['GET'])
@handle_exceptions
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
    # v3.5.10：未配置时返回空列表 + not_configured=true，前端友好引导
    if not _is_webdav_configured():
        return jsonify({
            'success': True,
            'data': [],
            'not_configured': True,
            'message': '尚未配置 WebDAV 服务器，请点击右上角「WebDAV 配置」按钮填入凭证',
        })

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
        # v3.1.6: 区分上游不可达 vs. 代码异常。
        # webdav_client._wrap_conn_err 已经把 SSL / 网络错误包装为可读中文 message。
        # 这里用 502 Bad Gateway 标识 远端 WebDAV 上游不可达，便于前端按
        # status code 区分 5xx 类别（5xx = 代码，502 = 上游/网络层）。
        msg = str(e)
        is_conn_err = (
            ('无法连接' in msg) or
            ('WebDAV' in msg and ('SSL' in msg or '握手' in msg or '重置' in msg or '拒绝' in msg))
        )
        if is_conn_err:
            status_code = 502
            error_code = 'UPSTREAM_UNAVAILABLE'
        else:
            status_code = 500
            error_code = 'LIST_FAILED'
        return jsonify({
            'success': False,
            'error': error_code,
            'message': f'获取备份列表失败: {msg}'
        }), status_code


@bp.route('/test', methods=['GET'])
@handle_exceptions
def test_webdav_connection():
    """WebDAV 连接自检（轻量 PROPFIND，用于快速排查网络/凭据/代理问题）"""
    try:
        from backend.utils.webdav_client import WebDAVBackupClient
        import config

        client = WebDAVBackupClient(
            url=config.WEBDAV_URL,
            username=config.WEBDAV_USERNAME,
            password=config.WEBDAV_PASSWORD,
            backup_dir=config.WEBDAV_BACKUP_DIR
        )
        result = client.test_connection()
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'TEST_FAILED',
            'message': f'连接自检失败: {str(e)}'
        }), 500


# v3.5.8：WebDAV 配置可视化读写（前端「数据同步」页可编辑 .env）
#   - GET：返回当前 .env 里的 WebDAV 配置，密码掩码（•••••• 末 4 位）
#   - PUT：原子写入 .env，未传的字段保留原值
#   - 配套运行时重载：写入后 importlib.reload(config) 让后续 /webdav/* 立即生效
_WEBDAV_CONFIG_KEYS = [
    ('WEBDAV_URL', 'url'),
    ('WEBDAV_USERNAME', 'username'),
    ('WEBDAV_PASSWORD', 'password'),
    ('WEBDAV_BASE_PATH', 'backup_dir'),
    ('WEBDAV_MAX_BACKUPS', 'max_backups'),
    ('WEBDAV_USE_COMPRESSION', 'use_compression'),
    ('WEBDAV_VERIFY_SSL', 'verify_ssl'),
]


def _mask_password(pwd: str) -> str:
    """密码掩码：保留末 4 位，前缀 ••••••"""
    if not pwd:
        return ''
    if len(pwd) <= 4:
        return '••••'
    return '••••••' + pwd[-4:]


def _read_env_file(env_path: str) -> dict:
    """读取 .env 文件为 dict（KEY=value），忽略注释和空行"""
    result = {}
    if not os.path.exists(env_path):
        return result
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, _, v = line.partition('=')
                result[k.strip()] = v.strip()
    return result


def _write_env_file(env_path: str, updates: dict) -> None:
    """原子写入 .env：保留注释和结构，仅更新指定 KEY

    实现策略：
    1. 读取原文件所有行
    2. 对每行 KEY=VALUE：若 KEY 在 updates 里，替换 VALUE
    3. updates 里未被原文件覆盖的 KEY：追加到末尾
    4. 写入临时文件，os.replace 原子替换
    """
    os.makedirs(os.path.dirname(env_path), exist_ok=True)

    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

    seen_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            new_lines.append(line)
            continue
        if '=' in stripped:
            key, _, _ = stripped.partition('=')
            key = key.strip()
            if key in updates:
                seen_keys.add(key)
                new_lines.append(f"{key}={updates[key]}\n")
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    # 追加未被原文件覆盖的 KEY
    for key, value in updates.items():
        if key not in seen_keys:
            new_lines.append(f"{key}={value}\n")

    tmp_path = env_path + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    os.replace(tmp_path, env_path)


def _reload_config_module():
    """写入 .env 后重载 config 模块，让后续请求读到新值"""
    try:
        import importlib
        import config
        # 重新加载 dotenv
        from dotenv import load_dotenv
        env_path = os.path.join(config.USER_DATA_DIR, '.env')
        load_dotenv(env_path, override=True)
        importlib.reload(config)
        # 同步到 app.config
        from flask import current_app
        current_app.config.from_object('config')
        current_app.config['AUTH_ENABLED'] = bool(getattr(config, 'AUTH_ENABLED', True))
        # 同步 top_config 别名（app.py 用 top_config 访问数据库 dialect）
        import sys
        sys.modules['config'] = config
    except Exception as e:
        import traceback
        print(f"[webdav_config] 重载 config 失败: {e}\n{traceback.format_exc()}")


@bp.route('/config', methods=['GET'])
@handle_exceptions
def get_webdav_config():
    """读取当前 .env 里的 WebDAV 配置（密码掩码）"""
    try:
        import config
        return jsonify({
            'success': True,
            'data': {
                'url': config.WEBDAV_URL,
                'username': config.WEBDAV_USERNAME,
                'password': _mask_password(config.WEBDAV_PASSWORD),
                'password_configured': bool(config.WEBDAV_PASSWORD),
                'backup_dir': config.WEBDAV_BACKUP_DIR,
                'max_backups': config.WEBDAV_MAX_BACKUPS,
                'use_compression': config.WEBDAV_USE_COMPRESSION,
                'verify_ssl': config.WEBDAV_VERIFY_SSL,
                'env_path': os.path.join(config.USER_DATA_DIR, '.env'),
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'CONFIG_READ_FAILED',
            'message': f'读取配置失败: {str(e)}'
        }), 500


@bp.route('/config', methods=['PUT'])
@handle_exceptions
def update_webdav_config():
    """更新 .env 里的 WebDAV 配置（原子写入 + 运行时重载）

    请求体（所有字段可选，未传则保留原值）：
    {
        "url": "https://dav.jianguoyun.com/dav/",
        "username": "your@email.com",
        "password": "app_password",          # 不传或空字符串时保留原密码
        "backup_dir": "/shengxintou-backup/",
        "max_backups": 3,
        "use_compression": true,
        "verify_ssl": true
    }
    """
    try:
        import config
        data = request.get_json() or {}

        env_path = os.path.join(config.USER_DATA_DIR, '.env')

        # 读取当前 .env 内容（用于保留未传入的字段）
        env_dict = _read_env_file(env_path)

        updates = {}

        if 'url' in data:
            updates['WEBDAV_URL'] = str(data['url'])

        if 'username' in data:
            updates['WEBDAV_USERNAME'] = str(data['username'])

        # 密码特殊处理：空字符串或未传 → 保留原值；非空 → 更新
        if 'password' in data and data['password']:
            # 拒绝掩码回填（防止前端误传 ••••••1234 当作密码）
            if not str(data['password']).startswith('••'):
                updates['WEBDAV_PASSWORD'] = str(data['password'])

        if 'backup_dir' in data:
            # 统一用 WEBDAV_BASE_PATH 作为权威配置项
            updates['WEBDAV_BASE_PATH'] = str(data['backup_dir'])

        if 'max_backups' in data:
            try:
                updates['WEBDAV_MAX_BACKUPS'] = str(int(data['max_backups']))
            except (ValueError, TypeError):
                pass

        if 'use_compression' in data:
            updates['WEBDAV_USE_COMPRESSION'] = 'true' if data['use_compression'] else 'false'

        if 'verify_ssl' in data:
            updates['WEBDAV_VERIFY_SSL'] = 'true' if data['verify_ssl'] else 'false'

        if not updates:
            return jsonify({'success': True, 'message': '无更新字段'})

        _write_env_file(env_path, updates)
        _reload_config_module()

        # 重新读取返回新值（密码仍掩码）
        import importlib
        import config as new_config
        importlib.reload(new_config)

        return jsonify({
            'success': True,
            'message': '配置已保存',
            'data': {
                'url': new_config.WEBDAV_URL,
                'username': new_config.WEBDAV_USERNAME,
                'password': _mask_password(new_config.WEBDAV_PASSWORD),
                'password_configured': bool(new_config.WEBDAV_PASSWORD),
                'backup_dir': new_config.WEBDAV_BACKUP_DIR,
                'max_backups': new_config.WEBDAV_MAX_BACKUPS,
                'use_compression': new_config.WEBDAV_USE_COMPRESSION,
                'verify_ssl': new_config.WEBDAV_VERIFY_SSL,
            }
        })
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': 'CONFIG_WRITE_FAILED',
            'message': f'保存配置失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/delete', methods=['POST'])
@handle_exceptions
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
@handle_exceptions
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
            # feat-desktop-supabase：PG 模式下不支持 WebDAV 文件级备份，
            # 数据由 Supabase 托管，请用 Supabase Dashboard 自带备份功能。
            if getattr(config, 'DATABASE_DIALECT', 'sqlite') == 'postgresql':
                backup_tasks[task_id]['status'] = 'failed'
                backup_tasks[task_id]['message'] = 'PostgreSQL 模式不支持 WebDAV 文件备份，请使用 Supabase Dashboard 自带的备份功能'
                backup_tasks[task_id]['progress'] = 100
                return

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

            # 上传 meta.json(< 1KB),记录真正的数据日期。
            # sync_check 时只下载这个小文件即可判断是否需要同步,避免下载几十 MB 备份。
            # 没有 meta 的旧备份会在 sync-check 时 fallback 到文件 mtime 并标 needs_meta_rebuild。
            try:
                local_sources, local_latest = _compute_local_sources(app)
                meta = {
                    'filename': result['filename'],
                    'created': result.get('upload_time'),
                    'data_latest': local_latest,
                    'local_sources': local_sources,
                    'schema_version': 'v3.4.1',
                }
                client.upload_json(meta, client.meta_filename_for(result['filename']))
                meta_info = f'meta: data_latest={local_latest or "无"}'
            except Exception as meta_err:
                # meta 上传失败不影响主备份任务,但在最终消息里提示
                meta_info = f'meta 上传失败: {meta_err}'

            # 构建成功消息
            size_info = f"{result['size'] / 1024 / 1024:.2f} MB"
            if result.get('compressed'):
                original_mb = result['original_size'] / 1024 / 1024
                compressed_mb = result['size'] / 1024 / 1024
                compression_ratio = (1 - compressed_mb / original_mb) * 100
                size_info = f"{compressed_mb:.2f} MB (原始: {original_mb:.2f} MB, 压缩率: {compression_ratio:.1f}%)"

            backup_tasks[task_id]['message'] = f'备份成功: {result["filename"]} ({size_info}) [{meta_info}]'

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
            # feat-desktop-supabase：PG 模式下不支持 WebDAV 文件级恢复。
            if getattr(config, 'DATABASE_DIALECT', 'sqlite') == 'postgresql':
                backup_tasks[task_id]['status'] = 'failed'
                backup_tasks[task_id]['message'] = 'PostgreSQL 模式不支持 WebDAV 文件恢复，请使用 Supabase Dashboard 自带的恢复功能'
                backup_tasks[task_id]['progress'] = 100
                return

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
