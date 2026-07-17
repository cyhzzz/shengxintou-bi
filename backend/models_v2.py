# -*- coding: utf-8 -*-
"""
省心投 BI - v2 库表 ORM 模型（基于 docs/库表重构设计_v2.md）

7 张表：DIM × 1（dim_account）
       + DWD × 2（fact_conv_content / fact_conv_appmarket）
       + DWS × 3（agg_vendor_daily / agg_xhs_note / agg_daily_channel_open）

原则：源表 1:1 原样存（保留全部原始列，含中文列名），加载期只做规范（已在 ETL 完成）。
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, Date, DateTime, Numeric, Float
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
