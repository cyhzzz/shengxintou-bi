# -*- coding: utf-8 -*-
"""
省心投 BI - v2 库表 ORM 模型（基于 docs/库表重构设计_v2.md）

7 张表：DIM × 1（dim_account）
       + DWD × 2（fact_conv_content / fact_conv_appmarket）
       + DWS × 3（agg_vendor_daily / agg_xhs_note / agg_daily_channel_open）

原则：源表 1:1 原样存（保留全部原始列，含中文列名），加载期只做规范（已在 ETL 完成）。
"""

from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, Date, DateTime, Numeric, Float, Index
from sqlalchemy.types import Uuid
from backend.database import db


# ============================================================================
# DIM 维度层
# ============================================================================

class DimAccount(db.Model):
    """投放账号维度（含代理商信息：名称/简称/字母简称）"""
    __tablename__ = 'dim_account'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    序号 = Column(BigInteger)
    platform = Column(Text)                  # 平台
    main_account_id = Column(Text)           # 主账号ID
    main_account_name = Column(Text)         # 主账号名称
    sub_account_id = Column(Text)            # 子账号ID
    sub_account_name = Column(Text)          # 子账号名称
    agency_name = Column(Text)               # 代理商名称
    agency_short = Column(Text)              # 代理商简称
    agency_letter = Column(Text)             # 代理商字母简称
    business_model = Column(Text)            # 业务模式


class DimAnchorLiveType(db.Model):
    """主播直播类型映射维度

    每行 = 一个 source_token（fact_conv_content.客户来源 字段按 [,，;；] 分隔后的单段）
    → 主播名 + 直播类型 的映射关系。

    业务规则：
    - source_token 是原始字符串，如 "抖音引流-黄天平" / "黄天平" / "直播带货-吴晓字"
    - anchor_name 是归一化后的主播名（含错字校正，如 "直播带货-吴晓字" → anchor_name="吴晓宇"）
    - live_type 取值：分析师 / 投顾IP / 投顾配合做带货 / 带货直播
    - remark 备注（如"总部投顾""分支投顾""错字校正"等）

    token 形式 → live_type 规则：
    - 纯人名（"黄天平"）→ 投顾IP（分支投顾自IP）
    - 视频号引流-人名 / 财联社引流-人名 → 投顾IP
    - 抖音引流-人名（分支投顾）→ 投顾配合做带货
    - 抖音引流-人名（总部投顾/分析师/带货主播）→ 按其本身类型
    - 抖音引流-直播带货-人名 → 投顾配合做带货
    - 直播带货-人名（主播=带货主播）→ 带货直播
    - 直播带货-人名（主播=投顾）→ 投顾配合做带货
    - 小鹅通直播-人名 → 按主播本身类型
    """
    __tablename__ = 'dim_anchor_live_type'

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_token = Column(Text, unique=True, nullable=False, index=True)   # 原始 token，主键
    anchor_name = Column(Text, nullable=False, index=True)                 # 归一化主播名
    live_type = Column(Text, nullable=False, index=True)                   # 分析师/投顾IP/投顾配合做带货/带货直播
    remark = Column(Text)                                                   # 备注
    is_active = Column(Integer, default=1, nullable=False)                  # 1=启用 0=禁用
    updated_at = Column(DateTime, nullable=False)                          # 最后修改时间


class DimAdPlanClass(db.Model):
    """应用市场广告计划分类维度（← 广告计划分类表.xlsx，1 行=1 广告分组）

    广告投放侧的分类维度表，把每个「广告分组ID」按应用市场 + 版位 + 子版位
    + 出价方式归类，用于后续「应用市场计划分解」分析（与应用市场下载链路
    fact_conv_appmarket.广告计划ID 关联，拆解各分组/版位的获客贡献）。

    导入规则（v2 原样导入，仅格式层规范）：
    - 应用市场：源表可能为 OPPO/VIVO 大写，落库统一 .lower() → oppo/vivo，
      与 fact_conv_appmarket / 归因白名单口径一致
    - 仅保留 7 大应用市场（oppo/vivo/荣耀/小米/华为/鸿蒙/苹果），其余丢弃
    - 广告分组ID：超长 ID 安全转字符串，避免 SQLite INTEGER 上限溢出
    - 覆盖写入（replace），无中间计算
    """
    __tablename__ = 'dim_ad_plan_class'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    应用市场 = Column(Text, index=True)                 # oppo/vivo/荣耀/小米/华为/鸿蒙/苹果
    广告分组ID = Column(BigInteger, index=True)         # 关联 fact_conv_appmarket.广告计划ID
    广告分组名称 = Column(Text)
    版位 = Column(Text)
    子版位 = Column(Text)
    出价 = Column(Text)                                 # 出价方式（ocpd付费/开始开户/CPD...）


