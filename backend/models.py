# -*- coding: utf-8 -*-
"""
省心投 BI - 数据库模型
"""

from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, Boolean, Text, JSON
from datetime import datetime
from backend.database import db


# ============================================
# 广告投放相关表
# ============================================

class RawAdDataTencent(db.Model):
    """腾讯广告原始数据表（简化版 - 只保留核心指标）"""
    __tablename__ = 'raw_ad_data_tencent'

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    account_id = Column(String(50), nullable=False, index=True)
    cost = Column(Numeric(10, 2), default=0)            # 花费
    impressions = Column(Integer, default=0)             # 曝光量
    clicks = Column(Integer, default=0)                  # 点击量
    click_users = Column(Integer, default=0)             # 点击用户数
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        db.UniqueConstraint('date', 'account_id', name='idx_tencent_unique'),
    )


class RawAdDataDouyin(db.Model):
    """抖音广告原始数据表（简化版 - 只保留核心指标）"""
    __tablename__ = 'raw_ad_data_douyin'

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    account_id = Column(String(50), nullable=False, index=True)
    cost = Column(Numeric(10, 2), default=0)            # 消耗/花费
    impressions = Column(Integer, default=0)             # 展现数
    clicks = Column(Integer, default=0)                  # 点击数
    conversions = Column(Integer, default=0)             # 转化数
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        db.UniqueConstraint('date', 'account_id', name='idx_douyin_unique'),
    )


class RawAdDataXiaohongshu(db.Model):
    """小红书广告原始数据表（简化版 - 只保留核心指标）

    业务逻辑：
    - 代理商投放：有 advertiser_account_id + sub_account_id
    - 申万宏源直投：有 advertiser_account_id，sub_account_id 为 NULL
    """
    __tablename__ = 'raw_ad_data_xiaohongshu'

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    advertiser_account_id = Column(String(50), nullable=False, index=True)  # 广告主账户ID（主账户ID，必填）
    sub_account_id = Column(String(50), nullable=True, index=True)  # 代理商子账户ID（可为空，申万宏源直投时为NULL）
    cost = Column(Numeric(10, 2), default=0)            # 总消耗
    impressions = Column(Integer, default=0)             # 总展现
    clicks = Column(Integer, default=0)                  # 总点击
    private_messages = Column(Integer, default=0)        # 私信进线数
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        # 复合唯一键：日期 + 主账户ID + 子账户ID（允许NULL）
        # 对于申万宏源直投：date + advertiser_account_id + NULL
        # 对于代理商投放：date + advertiser_account_id + sub_account_id
        db.UniqueConstraint('date', 'advertiser_account_id', 'sub_account_id', name='idx_xiaohongshu_unique'),
    )


# ============================================
# 小红书笔记/内容相关表
# ============================================

