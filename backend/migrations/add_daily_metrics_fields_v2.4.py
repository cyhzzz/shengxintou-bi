# -*- coding: utf-8 -*-
"""
数据库迁移脚本：添加 daily_metrics_unified 表的转化相关字段
版本: v2.4
日期: 2026-01-19

运行方式:
    python backend/migrations/add_daily_metrics_fields_v2.4.py
"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import db
from sqlalchemy import text
from app import app

def upgrade():
    """添加新字段"""
    with app.app_context():
        print("Starting database migration v2.4...")

        try:
            # 1. 添加 click_users 字段
            print("1. Adding click_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN click_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] click_users field added")

            # 2. 添加 lead_users 字段
            print("2. Adding lead_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN lead_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] lead_users field added")

            # 3. 添加 customer_mouth_users 字段
            print("3. Adding customer_mouth_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN customer_mouth_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] customer_mouth_users field added")

            # 4. 添加 valid_lead_users 字段
            print("4. Adding valid_lead_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN valid_lead_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] valid_lead_users field added")

            # 5. 添加 customer_users 字段
            print("5. Adding customer_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN customer_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] customer_users field added")

            # 6. 添加 opened_account_users 字段
            print("6. Adding opened_account_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN opened_account_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] opened_account_users field added")

            # 7. 添加 valid_customer_users 字段
            print("7. Adding valid_customer_users field...")
            db.session.execute(text("""
                ALTER TABLE daily_metrics_unified
                ADD COLUMN valid_customer_users INTEGER DEFAULT 0;
            """))
            db.session.commit()
            print("   [OK] valid_customer_users field added")

            # 8. 创建索引
            print("8. Creating indexes...")
            try:
                # 复合唯一索引
                db.session.execute(text("""
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_metrics
                    ON daily_metrics_unified(date, platform, agency, business_model);
                """))
                db.session.commit()
                print("   [OK] Composite unique index created")
            except Exception as e:
                print(f"   [WARNING] Failed to create unique index (may already exist): {str(e)}")

            try:
                # 日期+平台索引
                db.session.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_date_platform
                    ON daily_metrics_unified(date, platform);
                """))
                db.session.commit()
                print("   [OK] Date+Platform index created")
            except Exception as e:
                print(f"   [WARNING] Failed to create date+platform index: {str(e)}")

            try:
                # 日期+代理商索引
                db.session.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_date_agency
                    ON daily_metrics_unified(date, agency);
                """))
                db.session.commit()
                print("   [OK] Date+Agency index created")
            except Exception as e:
                print(f"   [WARNING] Failed to create date+agency index: {str(e)}")

            try:
                # 平台+业务模式索引
                db.session.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_platform_bm
                    ON daily_metrics_unified(platform, business_model);
                """))
                db.session.commit()
                print("   [OK] Platform+BusinessModel index created")
            except Exception as e:
                print(f"   [WARNING] Failed to create platform+business model index: {str(e)}")

            print("\n[SUCCESS] Database migration v2.4 completed!")
            print("\nNew fields added:")
            print("  - click_users: Click users (deduplicated)")
            print("  - lead_users: Lead users (deduplicated, is_valid_lead=true)")
            print("  - customer_mouth_users: Customer mouth users (deduplicated, is_customer_mouth=true)")
            print("  - valid_lead_users: Valid lead users (deduplicated)")
            print("  - customer_users: Customer users (deduplicated, is_customer=true)")
            print("  - opened_account_users: Opened account users (deduplicated, is_opened_account=true)")
            print("  - valid_customer_users: Valid customer users (deduplicated, is_valid_customer=true)")

        except Exception as e:
            db.session.rollback()
            print(f"\n[ERROR] Migration failed: {str(e)}")
            raise


def downgrade():
    """回滚：删除新字段"""
    with app.app_context():
        print("Starting rollback of database migration v2.4...")

        try:
            # SQLite 不支持 DROP COLUMN，需要重建表
            print("[WARNING] SQLite does not support DROP COLUMN")
            print("To rollback:")
            print("  1. Backup database")
            print("  2. Drop table: DROP TABLE daily_metrics_unified;")
            print("  3. Re-run: python init_db.py")
            print("  4. Restore data if needed")

        except Exception as e:
            db.session.rollback()
            print(f"\n[ERROR] Rollback failed: {str(e)}")
            raise


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Database migration v2.4')
    parser.add_argument('--rollback', action='store_true', help='Rollback migration')

    args = parser.parse_args()

    if args.rollback:
        print("WARNING: This will remove new fields, cannot be undone!")
        confirm = input("Confirm rollback? (yes/no): ")
        if confirm.lower() == 'yes':
            downgrade()
        else:
            print("Rollback cancelled")
    else:
        upgrade()
