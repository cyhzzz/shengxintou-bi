from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, Boolean, Text, JSON
from datetime import datetime
from backend.database import db



# ============================================
# 广告投放相关表
# ============================================
class DataImportLog(db.Model):
    """数据导入日志表（PRD v1.1）"""
    __tablename__ = 'data_import_log'

    id = Column(Integer, primary_key=True, autoincrement=True, comment='主键ID')
    task_id = Column(String(100), unique=True, nullable=False, index=True, comment='任务ID（唯一标识）')
    import_type = Column(String(50), nullable=False, index=True, comment='导入类型: tencent_ads/douyin_ads/xiaohongshu_ads/backend_conversion/account_mapping/xhs_notes_list/xhs_notes_daily')
    file_name = Column(String(255), nullable=False, comment='原始文件名')
    file_path = Column(String(500), comment='文件存储路径')
    file_size = Column(Integer, comment='文件大小（字节）')

    # 统计字段
    total_rows = Column(Integer, default=0, comment='总行数')
    processed_rows = Column(Integer, default=0, comment='已处理行数')
    inserted_rows = Column(Integer, default=0, comment='新增行数')
    updated_rows = Column(Integer, default=0, comment='更新行数')
    failed_rows = Column(Integer, default=0, comment='失败行数')

    # 状态字段
    status = Column(String(20), default='uploaded', index=True, comment='状态: uploaded/processing/completed/failed')
    progress = Column(Integer, default=0, comment='处理进度（0-100）')
    message = Column(Text, comment='提示消息')
    error_code = Column(String(50), comment='错误代码')
    error_message = Column(Text, comment='错误详情')
    encoding = Column(String(20), comment='文件编码: utf-8/gbk/gb2312')

    # 性能字段
    processing_time = Column(Integer, comment='处理耗时（秒）')
    quality_score = Column(Numeric(5, 2), comment='数据质量评分（0-100）')

    # 控制字段
    overwrite = Column(Boolean, default=False, comment='是否覆盖模式')

    # 时间字段
    started_at = Column(DateTime, comment='开始处理时间')
    completed_at = Column(DateTime, comment='完成时间')
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')


# ============================================
# 系统配置相关表
# ============================================

class SystemConfiguration(db.Model):
    """系统配置表"""
    __tablename__ = 'system_configuration'

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True, comment='配置键')
    config_value = Column(Text, comment='配置值')
    config_type = Column(String(20), default='string', comment='配置类型: string/number/boolean/json')
    category = Column(String(50), comment='配置分类: general/budget/alert/api')
    description = Column(String(500), comment='配置说明')
    is_editable = Column(Boolean, default=True, comment='是否可编辑')
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')