class XhsNotesDaily(db.Model):
    """小红书笔记日级投放数据表 v3.2 Final（极简版 + 基础属性字段）

    更新说明（v3.2）：
    - 新增 note_title 和 note_url 字段：提高数据可读性
    - 导入时自动补充 xhs_note_info 表：建立基础属性主表

    精简说明：
    - 保留投放带来的互动指标（6个），用于与总业务数据对比，拆分自然流量
    - 保留私信进线数（1个），删除其他转化指标（非核心）
    - 删除所有可计算字段（各种率、平均成本等）
    - 删除冗余维度字段（delivery_mode, ad_strategy, agency, account_name）
    - 删除冗余转化数据（action_button_clicks, screenshots, search_clicks, wechat_add_count）
    - 新增账户ID字段（2个）：advertiser_account_id, sub_account_id
    - 新增基础属性字段（2个）：note_title, note_url

    数据用途：
    - 记录投放带来的广告指标和互动数据
    - 与 xhs_notes_content_daily 对比，拆分自然流量数据
    - 通过账户ID字段关联 account_agency_mapping，支持代理商分析
    - note_title 和 note_url 用于提高数据可读性

    自然流量计算：
    - 自然曝光 = xhs_notes_content_daily.total_impressions - xhs_notes_daily.impressions
    - 自然互动 = xhs_notes_content_daily.total_interactions - xhs_notes_daily.total_interactions

    代理商分析：
    - 通过 advertiser_account_id + sub_account_id 关联 account_agency_mapping
    - 自动获取 agency（代理商名称）
    - 支持按代理商维度的投放效果分析

    字段统计：
    - 核心ID: 5个（id, date, note_id, advertiser_account_id, sub_account_id）
    - 基础属性: 2个（note_title, note_url）【v3.2 新增】
    - 广告指标: 3个（cost, impressions, clicks）
    - 互动指标: 6个（likes, comments, favorites, follows, shares, total_interactions）
    - 私信指标: 1个（private_message_leads）
    - 系统字段: 1个（created_at）
    - 总计: 18个字段
    """
    __tablename__ = 'xhs_notes_daily'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 核心ID
    date = Column(Date, nullable=False, index=True, comment='日期')
    note_id = Column(String(100), nullable=False, index=True, comment='笔记ID')

    # 基础属性字段（v3.2 新增：提高可读性）
    note_title = Column(String(500), comment='笔记标题（冗余字段，提高可读性）')
    note_url = Column(Text, comment='笔记链接（冗余字段，提高可读性）')

    # 账户ID字段（v3.1 新增，用于关联代理商）
    advertiser_account_id = Column(String(50), comment='广告主账户ID（主账户ID）')
    sub_account_id = Column(String(50), comment='子账户ID（代理商子账户ID）')

    # 广告投放指标（投放基础数据）
    cost = Column(Numeric(10, 2), default=0, comment='总消耗（元）')
    impressions = Column(Integer, default=0, comment='投放展现量')
    clicks = Column(Integer, default=0, comment='投放点击量')

    # 投放互动指标（投放带来的互动，用于拆分自然流量）
    likes = Column(Integer, default=0, comment='投放带来点赞数')
    comments = Column(Integer, default=0, comment='投放带来评论数')
    favorites = Column(Integer, default=0, comment='投放带来收藏数')
    follows = Column(Integer, default=0, comment='投放带来关注数')
    shares = Column(Integer, default=0, comment='投放带来分享数')
    total_interactions = Column(Integer, default=0, comment='投放带来总互动数')

    # 私信转化指标（只保留进线数）
    private_message_leads = Column(Integer, default=0, comment='投放带来私信进线数')

    # 系统字段
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')


class XhsNoteInfo(db.Model):
    """小红书笔记信息表（基础属性表）

    作用：
    - 作为所有笔记的基础属性主表
    - 统一管理笔记的核心维度信息
    - 为聚合表提供维度数据

    字段说明：
    - note_id: 笔记唯一标识
    - note_title: 笔记标题
    - note_url: 笔记链接
    - publish_account: 发布账号
    - publish_time: 发布时间
    - producer: 创作者
    - ad_strategy: 广告策略
    """
    __tablename__ = 'xhs_note_info'

    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String(100), unique=True, nullable=False)
    note_title = Column(String(500))
    note_url = Column(Text)  # 新增：笔记链接
    publish_account = Column(String(200))
    publish_time = Column(DateTime)
    producer = Column(String(100))
    ad_strategy = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)