# ============================================================================
# DWD 明细层
# ============================================================================

class FactConvContent(db.Model):
    """内容平台加微链路明细（← 4线索明细，1 行=1 企微）"""
    __tablename__ = 'fact_conv_content'

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    微信昵称 = Column(Text)
    资金账号 = Column(Text)
    开户营业部 = Column(Text)
    客户性别 = Column(Text)
    平台来源 = Column(Text)                  # 注：源表叫"平台来源"，非"平台"
    流量类型 = Column(Text)
    客户来源 = Column(Text)
    是否客户开口 = Column(BigInteger)
    是否有效线索 = Column(BigInteger)
    是否开户中断 = Column(BigInteger)
    开户中断日期 = Column(Text)
    是否开户 = Column(BigInteger)
    是否为有效户 = Column(BigInteger)
    是否为存量客户 = Column(BigInteger)
    是否为存量有效户 = Column(BigInteger)
    是否删除企微 = Column(BigInteger)
    线索日期 = Column(Text)
    首次触达时间 = Column(Text)
    最近互动时间 = Column(Text)
    互动次数 = Column(BigInteger)
    营销人员互动次数 = Column(Float)
    添加员工号 = Column(BigInteger)
    添加员工姓名 = Column(Text)
    开户时间 = Column(Text)
    微信认证状态 = Column(Float)
    微信认证时间 = Column(Text)
    有效户时间 = Column(Text)
    资产 = Column(Float)
    客户贡献 = Column(Float)
    广告账号 = Column(Text)
    广告代理商 = Column(Text)
    广告ID = Column(Text)
    创意ID = Column(Text)
    笔记ID = Column(Text)
    笔记名称 = Column(Text)
    平台用户ID = Column(Text)
    平台用户昵称 = Column(Text)
    广告点击日期 = Column(Text)
    生产者 = Column(Text)
    企微标签 = Column(Text)


