# -*- coding: utf-8 -*-
"""
省心投 BI - 数据库初始化脚本
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import create_engine, Index, UniqueConstraint
from backend.models import (
    Base, RawAdDataTencent, RawAdDataDouyin, RawAdDataXiaohongshu,
    XhsNotesDaily, XhsNotesMapping, BackendConversions,
    AccountAgencyMapping, DailyMetricsUnified
)
from config import DATABASE_PATH

# 确保database目录存在
database_dir = os.path.dirname(DATABASE_PATH)
if not os.path.exists(database_dir):
    os.makedirs(database_dir)
    print(f"✓ 创建数据库目录: {database_dir}")

# 创建数据库引擎
engine = create_engine(f'sqlite:///{DATABASE_PATH}', echo=True)

def init_database():
    """初始化数据库表"""

    print("=" * 60)
    print("省心投 BI - 数据库初始化")
    print("=" * 60)
    print(f"数据库路径: {DATABASE_PATH}")
    print()

    # 删除所有表（如果存在）- 仅用于开发环境
    # Base.metadata.drop_all(engine)

    # 创建所有表
    Base.metadata.create_all(engine)

    print()
    print("=" * 60)
    print("数据库表创建完成！")
    print("=" * 60)
    print()
    print("已创建的表:")

    # 列出所有创建的表
    tables = [
        ('腾讯广告原始数据表', 'raw_ad_data_tencent'),
        ('抖音广告原始数据表', 'raw_ad_data_douyin'),
        ('小红书广告原始数据表', 'raw_ad_data_xiaohongshu'),
        ('小红书笔记日级数据表', 'xhs_notes_daily'),
        ('小红书笔记映射表', 'xhs_notes_mapping'),
        ('后端转化明细表', 'backend_conversions'),
        ('账号代理商映射表', 'account_agency_mapping'),
        ('统一日级指标聚合表', 'daily_metrics_unified'),
    ]

    for desc, table_name in tables:
        print(f"  [OK] {desc:30s} ({table_name})")

    print()
    print("数据库初始化完成！")
    print(f"数据库文件位置: {DATABASE_PATH}")
    print()


if __name__ == '__main__':
    init_database()