class XhsNotesContentDaily(db.Model):
    """小红书内容笔记日级数据表 v3.1（恢复字段版）

    版本说明（v3.1）：
    - 恢复 note_title 字段：用于补充 xhs_note_info 表
    - 恢复 note_publish_time 字段：用于补充 xhs_note_info 表
    - 保留 v3.0 精简成果：删除 producer, ad_strategy（由 mapping 表统一管理）
    - 保留 v3.0 精简成果：删除 custom_tags, note_status, product_binding_status

    数据用途：
    - 作为 xhs_note_info 的数据源
    - 提供笔记级运营指标
    - 支持聚合表 daily_notes_metrics_unified
    """
    __tablename__ = 'xhs_notes_content_daily'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 核心ID
    data_date = Column(Date, nullable=False, index=True, comment='数据日期（统计日期）')
    note_id = Column(String(100), nullable=False, index=True, comment='笔记ID')

    # 笔记基础信息（v3.1 恢复字段）
    note_title = Column(String(500), comment='笔记标题（用于补充mapping表）')
    note_url = Column(Text, comment='笔记链接')
    note_publish_time = Column(DateTime, comment='笔记发布时间（用于补充mapping表）')
    note_source = Column(String(50), comment='笔记来源：专业号笔记')
    note_type = Column(String(50), comment='笔记类型：图文笔记/视频笔记')

    # 创作者信息
    creator_name = Column(String(200), comment='创作者名称')
    creator_id = Column(String(100), comment='创作者ID')
    creator_followers = Column(Integer, default=0, comment='创作者粉丝数')

    # 运营指标（核心分析数据）
    total_impressions = Column(Integer, default=0, comment='全部曝光量')
    total_reads = Column(Integer, default=0, comment='全部阅读量')
    total_interactions = Column(Integer, default=0, comment='全部互动量（点赞+评论+收藏+分享）')

    # 系统字段
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        # 唯一索引：同一数据日期+笔记ID只有一条记录
        db.UniqueConstraint('data_date', 'note_id', name='idx_xhs_notes_content_daily_unique'),
    )


# ============================================
# 后端转化相关表
# ============================================

class BackendConversions(db.Model):
    """后端转化明细表（完整版 - 匹配Excel导入结构）

    Excel字段映射（40个字段）：
    1. 微信昵称
    2. 资金账号
    3. 开户营业部
    4. 客户性别
    5. 平台来源
    6. 流量类型
    7. 客户来源
    8. 是否客户开口
    9. 是否有效线索
    10. 是否开户中断
    11. 开户中断日期
    12. 是否开户
    13. 是否为有效户
    14. 是否为存量客户
    15. 是否为存量有效户
    16. 是否删除企微
    17. 线索日期 (lead_date)
    18. 首次触达时间 (first_contact_time)
    19. 最近互动时间 (last_contact_time)
    20. 互动次数
    21. 营销人员互动次数
    22. 添加员工号
    23. 添加员工姓名
    24. 开户时间
    25. 微信认证状态
    26. 微信认证时间
    27. 有效户时间
    28. 资产 (assets)
    29. 客户贡献 (customer_contribution)
    30. 广告账号 (ad_account)
    31. 广告代理商 (agency)
    32. 广告ID (ad_id)
    33. 创意ID (creative_id)
    34. 笔记ID (note_id)
    35. 笔记名称 (note_title)
    36. 平台用户ID (platform_user_id)
    37. 平台用户昵称 (platform_user_nickname)
    38. 广告点击日期 (ad_click_date)
    39. 生产者 (producer)
    40. 企微标签 (enterprise_wechat_tags)
    """
    __tablename__ = 'backend_conversions'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 基本信息
    wechat_nickname = Column(String(200))  # 微信昵称
    capital_account = Column(String(100))  # 资金账号
    opening_branch = Column(String(200))  # 开户营业部
    customer_gender = Column(String(10))  # 客户性别

    # 平台和流量信息
    platform_source = Column(String(50), index=True)  # 平台来源
    traffic_type = Column(String(50))  # 流量类型
    customer_source = Column(String(100))  # 客户来源

    # 布尔字段（是否字段）
    is_customer_mouth = Column(Boolean, default=False)  # 是否客户开口
    is_valid_lead = Column(Boolean, default=False)  # 是否有效线索
    is_open_account_interrupted = Column(Boolean, default=False)  # 是否开户中断
    open_account_interrupted_date = Column(Date)  # 开户中断日期
    is_opened_account = Column(Boolean, default=False)  # 是否开户
    is_valid_customer = Column(Boolean, default=False)  # 是否为有效户
    is_existing_customer = Column(Boolean, default=False)  # 是否为存量客户
    is_existing_valid_customer = Column(Boolean, default=False)  # 是否为存量有效户
    is_delete_enterprise_wechat = Column(Boolean, default=False)  # 是否删除企微

    # 时间字段
    lead_date = Column(Date, nullable=False, index=True)  # 线索日期
    first_contact_time = Column(DateTime)  # 首次触达时间
    last_contact_time = Column(DateTime)  # 最近互动时间
    account_opening_time = Column(DateTime)  # 开户时间
    wechat_verify_status = Column(String(50))  # 微信认证状态
    wechat_verify_time = Column(DateTime)  # 微信认证时间
    valid_customer_time = Column(DateTime)  # 有效户时间
    ad_click_date = Column(Date)  # 广告点击日期

    # 数值字段
    interaction_count = Column(Integer, default=0)  # 互动次数
    sales_interaction_count = Column(Integer, default=0)  # 营销人员互动次数
    assets = Column(Numeric(15, 2))  # 资产
    customer_contribution = Column(Numeric(15, 2))  # 客户贡献

    # 人员信息
    add_employee_no = Column(String(50))  # 添加员工号
    add_employee_name = Column(String(100))  # 添加员工姓名

    # 广告投放信息
    ad_account = Column(String(200), index=True)  # 广告账号
    agency = Column(String(100), index=True)  # 广告代理商
    ad_id = Column(String(100))  # 广告ID
    creative_id = Column(String(100))  # 创意ID

    # 小红书笔记信息
    note_id = Column(String(100))  # 笔记ID
    note_title = Column(String(500))  # 笔记名称

    # 平台用户信息
    platform_user_id = Column(String(100))  # 平台用户ID
    platform_user_nickname = Column(String(200))  # 平台用户昵称

    # 其他信息
    producer = Column(String(100))  # 生产者
    enterprise_wechat_tags = Column(Text)  # 企微标签

    # 元数据字段
    created_at = Column(DateTime, default=datetime.now)