class FactConvAppmarket(db.Model):
    """应用市场下载链路明细（← 8.1 应用市场归因明细，1 行=1 APP 下载）"""
    __tablename__ = 'fact_conv_appmarket'
    __table_args__ = (
        Index('idx_appmarket_dev_date', '设备号', '下载日期'),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    数据更新日期 = Column(Text)
    设备号 = Column(Text)
    应用市场 = Column(Text)                  # 注：实际值可能是 oppo/vivo 小写
    投放账号 = Column(Text)
    下载日期 = Column(Text)
    广告计划ID = Column(BigInteger)
    注册手机号 = Column(Text)
    是否激活APP = Column(BigInteger)
    APP激活时间 = Column(Text)
    是否开户注册 = Column(BigInteger)
    注册开户流程时间 = Column(Text)
    是否注册身份证 = Column(BigInteger)
    注册身份证时间 = Column(Text)
    是否注册银行卡 = Column(BigInteger)
    注册银行卡时间 = Column(Text)
    是否提交开户 = Column(BigInteger)
    提交开户时间 = Column(Text)
    是否开户成功 = Column(BigInteger)
    开户成功时间 = Column(Text)
    是否新开户 = Column(BigInteger)
    是否入金 = Column(BigInteger)
    是否有效户 = Column(BigInteger)
    有效户时间 = Column(Text)
    是否存量客户 = Column(BigInteger)
    总资产 = Column(Float)
    累计创收 = Column(Float)
    人均日创收 = Column(Float)
    开户时间 = Column(Text)
    渠道类型 = Column(Text)
    应用市场名称 = Column(Text)
    是否创建完资金账号 = Column(BigInteger)
    资金账号创建完成时间 = Column(Text)
    资金账号 = Column(Text)
    归属营业部 = Column(Text)
    归属营业部名称 = Column(Text)


# ============================================================================
# DWS 聚合层
# ============================================================================

class AggVendorDaily(db.Model):
    """厂商日聚合（统一漏斗超集；← 厂商广告投放分析 Sheet1）

    APP* 列 = 应用市场值（APP下载数/激活数）
    开口/潜在客户/有效线索 列 = 内容平台值
    """
    __tablename__ = 'agg_vendor_daily'

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    日期 = Column(Text)                      # 日级 YYYY-MM-DD
    月 = Column(Text)                        # YYYY-MM
    平台 = Column(Text)
    厂商 = Column(Text)
    业务模式 = Column(Text)
    花费 = Column(Float)
    展示量 = Column(BigInteger)
    点击量 = Column(BigInteger)
    线索数 = Column(BigInteger)
    APP下载数 = Column(BigInteger)            # 应用市场
    潜在客户数 = Column(BigInteger)          # 内容平台
    开口人数 = Column(BigInteger)            # 内容平台
    APP激活人数 = Column(BigInteger)          # 应用市场
    有效线索数 = Column(BigInteger)
    开户人数 = Column(BigInteger)
    有效户人数 = Column(BigInteger)
    客户资产 = Column(Float)
    客户创收 = Column(Float)
    存量客户资产 = Column(Float)
    点击率 = Column(Float)
    线索成本 = Column(Float)
    APP下载成本 = Column(Float)
    APP激活成本 = Column(Float)
    开户成本 = Column(Float)
    有效户成本 = Column(Float)
    线索转化率 = Column(Float)
    开户转化率 = Column(Float)
    计划ID = Column(BigInteger)            # 广告计划ID（与 dim_ad_plan_class.广告分组ID 关联）
    计划名称 = Column(Text)


class AggXhsNote(db.Model):
    """小红书笔记聚合（← 6.1 小红书笔记表）"""
    __tablename__ = 'agg_xhs_note'

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    笔记ID = Column(Text)
    笔记标题 = Column(Text)
    笔记类型 = Column(Text)
    内容类型 = Column(Text)
    笔记账号 = Column(Text)
    创作者 = Column(Text)
    广告策略 = Column(Text)
    发布时间 = Column(Text)
    总展现量 = Column(BigInteger)
    点击量 = Column(BigInteger)
    总点击率 = Column(Float)
    总互动量 = Column(BigInteger)
    消费金额 = Column(Float)
    推广展现量 = Column(BigInteger)
    推广点击量 = Column(BigInteger)
    推广点击率 = Column(Float)
    推广互动量 = Column(BigInteger)
    私信进线人数 = Column(BigInteger)
    添加企微人数 = Column(BigInteger)
    企微成功添加人数 = Column(BigInteger)
    加微成本 = Column(Float)
    开户人数 = Column(BigInteger)
    开户成本 = Column(Float)
    笔记链接 = Column(Text)


class AggDailyChannelOpen(db.Model):
    """渠道开户聚合（← 0.1 开户渠道分析明细，开户渠道分析 sheet）

    注：渠道类别用"互联网引流/合作机构/自然流入/员工开户"四种业务口径。
    无"应用市场"类（2 月口径，应用市场未归入此类统计）。
    """
    __tablename__ = 'agg_daily_channel_open'

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    时间区间 = Column(Text)
    渠道类别 = Column(Text)
    渠道名称 = Column(Text)
    开户成功人数 = Column(BigInteger)
    入金户数 = Column(BigInteger)
    入金率 = Column(Float)
    有效户数 = Column(BigInteger)
    有效户率 = Column(Float)


# ============================================================================
# 外部对账数据层
# ============================================================================

class FactQingniaoLeads(db.Model):
    """青鸟线索通回传明细（v3.3.6 新增，1 行=1 条青鸟回传线索）

    用于与 fact_conv_content 抖音引流线索做标志位对账：
    - 青鸟侧 3 个标志位（微信用户首次消息 / 微信用户确认意向 / 开户）
      取值「未打」/「已打」字符串
    - 系统侧对应 3 个标志位（是否客户开口 / 是否有效线索 / 是否开户）
      取值 0/1 整数

    对账匹配字段：微信线索昵称 + 日期（与系统侧 微信昵称 + 线索日期 联合匹配）。

    注：列名 1:1 对齐青鸟 Excel 原始表头（含空格的列名「计划 ID」「创意 ID」「素材 ID」「广告 ID」
    保留空格，符合 v2 原样入库原则）。
    """
    __tablename__ = 'fact_qingniao_leads'

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    微信线索昵称 = Column(Text, index=True)             # 客户微信昵称（对应系统 fact_conv_content.微信昵称）
    日期 = Column(Text, index=True)                    # 青鸟侧记录日期 'YYYY-MM-DD'
    广告账户ID = Column(Text)
    计划ID = Column('计划 ID', Text)                    # 列名带空格，与 Excel 表头一致
    计划名称 = Column(Text)
    创意ID = Column('创意 ID', Text)
    素材ID = Column('素材 ID', Text)
    微信号码包ID = Column(Text)
    微信号码包名称 = Column(Text)
    客服微信昵称 = Column(Text)
    广告ID = Column('广告 ID', Text)
    广告名称 = Column(Text)
    用户抖音号 = Column(Text)
    用户抖音昵称 = Column(Text)
    接待抖音号 = Column(Text)
    微信用户首次消息 = Column(Text)                    # 「未打」/「已打」 → 对账「开口」标志
    微信用户确认意向 = Column(Text)                    # 「未打」/「已打」 → 对账「有效」标志
    开户 = Column(Text)                                # 「未打」/「已打」 → 对账「开户」标志
    批次标注 = Column(Text, index=True)                 # 导入批次标注（用户输入或默认时间戳），用于多次对账数据区分


# ============================================================================
# 用户鉴权元数据（feat-cloud-supabase 引入）
# ============================================================================

class UserProfile(db.Model):
    """用户业务元数据。

    设计：Supabase Auth 在 auth.users 表里保管登录凭据（邮箱/密码/Token），
    本表只存"业务侧需要的元数据"。id 直接用 auth.users.id 的 UUID，作为本表主键。
    关系上 auth.users 是 Supabase 自管的（位于 auth schema），本表只"引用"它的 id。
    """
    __tablename__ = 'user_profiles'

    id = Column(Uuid, primary_key=True)               # 对应 auth.users.id (UUID)
    email = Column(Text)                              # 冗余：减少 join auth.users，便于审计
    display_name = Column(Text)                        # 显示名
    department = Column(Text)                          # 部门（业务侧自由录入，本期未启用部门权限）
    role = Column(Text, default='viewer')              # 角色：viewer/admin/...
    is_active = Column(Integer, default=1)             # 1=启用 0=禁用
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # 创建时间
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)  # 最后修改时间


