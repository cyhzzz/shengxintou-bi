# -*- coding: utf-8 -*-
"""
重命名表：xhs_note_info → xhs_note_info

原因：
- xhs_note_info 名称不够直观
- xhs_note_info 更能体现表的用途：存储笔记的基础信息
"""
import sys
from app import app
from backend.database import db
import sqlalchemy as sa


def migrate():
    """执行迁移：重命名表"""
    with app.app_context():
        print('=== 开始迁移：xhs_note_info → xhs_note_info ===')

        # 检查旧表是否存在
        inspector = sa.inspect(db.engine)
        existing_tables = inspector.get_table_names()

        if 'xhs_note_info' not in existing_tables:
            print('❌ 旧表 xhs_note_info 不存在')
            if 'xhs_note_info' in existing_tables:
                print('✅ 新表 xhs_note_info 已存在，迁移可能已完成')
            return False

        # 备份数据（可选）
        print('📊 备份当前数据...')
        with db.engine.connect() as conn:
            result = conn.execute(sa.text("SELECT COUNT(*) FROM xhs_note_info"))
            count = result.fetchone()[0]
            print(f'   当前记录数: {count}')

        # 重命名表
        print('🔄 重命名表...')
        with db.engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE xhs_note_info RENAME TO xhs_note_info"))
            conn.commit()

        # 验证
        inspector = sa.inspect(db.engine)
        new_tables = inspector.get_table_names()

        if 'xhs_note_info' in new_tables and 'xhs_note_info' not in new_tables:
            print('✅ 表重命名成功！')
            print(f'   旧表名: xhs_note_info')
            print(f'   新表名: xhs_note_info')
            return True
        else:
            print('❌ 表重命名失败')
            return False


if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
