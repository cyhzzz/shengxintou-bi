# -*- coding: utf-8 -*-
"""
数据库迁移脚本：智能添加缺失字段
版本: v2.4
日期: 2026-01-19
"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import db
from sqlalchemy import text, inspect
from app import app

# 需要添加的字段定义
REQUIRED_FIELDS = {
    'click_users': 'INTEGER DEFAULT 0',
    'lead_users': 'INTEGER DEFAULT 0',
    'customer_mouth_users': 'INTEGER DEFAULT 0',
    'valid_lead_users': 'INTEGER DEFAULT 0',
    'customer_users': 'INTEGER DEFAULT 0',
    'opened_account_users': 'INTEGER DEFAULT 0',
    'valid_customer_users': 'INTEGER DEFAULT 0'
}

def get_existing_columns():
    """获取表中已存在的字段"""
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('daily_metrics_unified')]
    return columns

def upgrade():
    """智能添加缺失字段"""
    with app.app_context():
        print("Checking existing fields...")

        # 获取已存在的字段
        existing_columns = get_existing_columns()
        print(f"Existing columns: {existing_columns}")

        # 找出需要添加的字段
        missing_fields = {k: v for k, v in REQUIRED_FIELDS.items() if k not in existing_columns}

        if not missing_fields:
            print("\n[SUCCESS] All required fields already exist!")
            print("\nExisting fields:")
            for field in REQUIRED_FIELDS.keys():
                status = "[OK]" if field in existing_columns else "[MISSING]"
                print(f"  {status} {field}")
            return

        print(f"\nFound {len(missing_fields)} missing fields")
        print("Starting migration...")

        # 添加缺失字段
        for i, (field_name, field_type) in enumerate(missing_fields.items(), 1):
            print(f"{i}. Adding {field_name} field...")
            try:
                db.session.execute(text(f"""
                    ALTER TABLE daily_metrics_unified
                    ADD COLUMN {field_name} {field_type};
                """))
                db.session.commit()
                print(f"   [OK] {field_name} field added")
            except Exception as e:
                db.session.rollback()
                print(f"   [ERROR] Failed to add {field_name}: {str(e)}")
                raise

        print(f"\n[SUCCESS] Migration completed! Added {len(missing_fields)} fields")

        # 创建索引
        print("\nCreating indexes...")
        create_indexes()

def create_indexes():
    """创建索引"""
    indexes = [
        ('idx_unique_metrics', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_metrics ON daily_metrics_unified(date, platform, agency, business_model)'),
        ('idx_date_platform', 'CREATE INDEX IF NOT EXISTS idx_date_platform ON daily_metrics_unified(date, platform)'),
        ('idx_date_agency', 'CREATE INDEX IF NOT EXISTS idx_date_agency ON daily_metrics_unified(date, agency)'),
        ('idx_platform_bm', 'CREATE INDEX IF NOT EXISTS idx_platform_bm ON daily_metrics_unified(platform, business_model)')
    ]

    for index_name, index_sql in indexes:
        try:
            db.session.execute(text(index_sql))
            db.session.commit()
            print(f"   [OK] {index_name} created")
        except Exception as e:
            print(f"   [WARNING] Failed to create {index_name}: {str(e)}")

if __name__ == '__main__':
    upgrade()