# ============================================================================
# 本地鉴权用户（feat-local-auth：方案 A，绕过 Supabase Auth API）
# ============================================================================

class AppUser(db.Model):
    """本地鉴权用户表（方案 A）。

    设计：
    - 不依赖 Supabase Auth API（避免网络层 TLS 重置问题）
    - 密码用 werkzeug.security.generate_password_hash 存储（PBKDF2-SHA256）
    - 后端自签 JWT（PyJWT），中间件用 jwt.decode 验证，零网络调用
    - id 用 BIGSERIAL（PG）或 INTEGER PRIMARY KEY AUTOINCREMENT（SQLite）
    - email 唯一索引，登录用 email + password
    - role/is_active 与 UserProfile 同义，但直接在本表查询，避免 join

    与 UserProfile 的关系：本表完全替代 UserProfile + auth.users 的鉴权职责。
    UserProfile 表保留供历史代码引用，但不再参与鉴权流程。
    """
    __tablename__ = 'app_users'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(Text, unique=True, nullable=False, index=True)  # 登录邮箱
    password_hash = Column(Text, nullable=False)                   # werkzeug PBKDF2-SHA256
    display_name = Column(Text)                                     # 显示名
    department = Column(Text)                                       # 部门
    role = Column(Text, default='viewer', nullable=False)          # viewer/admin
    is_active = Column(Integer, default=1, nullable=False)          # 1=启用 0=禁用
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