# ============================================
# 账号与映射相关表
# ============================================

class AccountAgencyMapping(db.Model):
    """账号代理商映射表（v2.2 - 添加代理商子账户名称）

    字段说明:
    - platform: 平台 (腾讯/抖音/小红书)
    - account_id: 投放账号ID (腾讯/抖音账号ID，小红书代理商子账户ID)
    - account_name: 账号名称
    - main_account_id: 主账号ID (小红书广告主账户ID，其他平台为NULL)
    - sub_account_name: 代理商子账户名称 (仅小红书使用)
    - agency: 代理商名称
    - business_model: 业务模式 (直播/信息流/搜索)

    业务逻辑:
    - 腾讯/抖音: account_id有值，main_account_id为NULL，sub_account_name为NULL
    - 小红书代理商投放: account_id有值（子账户），main_account_id有值（广告主），sub_account_name有值
    - 小红书申万宏源直投: account_id为NULL，main_account_id有值，sub_account_name为NULL
    """
    __tablename__ = 'account_agency_mapping'

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(50), nullable=False, index=True)  # 腾讯/抖音/小红书
    account_id = Column(String(100), nullable=True, index=True)  # 投放账号ID（允许NULL，小红书直投时为空）
    account_name = Column(String(200))  # 账号名称
    main_account_id = Column(String(100), nullable=True, index=True)  # 主账号ID（小红书广告主账户ID）
    sub_account_name = Column(String(200))  # 代理商子账户名称（仅小红书）
    agency = Column(String(100), nullable=True, index=True)  # 代理商名称（允许为空，可通过账号管理页面补充）
    business_model = Column(String(50), index=True)  # 直播/信息流/搜索
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        # 唯一约束：同一平台+账号ID只能有一条记录（使用COALESCE处理NULL值）
        # 注意：小红书直投时account_id为NULL，需要应用层保证唯一性
        db.UniqueConstraint('platform', 'account_id', name='unique_platform_account'),
    )


# ============================================
# 统一聚合视图表
# ============================================

