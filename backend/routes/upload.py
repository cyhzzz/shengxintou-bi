# -*- coding: utf-8 -*-
"""
省心投 BI - 文件上传API接口 - PRD v1.1

支持8种数据类型的导入:
1. tencent_ads - 腾讯广告数据
2. douyin_ads - 抖音广告数据
3. xiaohongshu_ads - 小红书广告数据
4. backend_conversion - 后端转化数据
5. account_mapping - 账号代理商映射
6. xhs_notes_list - 小红书笔记列表
7. xhs_notes_daily - 小红书笔记日级数据
8. xhs_notes_content_daily - 小红书内容笔记日级数据 ✅ 新增
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
import traceback
import threading
from sqlalchemy import text

from backend.database import db
from backend.models import DataImportLog
from backend.processors import (
    TencentAdsProcessor,
    DouyinAdsProcessor,
    XiaohongshuAdsProcessor,
    BackendConversionProcessor,
    AccountMappingProcessor,
    XhsNotesListProcessor,
    XhsNotesDailyProcessor,
    XhsNotesContentDailyProcessor
)
from backend.processors.xhs_notes_content_daily_processor_fast import XhsNotesContentDailyProcessorFast

bp = Blueprint('upload', __name__)

# 数据类型映射（PRD v1.1 - 8种数据类型）
DATA_TYPES = {
    'tencent_ads': '腾讯广告数据',
    'douyin_ads': '抖音广告数据',
    'xiaohongshu_ads': '小红书广告数据',
    'backend_conversion': '后端转化数据',
    'account_mapping': '账号代理商映射',
    'xhs_notes_list': '小红书笔记列表',
    'xhs_notes_daily': '小红书笔记日级数据',
    'xhs_notes_content_daily': '小红书内容笔记日级数据'  # 新增
}

# 处理器映射
PROCESSORS = {
    'tencent_ads': TencentAdsProcessor,
    'douyin_ads': DouyinAdsProcessor,
    'xiaohongshu_ads': XiaohongshuAdsProcessor,
    'backend_conversion': BackendConversionProcessor,
    'account_mapping': AccountMappingProcessor,
    'xhs_notes_list': XhsNotesListProcessor,
    'xhs_notes_daily': XhsNotesDailyProcessor,
    'xhs_notes_content_daily': XhsNotesContentDailyProcessorFast  # 使用高性能版（增量更新）
}

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload', methods=['POST'])
def upload_file():
    """
    上传数据文件（PRD v1.1）

    参数:
        file: 上传的文件
        data_type: 数据类型 (必填)
        overwrite: 是否覆盖模式 (可选，默认false)

    返回:
        task_id: 任务ID
        status: 状态 (processing)
        message: 提示消息
    """
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
            'message': f'不支持的文件类型，仅支持: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400

    # 获取数据类型
    data_type = request.form.get('data_type', '')
    if data_type not in DATA_TYPES:
        return jsonify({
            'success': False,
            'error': 'INVALID_DATA_TYPE',
            'message': f'无效的数据类型，支持的类型: {", ".join(DATA_TYPES.keys())}'
        }), 400

    # 获取是否覆盖模式
    overwrite = request.form.get('overwrite', 'false').lower() == 'true'

    # 生成唯一的任务ID
    task_id = str(uuid.uuid4())

    # 保存文件
    original_filename = file.filename

    # 处理文件名：保留扩展名，文件名部分用UUID替代（支持中文文件名）
    file_ext = os.path.splitext(original_filename)[1].lower()  # 获取扩展名（包括点）
    if not file_ext or file_ext not in ['.csv', '.xlsx', '.xls']:
        file_ext = '.csv'  # 默认扩展名

    # 生成安全的文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    random_id = str(uuid.uuid4())[:8]
    save_filename = f"{timestamp}_{data_type}_{random_id}{file_ext}"

    # 从config获取上传目录
    from config import UPLOAD_FOLDER
    filepath = os.path.join(UPLOAD_FOLDER, save_filename)

    # 确保上传目录存在
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    file.save(filepath)

    # 获取文件大小
    file_size = os.path.getsize(filepath)

    # 创建导入日志记录
    import_log = DataImportLog(
        task_id=task_id,
        import_type=data_type,
        file_name=original_filename,  # 保存原始文件名（包括中文）
        file_path=save_filename,      # 保存处理后的文件路径
        file_size=file_size,
        status='uploaded',
        overwrite=overwrite,
        created_at=datetime.now()
    )

    db.session.add(import_log)
    db.session.commit()

    # 异步处理文件
    thread = threading.Thread(
        target=process_file_async,
        args=(task_id, filepath, data_type, overwrite, import_log.id)
    )
    thread.start()

    return jsonify({
        'success': True,
        'data': {
            'task_id': task_id,
            'import_type': data_type,
            'import_type_name': DATA_TYPES[data_type],
            'file_name': original_filename,
            'file_size': file_size,
            'status': 'processing',
            'message': '文件上传成功，正在处理中...'
        }
    })


def process_file_async(task_id, filepath, data_type, overwrite, log_id):
    """
    异步处理文件

    Args:
        task_id: 任务ID
        filepath: 文件路径
        data_type: 数据类型
        overwrite: 是否覆盖模式
        log_id: 导入日志ID
    """
    try:
        # 获取应用上下文
        from app import app
        with app.app_context():
            # 更新状态为处理中
            import_log = db.session.query(DataImportLog).get(log_id)
            if not import_log:
                raise Exception(f"导入日志记录不存在: {log_id}")

            import_log.status = 'processing'
            import_log.started_at = datetime.now()
            import_log.progress = 10
            import_log.message = '正在读取文件...'
            db.session.commit()

            # 获取对应的处理器
            ProcessorClass = PROCESSORS.get(data_type)
            if not ProcessorClass:
                raise Exception(f"不支持的数据类型: {data_type}")

            # 创建处理器实例
            processor = ProcessorClass(db.session)

            # 处理数据导入
            result = processor.import_data(
                filepath,
                overwrite=overwrite,
                batch_size=1000
            )

            # 更新导入日志
            if result['success']:
                import_log.status = 'completed'
                import_log.completed_at = datetime.now()
                import_log.progress = 100
                import_log.total_rows = result.get('total_rows', 0)
                import_log.processed_rows = result.get('processed_rows', 0)
                import_log.inserted_rows = result.get('inserted_rows', 0)
                import_log.updated_rows = result.get('updated_rows', 0)
                import_log.failed_rows = result.get('failed_rows', 0)
                import_log.encoding = result.get('encoding')
                import_log.processing_time = result.get('processing_time')
                import_log.quality_score = result.get('quality_score')

                # 构建消息（包含warnings信息）
                message = result.get('message', '处理完成')
                if result.get('warnings'):
                    warning_msg = '\n\n' + '\n'.join(result['warnings'])
                    message += warning_msg
                import_log.message = message

                if result.get('errors'):
                    import_log.error_message = '\n'.join(result['errors'][:10])

                # 自动补充小红书笔记映射表（仅针对xhs_notes_content_daily 和 xhs_notes_daily）
                # ⚠️ 重要：必须在聚合表更新之前执行，否则聚合会读取到不完整的映射数据
                if data_type in ['xhs_notes_content_daily', 'xhs_notes_daily'] and result.get('success'):
                    try:
                        import_log.message += '\n\n正在补充笔记映射表...'
                        db.session.commit()

                        if data_type == 'xhs_notes_content_daily':
                            # 从内容表补充mapping
                            from backend.scripts.update_missing_mappings import update_missing_mappings_sql
                            mapping_stats = update_missing_mappings_sql()
                            import_log.message += f'\n笔记映射补充完成！处理 {mapping_stats} 条记录（新增+更新空字段）。'
                        elif data_type == 'xhs_notes_daily':
                            # 从广告表补充mapping（v3.2 新增）
                            from backend.models import XhsNotesDaily, XhsNoteInfo

                            # 获取所有唯一笔记的基础属性
                            notes_data = db.session.query(
                                XhsNotesDaily.note_id,
                                XhsNotesDaily.note_title,
                                XhsNotesDaily.note_url
                            ).distinct(
                                XhsNotesDaily.note_id
                            ).all()

                            new_count = 0
                            updated_count = 0

                            for note in notes_data:
                                if not note.note_id:
                                    continue

                                # 检查是否已存在
                                mapping = db.session.query(XhsNoteInfo).filter(
                                    XhsNoteInfo.note_id == note.note_id
                                ).first()

                                if mapping:
                                    # 更新空字段
                                    updated = False
                                    if not mapping.note_title and note.note_title:
                                        mapping.note_title = note.note_title
                                        updated = True
                                    if not mapping.note_url and note.note_url:
                                        mapping.note_url = note.note_url
                                        updated = True

                                    if updated:
                                        updated_count += 1
                                else:
                                    # 创建新记录
                                    new_mapping = XhsNoteInfo(
                                        note_id=note.note_id,
                                        note_title=note.note_title,
                                        note_url=note.note_url
                                    )
                                    db.session.add(new_mapping)
                                    new_count += 1

                            db.session.commit()
                            import_log.message += f'\n笔记映射补充完成！新增 {new_count} 条，更新 {updated_count} 条。'
                    except Exception as mapping_error:
                        # mapping补充失败不影响导入结果
                        import_log.message += f'\n笔记映射补充失败（可手动运行）: {str(mapping_error)}'
                        current_app.logger.warning(f"笔记映射补充失败: {str(mapping_error)}")

                # 自动触发聚合表更新
                #
                # daily_metrics_unified（代理商维度聚合表）：
                #   - 只聚合广告数据：tencent_ads, douyin_ads, xiaohongshu_ads
                #   - 只聚合转化数据：backend_conversion
                #   - 不聚合小红书笔记数据（xhs_notes_daily, xhs_notes_content_daily）
                #
                # daily_notes_metrics_unified（小红书笔记维度聚合表）：
                #   - 聚合小红书笔记数据：xhs_notes_daily, xhs_notes_content_daily
                #   - 聚合转化数据：backend_conversion（通过 note_id 关联）
                #   - 不聚合小红书广告数据（xiaohongshu_ads）
                if data_type in ['tencent_ads', 'douyin_ads', 'xiaohongshu_ads', 'backend_conversion']:
                    try:
                        import_log.message += '\n\n正在更新聚合表...'
                        db.session.commit()

                        # 导入聚合脚本（通用）
                        from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics
                        update_daily_metrics()

                        # 如果是小红书笔记数据或后端转化数据，额外更新笔记聚合表
                        #
                        # daily_notes_metrics_unified（笔记维度聚合表）：
                        #   - 通过 note_id 维度聚合笔记数据
                        #   - 支持从 backend_conversions 关联转化数据
                        #   - 维度字段优先从 xhs_note_info 获取（note_title, publish_account, publish_time, producer, ad_strategy）
                        #
                        # 适用的数据类型：
                        #   - xhs_notes_content_daily（小红书笔记运营数据）
                        #   - xhs_notes_daily（小红书笔记投放数据）
                        #   - xhs_notes_list（小红书笔记列表数据，直接更新 xhs_note_info 表）
                        #   - backend_conversion（后端转化数据，包含 note_id 字段）
                        if data_type in ['xhs_notes_content_daily', 'xhs_notes_daily', 'xhs_notes_list', 'backend_conversion']:
                            import_log.message += '\n\n正在更新笔记聚合表...'
                            db.session.commit()

                            from backend.scripts.aggregations.update_daily_notes_metrics import update_daily_notes_metrics
                            update_daily_notes_metrics()

                            import_log.message += '\n笔记聚合表更新完成！'

                        import_log.message += '\n聚合表更新完成！'
                    except Exception as agg_error:
                        # 聚合失败不影响导入结果
                        import_log.message += f'\n聚合表更新失败（可手动运行）: {str(agg_error)}'
                        current_app.logger.warning(f"聚合表更新失败: {str(agg_error)}")

                # 自动删除已处理的上传文件（仅在成功时）
                if result.get('success') and os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        import_log.message += f'\n\n上传文件已自动删除'
                        current_app.logger.info(f"已删除上传文件: {filepath}")
                    except Exception as delete_error:
                        # 删除失败不影响导入结果
                        import_log.message += f'\n\n上传文件删除失败: {str(delete_error)}'
                        current_app.logger.warning(f"删除上传文件失败: {filepath}, 错误: {str(delete_error)}")
            else:
                import_log.status = 'failed'
                import_log.completed_at = datetime.now()
                import_log.error_code = 'PROCESSING_ERROR'
                import_log.error_message = result.get('error', '处理失败')

            db.session.commit()

    except Exception as e:
        # 回滚当前 session，清除错误状态
        try:
            db.session.rollback()
        except:
            pass

        # 更新任务状态为失败
        from app import app
        with app.app_context():
            try:
                import_log = db.session.query(DataImportLog).get(log_id)
                if import_log:
                    import_log.status = 'failed'
                    import_log.completed_at = datetime.now()
                    import_log.error_code = 'SYSTEM_ERROR'
                    import_log.error_message = str(e)
                    import_log.message = f'处理失败: {str(e)}'
                    db.session.commit()
            except:
                # 如果更新日志也失败，至少记录错误
                try:
                    db.session.rollback()
                except:
                    pass

        current_app.logger.error(f"处理文件失败: {str(e)}\n{traceback.format_exc()}")


@bp.route('/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """
    获取导入任务状态（PRD v1.1）

    参数:
        task_id: 任务ID

    返回:
        task_id: 任务ID
        import_type: 数据类型
        file_name: 文件名
        status: 状态
        progress: 进度（0-100）
        message: 提示消息
        total_rows: 总行数
        processed_rows: 已处理行数
        inserted_rows: 新增行数
        updated_rows: 更新行数
        failed_rows: 失败行数
        quality_score: 数据质量评分
        started_at: 开始时间
        completed_at: 完成时间
    """
    import_log = db.session.query(DataImportLog).filter_by(task_id=task_id).first()

    if not import_log:
        return jsonify({
            'success': False,
            'error': 'TASK_NOT_FOUND',
            'message': '任务不存在'
        }), 404

    response = {
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
            'created_at': import_log.created_at.isoformat() if import_log.created_at else None
        }
    }

    if import_log.status == 'failed':
        response['data']['error_code'] = import_log.error_code
        response['data']['error_message'] = import_log.error_message

    return jsonify(response)


@bp.route('/history', methods=['GET'])
def get_import_history():
    """
    获取导入历史记录（PRD v1.1）

    查询参数:
        import_type: 数据类型（可选）
        status: 状态（可选）
        limit: 返回数量（默认50）
        offset: 偏移量（默认0）

    返回:
        total: 总记录数
        items: 导入记录列表
    """
    import_type = request.args.get('import_type')
    status = request.args.get('status')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))

    # 构建查询
    query = db.session.query(DataImportLog)

    if import_type:
        query = query.filter_by(import_type=import_type)

    if status:
        query = query.filter_by(status=status)

    # 按创建时间倒序
    query = query.order_by(DataImportLog.created_at.desc())

    # 获取总数
    total = query.count()

    # 分页查询
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
            'created_at': record.created_at.isoformat() if record.created_at else None
        })

    return jsonify({
        'success': True,
        'data': {
            'total': total,
            'items': items
        }
    })


@bp.route('/data-types', methods=['GET'])
def get_data_types():
    """
    获取支持的数据类型列表

    返回:
        data_types: 数据类型字典
        list: 数据类型列表
    """
    return jsonify({
        'success': True,
        'data': {
            'data_types': DATA_TYPES,
            'list': [
                {
                    'value': key,
                    'label': value
                }
                for key, value in DATA_TYPES.items()
            ]
        }
    })
