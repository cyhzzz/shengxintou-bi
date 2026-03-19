# -*- coding: utf-8 -*-
"""检查导入状态"""
from app import app
from backend.database import db
from backend.models import DataImportLog, BackendConversions

with app.app_context():
    # 检查最近的导入日志
    logs = db.session.query(DataImportLog).order_by(DataImportLog.created_at.desc()).limit(5).all()
    print('=== 最近5条导入日志 ===')
    for log in logs:
        print(f'{log.created_at} | {log.import_type} | {log.status} | {log.file_name} | 插入:{log.inserted_rows} | 错误:{log.error_message}')

    # 检查backend_conversions表记录数
    count = db.session.query(BackendConversions).count()
    print(f'\n=== backend_conversions 记录数: {count} ===')