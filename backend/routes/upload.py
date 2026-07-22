# -*- coding: utf-8 -*-
"""
省心投 BI - 文件上传API接口（v2 - 新表原样导入）

v2 改造要点：
- 7 个新数据类型（原样导入，导入层仅做格式层安全处理）：
    account_mapping       → dim_account
    conversion_content    → fact_conv_content
    conversion_appmarket  → fact_conv_appmarket
    vendor_daily          → agg_vendor_daily
    xhs_note              → agg_xhs_note
    channel_open          → agg_daily_channel_open
    qingniao_leads        → fact_qingniao_leads（例外：按批次 append 保留历史）
  其中 qingniao_leads 是明确例外，走 append + 批次标注；其他 6 类走 to_sql(replace)。
- 7 个旧数据类型（tencent_ads/douyin_ads/xiaohongshu_ads/backend_conversion/
  xhs_notes_list/xhs_notes_daily/xhs_notes_content_daily）已退役，返回 410 Gone。
- 保留 DataImportLog 记录（用于上传历史与进度跟踪）。
- 异步线程处理（保留 progress 查询体验）。
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
import traceback
import threading
import time

from backend.database import db
from backend.models import DataImportLog
from backend.processors.v2 import raw_import
from backend.utils.decorators import handle_exceptions

bp = Blueprint('upload', __name__)

# v2 数据类型（7 个）—— 原样导入；qingniao_leads 例外走 append + 批次标注
DATA_TYPES = {
    'account_mapping':      '投放账号映射',
    'conversion_content':   '内容平台加微链路',
    'conversion_appmarket': '应用市场下载链路',
    'vendor_daily':         '厂商广告投放分析',
    'xhs_note':             '小红书笔记',
    'channel_open':         '开户渠道分析',
    'qingniao_leads':       '抖音青鸟线索通',
}

# v1 已退役数据类型（保留识别名但返回 410）
DATA_TYPES_LEGACY = {
    'tencent_ads':           '腾讯广告（v1 已退役，请改用 vendor_daily）',
    'douyin_ads':            '抖音广告（v1 已退役，请改用 vendor_daily）',
    'xiaohongshu_ads':       '小红书广告（v1 已退役，请改用 vendor_daily）',
    'backend_conversion':    '后端转化明细（v1 已退役，请改用 conversion_content）',
    'xhs_notes_list':        '小红书笔记列表（v1 已退役，请改用 xhs_note）',
    'xhs_notes_daily':       '小红书笔记日级（v1 已退役，请改用 xhs_note）',
    'xhs_notes_content_daily': '小红书内容笔记日级（v1 已退役，请改用 xhs_note）',
}

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# -----------------------------------------------------------------------------
# 后台处理线程
# -----------------------------------------------------------------------------
def _process_file(task_id: str, filepath: str, data_type: str,
                  overwrite: bool, log_id: int, batch_tag: str = None):
    """异步处理文件（v2 原样导入）。

    v3.3.6：qingniao_leads 支持 batch_tag 参数（批次标注），其他类型忽略此参数。
    """
    try:
        from app import app
        with app.app_context():
            import_log = db.session.get(DataImportLog, log_id)
            if not import_log:
                raise Exception(f"导入日志记录不存在: {log_id}")

            import_log.status = 'processing'
            import_log.started_at = datetime.now()
            import_log.progress = 10
            import_log.message = '正在读取 Excel 文件...'
            db.session.commit()

            # v2 原样导入
            started = time.time()
            # v3.3.6：qingniao_leads 传 batch_tag 给 write_to_db → handle_qingniao_leads
            if data_type == 'qingniao_leads':
                meta = raw_import.write_to_db(data_type, filepath, batch_tag=batch_tag)
            else:
                meta = raw_import.write_to_db(data_type, filepath)
            elapsed = time.time() - started

            written = meta.get('written', {})
            row_counts = meta.get('row_counts', {})

            import_log.status = 'completed'
            import_log.completed_at = datetime.now()
            import_log.progress = 100

            # v2 不区分 insert/update；落库即 replace
            total_rows = sum(row_counts.values())
            import_log.total_rows = total_rows
            import_log.processed_rows = total_rows
            import_log.inserted_rows = total_rows
            import_log.updated_rows = 0
            import_log.failed_rows = 0
            import_log.processing_time = round(elapsed, 2)

            tables_str = ' / '.join(
                f"{t}={n}行" for t, n in written.items()
            )
            import_log.message = (
                f"v2 原样导入完成。耗时 {elapsed:.1f}s。"
                f"写入表：{tables_str}（共 {total_rows} 行）"
            )

            db.session.commit()

            # 自动删除上传文件（成功后）
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    current_app.logger.info(f"已删除上传文件: {filepath}")
                except Exception as del_err:
                    current_app.logger.warning(f"删除上传文件失败: {filepath}, {del_err}")

    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass

        err_msg = f"{type(e).__name__}: {e}"
        trace = traceback.format_exc()
        current_app.logger.error(f"[upload:{task_id}] {err_msg}\n{trace}")

        try:
            from app import app
            with app.app_context():
                import_log = db.session.get(DataImportLog, log_id)
                if import_log:
                    import_log.status = 'failed'
                    import_log.completed_at = datetime.now()
                    import_log.progress = 100
                    import_log.error_code = 'PROCESSING_ERROR'
                    import_log.error_message = err_msg[:2000]
                    import_log.message = f"导入失败：{err_msg[:500]}"
                    db.session.commit()
        except Exception as inner_e:
            current_app.logger.error(f"[upload:{task_id}] 写失败状态也失败: {inner_e}")


# -----------------------------------------------------------------------------
# 端点
# -----------------------------------------------------------------------------
@bp.route('/upload', methods=['POST'])
@handle_exceptions
def upload_file():
    """v2 上传入口（6 个新 type）。"""
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'INVALID_FILE',
            'message': '没有上传文件'
        }), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'NO_FILE_SELECTED',
            'message': '未选择文件'
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': 'INVALID_FILE_TYPE',
            'message': f'不支持的文件类型，仅支持: {", ".join(sorted(ALLOWED_EXTENSIONS))}'
        }), 400

    data_type = request.form.get('data_type', '')

    # 旧 type → 410 Gone + 友好引导
    if data_type in DATA_TYPES_LEGACY:
        return jsonify({
            'success': False,
            'error': 'LEGACY_DATA_TYPE',
            'message': DATA_TYPES_LEGACY[data_type],
            'hint': '请使用新 6 个数据类型之一',
            'new_data_types': list(DATA_TYPES.keys()),
        }), 410

    if data_type not in DATA_TYPES:
        return jsonify({
            'success': False,
            'error': 'INVALID_DATA_TYPE',
            'message': f'无效的数据类型，支持的类型: {", ".join(DATA_TYPES.keys())}',
        }), 400

    overwrite = request.form.get('overwrite', 'false').lower() == 'true'

    # v3.3.6：批次标注（仅 qingniao_leads 使用，其他类型忽略）
    # 不传时由 raw_import.handle_qingniao_leads 默认用 'YYYYMMDDHHmm'
    batch_tag = request.form.get('batch_tag', '').strip() or None

    task_id = str(uuid.uuid4())
    original_filename = file.filename

    file_ext = os.path.splitext(original_filename)[1].lower()
    if not file_ext or file_ext not in ['.csv', '.xlsx', '.xls']:
        file_ext = '.csv'

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    random_id = str(uuid.uuid4())[:8]
    save_filename = f"{timestamp}_{data_type}_{random_id}{file_ext}"

    from config import UPLOAD_FOLDER
    filepath = os.path.join(UPLOAD_FOLDER, save_filename)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file.save(filepath)
    file_size = os.path.getsize(filepath)

    # 创建导入日志
    import_log = DataImportLog(
        task_id=task_id,
        import_type=data_type,
        file_name=original_filename,
        file_size=file_size,
        status='pending',
        progress=0,
        message='等待处理...',
        overwrite=overwrite,
        started_at=None,
        completed_at=None,
    )
    db.session.add(import_log)
    db.session.commit()
    log_id = import_log.id

    # 启动异步线程
    thread = threading.Thread(
        target=_process_file,
        args=(task_id, filepath, data_type, overwrite, log_id, batch_tag),
        daemon=True,
    )
    thread.start()

    return jsonify({
        'success': True,
        'data': {
            'task_id': task_id,
            'status': 'pending',
            'message': f'文件已接收，使用 {DATA_TYPES[data_type]} 原样导入（v2，无中间计算）',
            'data_type': data_type,
            # v3.3.6：回传 batch_tag 便于前端自动选中本次批次
            'batch_tag': batch_tag,
        }
    })


@bp.route('/status/<task_id>', methods=['GET'])
@handle_exceptions
def get_import_status(task_id):
    """查询导入任务状态。"""
    import_log = db.session.query(DataImportLog).filter_by(task_id=task_id).first()
    if not import_log:
        return jsonify({
            'success': False,
            'error': 'TASK_NOT_FOUND',
            'message': '任务不存在'
        }), 404

    return jsonify({
        'success': True,
        'data': {
            'task_id': import_log.task_id,
            'import_type': import_log.import_type,
            'import_type_name': DATA_TYPES.get(import_log.import_type, import_log.import_type),
            'file_name': import_log.file_name,
            'status': import_log.status,
            'progress': import_log.progress,
            'message': import_log.message,
            'total_rows': import_log.total_rows,
            'processed_rows': import_log.processed_rows,
            'inserted_rows': import_log.inserted_rows,
            'updated_rows': import_log.updated_rows,
            'failed_rows': import_log.failed_rows,
            'quality_score': float(import_log.quality_score) if import_log.quality_score else None,
            'encoding': import_log.encoding,
            'processing_time': import_log.processing_time,
            'started_at': import_log.started_at.isoformat() if import_log.started_at else None,
            'completed_at': import_log.completed_at.isoformat() if import_log.completed_at else None,
            'created_at': import_log.created_at.isoformat() if import_log.created_at else None,
        }
    })


@bp.route('/history', methods=['GET'])
@handle_exceptions
def get_import_history():
    """获取导入历史记录。"""
    import_type = request.args.get('import_type')
    status = request.args.get('status')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))

    query = db.session.query(DataImportLog)
    if import_type:
        query = query.filter_by(import_type=import_type)
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(DataImportLog.created_at.desc())
    total = query.count()
    records = query.limit(limit).offset(offset).all()

    items = []
    for record in records:
        items.append({
            'task_id': record.task_id,
            'import_type': record.import_type,
            'import_type_name': DATA_TYPES.get(record.import_type, record.import_type),
            'file_name': record.file_name,
            'file_size': record.file_size,
            'status': record.status,
            'progress': record.progress,
            'message': record.message,
            'total_rows': record.total_rows,
            'processed_rows': record.processed_rows,
            'inserted_rows': record.inserted_rows,
            'updated_rows': record.updated_rows,
            'failed_rows': record.failed_rows,
            'quality_score': float(record.quality_score) if record.quality_score else None,
            'encoding': record.encoding,
            'processing_time': record.processing_time,
            'overwrite': record.overwrite,
            'started_at': record.started_at.isoformat() if record.started_at else None,
            'completed_at': record.completed_at.isoformat() if record.completed_at else None,
            'created_at': record.created_at.isoformat() if record.created_at else None,
        })

    return jsonify({
        'success': True,
        'data': {
            'total': total,
            'items': items
        }
    })


@bp.route('/data-types', methods=['GET'])
@handle_exceptions
def get_data_types():
    """获取支持的数据类型列表（v2 - 6 个新 type）。"""
    return jsonify({
        'success': True,
        'data': {
            'version': 'v2',
            'mode': '原样导入（无中间计算）',
            'data_types': DATA_TYPES,
            'list': [
                {
                    'value': key,
                    'label': value,
                    'target_tables': _target_tables(key),
                }
                for key, value in DATA_TYPES.items()
            ],
            'legacy_notice': {
                'retired': list(DATA_TYPES_LEGACY.keys()),
                'message': 'v1 数据类型已退役，请使用 v2 新类型',
            },
        }
    })


def _target_tables(data_type: str):
    """返回 data_type 落库的目标表（前端可显示）。"""
    return {
        'account_mapping':      ['dim_account'],
        'conversion_content':   ['fact_conv_content'],
        'conversion_appmarket': ['fact_conv_appmarket'],
        'vendor_daily':         ['agg_vendor_daily'],
        'xhs_note':             ['agg_xhs_note'],
        'channel_open':         ['agg_daily_channel_open'],
        'qingniao_leads':       ['fact_qingniao_leads'],
    }.get(data_type, [])