class DailyMetricsUnified(db.Model):
    """统一日级指标聚合表 v3.0

    聚合维度：
    - date: 日期
    - platform: 平台（腾讯/抖音/小红书）
    - agency: 代理商（可为空，支持未能关联的转化数据）
    - business_model: 业务模式（可为空，直播/信息流/搜索）

    广告指标（从3张广告数据表聚合：raw_ad_data_tencent, raw_ad_data_douyin, raw_ad_data_xiaohongshu）：
    - cost: 花费（元）
    - impressions: 展示次数
    - click_users: 点击人数（去重，从backend_conversions计算）

    转化指标（从backend_conversions表聚合）：
    - lead_users: 线索人数（去重）
    - potential_customers: 潜客人数（去重，is_existing_customer=False）
    - customer_mouth_users: 开口人数（去重，is_customer_mouth=True）
    - valid_lead_users: 有效线索人数（去重，is_valid_lead=True）
    - opened_account_users: 开户人数（去重，is_opened_account=True，按线索时点）
    - valid_customer_users: 有效户人数（去重，is_valid_customer=True）

    辅助字段（用于数据关联，不作为聚合维度）：
    - account_id: 账号ID
    - account_name: 账号名称

    业务逻辑：
    - 代理商关联失败时，agency为空字符串，广告指标为0，但转化数据正常显示
    - 业务模式推断失败时，business_model为空字符串
    - 所有转化指标均为去重人数统计
    """
    __tablename__ = 'daily_metrics_unified'

    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)

    # ===== 聚合维度 =====
    date = Column(Date, nullable=False, index=True, comment='日期')
    platform = Column(String(50), nullable=False, index=True, comment='平台：腾讯/抖音/小红书')
    agency = Column(String(100), nullable=True, index=True, comment='代理商（可为空）')
    business_model = Column(String(50), nullable=True, index=True, comment='业务模式：直播/信息流（可为空）')

    # ===== 广告指标（从广告数据表聚合） =====
    cost = Column(Numeric(10, 2), default=0, comment='花费（元）')
    impressions = Column(Integer, default=0, comment='展示次数')
    click_users = Column(Integer, default=0, comment='点击人数（去重）')

    # ===== 转化指标（从后端转化表聚合） =====
    lead_users = Column(Integer, default=0, comment='线索人数（去重）')
    potential_customers = Column(Integer, default=0, comment='潜客人数（去重，is_existing_customer=False）')
    customer_mouth_users = Column(Integer, default=0, comment='开口人数（去重，is_customer_mouth=True）')
    valid_lead_users = Column(Integer, default=0, comment='有效线索人数（去重，is_valid_lead=True）')
    opened_account_users = Column(Integer, default=0, comment='开户人数（去重，is_opened_account=True）')
    valid_customer_users = Column(Integer, default=0, comment='有效户人数（去重，is_valid_customer=True）')

    # ===== 辅助字段（用于数据关联，不作为聚合维度） =====
    account_id = Column(String(50), comment='账号ID（辅助字段）')
    account_name = Column(String(200), comment='账号名称（辅助字段）')

    # ===== 元数据 =====
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    __table_args__ = (
        # 复合唯一索引：确保同一维度只有一条记录（支持NULL值）
        # Index('idx_unique_metrics_v3', 'date', 'platform', 'agency', 'business_model', unique=True),

        # 复合索引：优化常见查询
        # Index('idx_date_platform_v3', 'date', 'platform'),
        # Index('idx_date_agency_v3', 'date', 'agency'),
        # Index('idx_platform_bm_v3', 'platform', 'business_model'),
    )


# ============================================
# 数据导入相关表
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


