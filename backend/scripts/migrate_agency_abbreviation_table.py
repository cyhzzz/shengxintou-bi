# -*- coding: utf-8 -*-
"""
迁移代理商简称映射表到新版本

从旧版本（只有 abbreviation + full_name）
迁移到新版本（添加 mapping_type, platform, display_name 等字段）
"""

import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from sqlalchemy import text


def migrate_agency_abbreviation_table():
    """迁移代理商简称映射表到新版本"""

    with app.app_context():
        # 检查表是否存在
        inspector_query = text("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='agency_abbreviation_mapping'
        """)
        result = db.session.execute(inspector_query).fetchone()

        if not result:
            print('[OK] 表不存在，将在第一次初始化时创建')
            return

        print('[INFO] 表已存在，开始检查字段...')

        # 检查 mapping_type 字段是否存在
        check_column_query = text("""
            PRAGMA table_info(agency_abbreviation_mapping)
        """)
        columns = db.session.execute(check_column_query).fetchall()
        column_names = [col[1] for col in columns]

        print(f'[INFO] 当前字段: {", ".join(column_names)}')

        if 'mapping_type' in column_names:
            print('[OK] 表已是新版本，无需迁移')
            return

        print('[INFO] 检测到旧版本表，开始迁移...')

        # 备份旧表数据
        print('[1/3] 备份旧表数据...')
        backup_query = text("""
            CREATE TABLE IF NOT EXISTS agency_abbreviation_mapping_backup AS
            SELECT * FROM agency_abbreviation_mapping
        """)
        db.session.execute(backup_query)
        db.session.commit()
        print('[OK] 备份完成')

        # 删除旧表
        print('[2/3] 删除旧表...')
        drop_query = text("""
            DROP TABLE IF EXISTS agency_abbreviation_mapping
        """)
        db.session.execute(drop_query)
        db.session.commit()
        print('[OK] 旧表已删除')

        # 创建新表（通过 db.create_all）
        print('[3/3] 创建新表...')
        from backend.models import AgencyAbbreviationMapping
        db.create_all()
        db.session.commit()
        print('[OK] 新表已创建')

        # 从备份恢复数据并添加新字段
        print('[INFO] 从备份恢复数据...')
        restore_query = text("""
            INSERT INTO agency_abbreviation_mapping (
                abbreviation, full_name, mapping_type, platform,
                display_name, description, is_active
            )
            SELECT
                abbreviation,
                full_name,
                'agency' as mapping_type,  -- 默认为代理商类型
                NULL as platform,            -- 默认为通用
                full_name as display_name,   -- 显示名称默认为全称
                '从旧版本迁移' as description,
                1 as is_active
            FROM agency_abbreviation_mapping_backup
        """)
        try:
            db.session.execute(restore_query)
            db.session.commit()
            print('[OK] 数据已恢复')
        except Exception as e:
            print(f'[WARNING] 数据恢复失败: {e}')
            print('[INFO] 这可能是因为数据冲突，将使用初始化脚本插入默认数据')

        # 验证
        count_query = text("""
            SELECT COUNT(*) FROM agency_abbreviation_mapping
        """)
        count = db.session.execute(count_query).scalar()
        print(f'\n[完成] 迁移完成，当前有 {count} 条记录')
        print('[提示] 请运行 python backend/scripts/init_agency_abbreviation_mapping.py 插入默认数据')


if __name__ == '__main__':
    migrate_agency_abbreviation_table()
