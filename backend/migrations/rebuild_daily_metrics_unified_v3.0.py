# -*- coding: utf-8 -*-
"""
数据库迁移脚本：重建 daily_metrics_unified 表为 v3.0
版本: v3.0
日期: 2026-01-19

变更说明：
1. 简化表结构，删除冗余字段
2. 新增 potential_customers 字段（潜客人数）
3. agency 和 business_model 可以为空（支持未能关联的转化数据）
4. 明确数据来源和关联逻辑
"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import db
from sqlalchemy import text
from app import app


def backup_old_table():
    """备份旧表"""
    print("\n1. 备份旧表...")
    try:
        # 表名包含小数点，需要用方括号或双引号括起来
        db.session.execute(text('DROP TABLE IF EXISTS [daily_metrics_unified_v2.4_backup];'))
        db.session.execute(text("""
            ALTER TABLE daily_metrics_unified
            RENAME TO [daily_metrics_unified_v2.4_backup];
        """))
        db.session.commit()
        print("   [OK] 旧表已备份为 daily_metrics_unified_v2.4_backup")
    except Exception as e:
        db.session.rollback()
        print(f"   [ERROR] 备份失败: {str(e)}")
        raise


def create_new_table():
    """创建新表"""
    print("\n2. 创建新表...")

    sql = """
    CREATE TABLE daily_metrics_unified (
        -- 主键
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- 聚合维度
        date DATE NOT NULL,
        platform VARCHAR(50) NOT NULL,
        agency VARCHAR(100),
        business_model VARCHAR(50),

        -- 广告指标（来自3张广告表）
        cost DECIMAL(10, 2) DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        click_users INTEGER DEFAULT 0,

        -- 转化指标（来自 backend_conversions 表）
        lead_users INTEGER DEFAULT 0,
        potential_customers INTEGER DEFAULT 0,
        customer_mouth_users INTEGER DEFAULT 0,
        valid_lead_users INTEGER DEFAULT 0,
        opened_account_users INTEGER DEFAULT 0,
        valid_customer_users INTEGER DEFAULT 0,

        -- 辅助字段（用于数据关联，不作为聚合维度）
        account_id VARCHAR(50),
        account_name VARCHAR(200),

        -- 元数据
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    try:
        db.session.execute(text(sql))
        db.session.commit()
        print("   [OK] 新表创建成功")
    except Exception as e:
        db.session.rollback()
        print(f"   [ERROR] 创建表失败: {str(e)}")
        raise


def create_indexes():
    """创建索引"""
    print("\n3. 创建索引...")

    indexes = [
        # 基础索引
        ('idx_date_v3', 'CREATE INDEX idx_date_v3 ON daily_metrics_unified(date)'),
        ('idx_platform_v3', 'CREATE INDEX idx_platform_v3 ON daily_metrics_unified(platform)'),
        ('idx_agency_v3', 'CREATE INDEX idx_agency_v3 ON daily_metrics_unified(agency)'),
        ('idx_business_model_v3', 'CREATE INDEX idx_business_model_v3 ON daily_metrics_unified(business_model)'),

        # 复合索引
        ('idx_date_platform_v3', 'CREATE INDEX idx_date_platform_v3 ON daily_metrics_unified(date, platform)'),
        ('idx_date_agency_v3', 'CREATE INDEX idx_date_agency_v3 ON daily_metrics_unified(date, agency)'),
        ('idx_platform_bm_v3', 'CREATE INDEX idx_platform_bm_v3 ON daily_metrics_unified(platform, business_model)'),

        # 复合唯一索引（支持 NULL 值）
        ('idx_unique_metrics_v3', '''
            CREATE UNIQUE INDEX idx_unique_metrics_v3
            ON daily_metrics_unified(date, platform, COALESCE(agency, ''), COALESCE(business_model, ''))
        ''')
    ]

    for index_name, index_sql in indexes:
        try:
            db.session.execute(text(index_sql))
            db.session.commit()
            print(f"   [OK] {index_name} created")
        except Exception as e:
            db.session.rollback()
            print(f"   [WARNING] Failed to create {index_name}: {str(e)}")


def create_triggers():
    """创建触发器（自动更新 updated_at）"""
    print("\n4. 创建触发器...")

    trigger_sql = """
    CREATE TRIGGER update_daily_metrics_unified_timestamp
    AFTER UPDATE ON daily_metrics_unified
    FOR EACH ROW
    BEGIN
        UPDATE daily_metrics_unified SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
    """

    try:
        db.session.execute(text(trigger_sql))
        db.session.commit()
        print("   [OK] Trigger created")
    except Exception as e:
        db.session.rollback()
        print(f"   [WARNING] Failed to create trigger: {str(e)}")
        print("   Note: SQLite trigger may have limitations")


def show_table_info():
    """显示新表结构"""
    print("\n5. 表结构信息...")

    try:
        result = db.session.execute(text("PRAGMA table_info(daily_metrics_unified);"))
        columns = result.fetchall()

        print("\n   字段列表:")
        print("   " + "-" * 80)
        print("   {:<25} {:<15} {:<10} {:<30}".format("字段名", "类型", "是否必填", "说明"))
        print("   " + "-" * 80)

        descriptions = {
            'id': ('INTEGER', 'YES', '主键'),
            'date': ('DATE', 'YES', '日期'),
            'platform': ('VARCHAR(50)', 'YES', '平台'),
            'agency': ('VARCHAR(100)', 'NO', '代理商（可为空）'),
            'business_model': ('VARCHAR(50)', 'NO', '业务模式（可为空）'),
            'cost': ('DECIMAL(10,2)', 'NO', '花费'),
            'impressions': ('INTEGER', 'NO', '展示'),
            'click_users': ('INTEGER', 'NO', '点击人数'),
            'lead_users': ('INTEGER', 'NO', '线索人数'),
            'potential_customers': ('INTEGER', 'NO', '潜客人数'),
            'customer_mouth_users': ('INTEGER', 'NO', '开口人数'),
            'valid_lead_users': ('INTEGER', 'NO', '有效人数'),
            'opened_account_users': ('INTEGER', 'NO', '开户人数'),
            'valid_customer_users': ('INTEGER', 'NO', '有效户人数'),
            'account_id': ('VARCHAR(50)', 'NO', '账号ID（辅助字段）'),
            'account_name': ('VARCHAR(200)', 'NO', '账号名称（辅助字段）'),
            'created_at': ('TIMESTAMP', 'NO', '创建时间'),
            'updated_at': ('TIMESTAMP', 'NO', '更新时间')
        }

        for col in columns:
            col_id, name, type_name, notnull, default_value, primary_key = col
            type_str, required_str, desc = descriptions.get(name, (type_name, 'NO', ''))
            required_str = 'YES' if notnull == 1 else 'NO'
            print("   {:<25} {:<15} {:<10} {:<30}".format(name, type_str, required_str, desc))

    except Exception as e:
        print(f"   [ERROR] Failed to get table info: {str(e)}")


def upgrade():
    """执行迁移"""
    print("=" * 80)
    print("开始数据库迁移 v3.0...")
    print("=" * 80)

    with app.app_context():
        try:
            # 1. 备份旧表
            backup_old_table()

            # 2. 创建新表
            create_new_table()

            # 3. 创建索引
            create_indexes()

            # 4. 创建触发器
            create_triggers()

            # 5. 显示表结构
            show_table_info()

            print("\n" + "=" * 80)
            print("[SUCCESS] 数据库迁移 v3.0 完成！")
            print("=" * 80)
            print("\n下一步：")
            print("1. 运行数据聚合脚本：python backend/scripts/aggregations/update_daily_metrics_unified.py")
            print("2. 测试转化漏斗报表")

        except Exception as e:
            print("\n" + "=" * 80)
            print(f"[ERROR] 迁移失败: {str(e)}")
            print("=" * 80)
            print("\n回滚方案：")
            print("1. 删除新表：DROP TABLE daily_metrics_unified;")
            print("2. 恢复旧表：ALTER TABLE daily_metrics_unified_v2.4_backup RENAME TO daily_metrics_unified;")
            raise


def rollback():
    """回滚迁移"""
    print("=" * 80)
    print("开始回滚数据库迁移 v3.0...")
    print("=" * 80)

    with app.app_context():
        try:
            print("\n1. 删除新表...")
            db.session.execute(text("DROP TABLE IF EXISTS daily_metrics_unified;"))
            db.session.commit()
            print("   [OK] 新表已删除")

            print("\n2. 恢复旧表...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified_v2.4_backup
                RENAME TO daily_metrics_unified;
            """))
            db.session.commit()
            print("   [OK] 旧表已恢复")

            print("\n" + "=" * 80)
            print("[SUCCESS] 回滚完成！")
            print("=" * 80)

        except Exception as e:
            db.session.rollback()
            print(f"\n[ERROR] 回滚失败: {str(e)}")
            raise


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='数据库迁移 v3.0')
    parser.add_argument('--rollback', action='store_true', help='回滚迁移')
    parser.add_argument('--yes', action='store_true', help='跳过确认，自动执行')

    args = parser.parse_args()

    if args.rollback:
        print("\n[WARNING] 即将回滚到 v2.4 版本！")
        if args.yes:
            print("自动执行：开始回滚...")
            rollback()
        else:
            confirm = input("确认回滚？(yes/no): ")
            if confirm.lower() == 'yes':
                rollback()
            else:
                print("回滚已取消")
    else:
        print("\n即将重建 daily_metrics_unified 表！")
        print("旧表将备份为 daily_metrics_unified_v2.4_backup")
        if args.yes:
            print("自动执行：开始迁移...")
            upgrade()
        else:
            confirm = input("确认执行？(yes/no): ")
            if confirm.lower() == 'yes':
                upgrade()
            else:
                print("迁移已取消")