class AgencyAbbreviationMapping(db.Model):
    """
    代理商简称映射表

    用于将转化明细表（backend_conversions）中 agency 字段的拼音简称
    映射为代理商全称

    业务场景：
    - 抖音/腾讯转化数据的 agency 字段使用拼音简称（如 lz, fs, zl）
    - 小红书转化数据使用 ad_account JOIN 映射表获取全称
    - 需要将简称映射为全称，以便统一聚合和分析

    示例：
    - lz → 量子
    - fs → 风声
    - zl → 众联
    - YJ → 云极（平台简称）
    """
    __tablename__ = 'agency_abbreviation_mapping'

    id = Column(Integer, primary_key=True, autoincrement=True, comment='主键ID')

    # 映射关系字段
    abbreviation = Column(String(20), unique=True, nullable=False, index=True, comment='拼音简称（如 lz, fs, YJ）')
    full_name = Column(String(50), nullable=False, comment='全称（如 量子, 风声, 云极）')

    # 分类字段
    mapping_type = Column(String(20), nullable=False, index=True, comment='映射类型: agency（代理商）/ platform（平台）')
    platform = Column(String(20), comment='适用平台（腾讯/抖音/小红书，NULL表示通用）')

    # 显示和说明
    display_name = Column(String(50), comment='显示名称（用于前端展示）')
    description = Column(String(200), comment='说明备注')

    # 系统字段
    is_active = Column(Boolean, default=True, comment='是否启用')
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    __table_args__ = (
        db.UniqueConstraint('abbreviation', 'platform', name='idx_abbreviation_platform_unique'),
    )


