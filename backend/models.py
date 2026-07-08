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

class WeeklyReport(db.Model):
    """周报数据表

    存储每周的周报数据，包括：
    - 报告期信息（年份、周次、月份、月内周次）
    - 日期区间（周五到次周四）
    - 各项数据指标（流量、广告、转化）
    - 重点工作内容
    - 完整HTML内容

    报告期计算规则：
    - 每周从周五开始，到次周四结束
    - 例如：1月23日(周五)-1月29日(周四)是2026年1月第4周
    """
    __tablename__ = 'weekly_reports'

    # 主键：报告ID，格式: YYYY-MM-weeknum (如: 2026-01-1 表示2026年1月第1周)
    report_id = Column(String(20), primary_key=True, nullable=False, comment='报告ID (格式: YYYY-MM-weeknum)')

    # ===== 报告期信息 =====
    report_year = Column(Integer, nullable=False, index=True, comment='报告年份 (如: 2026)')
    report_week = Column(Integer, nullable=False, index=True, comment='报告周次 (全年第几周, 1-53)')
    report_month = Column(Integer, nullable=False, index=True, comment='报告月份 (1-12)')
    report_month_week = Column(Integer, nullable=False, comment='月内周次 (1-5)')

    # ===== 日期区间 (周五到次周四) =====
    start_date = Column(Date, nullable=False, index=True, comment='开始日期 (周五)')
    end_date = Column(Date, nullable=False, index=True, comment='结束日期 (次周四)')

    # ===== 报告标识 =====
    report_name = Column(String(100), comment='报告名称 (如: "2026年1月第4周")')
    report_sequence = Column(Integer, nullable=False, comment='全年序号 (第N次周报)')

    # ===== 流量入口数据 =====
    content_count = Column(Integer, default=0, comment='内容数量')
    content_count_cumulative = Column(Integer, default=0, comment='内容数量累计')
    content_views = Column(Integer, default=0, comment='阅读播放')
    content_views_cumulative = Column(Integer, default=0, comment='阅读播放累计')

    live_sessions = Column(Integer, default=0, comment='直播场次')
    live_sessions_cumulative = Column(Integer, default=0, comment='直播场次累计')
    live_viewers = Column(Integer, default=0, comment='观看人数')
    live_viewers_cumulative = Column(Integer, default=0, comment='观看人数累计')

    # ===== 广告投放数据 =====
    ad_impressions = Column(Integer, default=0, comment='曝光量')
    ad_impressions_cumulative = Column(Integer, default=0, comment='曝光量累计')
    ad_clicks = Column(Integer, default=0, comment='点击量')
    ad_clicks_cumulative = Column(Integer, default=0, comment='点击量累计')

    # ===== 转化数据 =====
    new_accounts = Column(Integer, default=0, comment='互联网营业部新开户')
    new_accounts_cumulative = Column(Integer, default=0, comment='新开户累计')

    enterprise_wechat_add = Column(Integer, default=0, comment='企业微信添加')
    enterprise_wechat_add_cumulative = Column(Integer, default=0, comment='企业微信添加累计')

    subscription_count = Column(Integer, default=0, comment='投顾产品订阅')
    subscription_count_cumulative = Column(Integer, default=0, comment='投顾产品订阅累计')

    branch_new_accounts = Column(Integer, default=0, comment='助力分支新开户')
    branch_new_accounts_cumulative = Column(Integer, default=0, comment='助力分支新开户累计')

    # ===== 重点工作内容 (JSON格式) =====
    key_works = Column(Text, comment='重点工作 (JSON数组)')

    # ===== 报告状态 =====
    status = Column(String(20), default='draft', index=True, comment='状态: draft, published')

    # ===== 元数据 =====
    created_by = Column(String(100), comment='创建人')
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    published_at = Column(DateTime, comment='发布时间')

    __table_args__ = (
        # 唯一约束：同一年份+周次只有一条记录
        db.UniqueConstraint('report_year', 'report_week', name='idx_weekly_report_unique'),
    )