class DailyNotesMetricsUnified(db.Model):
    """小红书笔记日级指标聚合表 v2.0

    数据来源：
    1. 维度字段：xhs_note_info (优先) + xhs_notes_content_daily (补充) + xhs_notes_daily
    2. 广告指标：xhs_notes_daily
    3. 运营指标：xhs_notes_content_daily + xhs_notes_daily
    4. 转化指标：backend_conversions (按 note_id + lead_date 关联)

    聚合粒度：date + note_id
    更新频率：每日增量更新
    保留策略：全量保留

    维度字段：
    - date, note_id, note_title, note_url, note_publish_time
    - publish_account（发布账号）, producer（创作者姓名）, ad_strategy, note_type
    - agency：代理商名称
    - delivery_mode：投放模式

    指标拆分规则：
    - 总量（total）：来自 xhs_notes_content_daily（投放+自然流量总和）
    - 投放量（ad）：来自 xhs_notes_daily（投放带来的数据）
    - 自然量（organic）：计算得出（总量 - 投放量）

    广告投放指标拆分：
    - cost: 投放消耗（只有投放量）
    - total_impressions, ad_impressions, organic_impressions: 展现量拆分
    - total_clicks, ad_clicks, organic_clicks: 点击量拆分

    运营指标拆分：
    - total_likes, ad_likes, organic_likes: 点赞量拆分
    - total_comments, ad_comments, organic_comments: 评论量拆分
    - total_favorites, ad_favorites, organic_favorites: 收藏量拆分
    - total_shares, ad_shares, organic_shares: 分享量拆分
    - total_interactions, ad_interactions, organic_interactions: 总互动量拆分

    私信指标拆分：
    - total_private_messages, ad_private_messages, organic_private_messages: 私信进线量拆分

    转化指标（来自 backend_conversions，按 note_id 关联）：
    - lead_users: 加微量（线索人数，去重）
    - customer_mouth_users: 开口量（客户开口人数，去重）
    - valid_lead_users: 有效线索量（去重）
    - opened_account_users: 开户量（开户人数，去重）
    - valid_customer_users: 有效户量（去重）

    资产指标（来自 backend_conversions）：
    - customer_assets_users: 有资产人数（去重）
    - customer_assets_amount: 资产总量（元）
    """
    __tablename__ = 'daily_notes_metrics_unified'

    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)

    # ===== 维度字段 =====
    date = Column(Date, nullable=False, index=True, comment='数据日期')
    note_id = Column(String(100), nullable=False, index=True, comment='笔记ID')
    note_title = Column(String(500), comment='笔记标题')
    note_url = Column(Text, comment='笔记链接')
    note_publish_time = Column(DateTime, comment='笔记创作日期')
    publish_account = Column(String(200), comment='发布账号')
    producer = Column(String(100), index=True, comment='创作者姓名')
    ad_strategy = Column(String(50), index=True, comment='投放策略（品宣/开户权益/基础知识投教）')
    note_type = Column(String(50), comment='笔记类型（图文笔记/视频笔记）')
    agency = Column(String(100), index=True, comment='代理商名称（新增）')
    delivery_mode = Column(String(50), comment='投放模式：自动投放/手动投放（新增）')

    # ===== 广告投放指标（只有投放量） =====
    cost = Column(Numeric(10, 2), default=0, comment='投放消耗（元）')

    # ===== 展现量拆分 =====
    total_impressions = Column(Integer, default=0, comment='总展现量（投放+自然）')
    ad_impressions = Column(Integer, default=0, comment='投放展现量')
    organic_impressions = Column(Integer, default=0, comment='自然展现量（总-投）')

    # ===== 点击量拆分 =====
    total_clicks = Column(Integer, default=0, comment='总点击量（投放+自然）')
    ad_clicks = Column(Integer, default=0, comment='投放点击量')
    organic_clicks = Column(Integer, default=0, comment='自然点击量（总-投）')

    # ===== 互动指标拆分：点赞 =====
    total_likes = Column(Integer, default=0, comment='总点赞量（投放+自然）')
    ad_likes = Column(Integer, default=0, comment='投放点赞量')
    organic_likes = Column(Integer, default=0, comment='自然点赞量（总-投）')

    # ===== 互动指标拆分：评论 =====
    total_comments = Column(Integer, default=0, comment='总评论量（投放+自然）')
    ad_comments = Column(Integer, default=0, comment='投放评论量')
    organic_comments = Column(Integer, default=0, comment='自然评论量（总-投）')

    # ===== 互动指标拆分：收藏 =====
    total_favorites = Column(Integer, default=0, comment='总收藏量（投放+自然）')
    ad_favorites = Column(Integer, default=0, comment='投放收藏量')
    organic_favorites = Column(Integer, default=0, comment='自然收藏量（总-投）')

    # ===== 互动指标拆分：分享 =====
    total_shares = Column(Integer, default=0, comment='总分享量（投放+自然）')
    ad_shares = Column(Integer, default=0, comment='投放分享量')
    organic_shares = Column(Integer, default=0, comment='自然分享量（总-投）')

    # ===== 总互动量拆分 =====
    total_interactions = Column(Integer, default=0, comment='总互动量（点赞+评论+收藏+分享，投放+自然）')
    ad_interactions = Column(Integer, default=0, comment='投放互动量')
    organic_interactions = Column(Integer, default=0, comment='自然互动量（总-投）')

    # ===== 私信指标拆分 =====
    total_private_messages = Column(Integer, default=0, comment='总私信进线量（投放+自然）')
    ad_private_messages = Column(Integer, default=0, comment='投放私信进线量')
    organic_private_messages = Column(Integer, default=0, comment='自然私信进线量（总-投）')

    # ===== 转化指标 (来自 backend_conversions，按 note_id 关联) =====
    lead_users = Column(Integer, default=0, comment='加微量（线索人数，去重）')
    customer_mouth_users = Column(Integer, default=0, comment='开口量（客户开口人数，去重）')
    valid_lead_users = Column(Integer, default=0, comment='有效线索量（去重）')
    opened_account_users = Column(Integer, default=0, comment='开户量（开户人数，去重）')
    valid_customer_users = Column(Integer, default=0, comment='有效户量（去重）')

    # ===== 资产指标 (来自 backend_conversions) =====
    customer_assets_users = Column(Integer, default=0, comment='有资产人数（去重）')
    customer_assets_amount = Column(Numeric(15, 2), default=0, comment='资产总量（元）')

    # ===== 元数据 =====
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    __table_args__ = (
        # 唯一约束：同一日期+笔记ID只有一条记录
        db.UniqueConstraint('date', 'note_id', name='idx_notes_daily_unique'),
    )


# ============================================
# 报告生成相关表
# ============================================

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
