# -*- coding: utf-8 -*-
"""
数据库迁移脚本：删除 weekly_reports 表中的 HTML 字段

优化设计：
- 删除 report_html 和 report_css 字段
- 只保留业务数据字段
- HTML模板由前端动态生成
"""

import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, project_root)

os.chdir(project_root)

from app import app
from backend.database import db
import sqlalchemy as sa


def migrate():
    """执行迁移"""
    with app.app_context():
        print("[INFO] 开始迁移：删除 weekly_reports 表的 HTML 字段...")
        print()

        # 检查表是否存在
        inspector = sa.inspect(db.engine)
        tables = inspector.get_table_names()

        if 'weekly_reports' not in tables:
            print("[ERROR] weekly_reports 表不存在，请先创建表")
            return False

        # 检查字段是否存在
        columns = [col['name'] for col in inspector.get_columns('weekly_reports')]

        fields_to_remove = ['report_html', 'report_css']
        existing_fields = [f for f in fields_to_remove if f in columns]

        if not existing_fields:
            print("[INFO] 指定字段不存在，无需删除")
            print(f"[INFO] 当前字段: {', '.join(columns)}")
            return True

        print(f"[INFO] 将删除以下字段: {', '.join(existing_fields)}")

        # 执行删除
        try:
            with db.engine.connect() as conn:
                for field in existing_fields:
                    sql = f"ALTER TABLE weekly_reports DROP COLUMN {field}"
                    conn.execute(sa.text(sql))
                    conn.commit()
                    print(f"[OK] 已删除字段: {field}")

            print()
            print("[OK] 迁移完成！")
            print()

            # 显示当前表结构
            inspector = sa.inspect(db.engine)
            new_columns = [col['name'] for col in inspector.get_columns('weekly_reports')]
            print(f"[INFO] 当前字段列表 ({len(new_columns)}个):")
            for i, col in enumerate(new_columns, 1):
                print(f"     {i:2d}. {col}")

            return True

        except Exception as e:
            print(f"[ERROR] 迁移失败: {str(e)}")
            return False


if __name__ == '__main__':
    print("=" * 60)
    print("数据库迁移：删除 weekly_reports HTML 字段")
    print("=" * 60)
    print()

    success = migrate()

    print()
    print("=" * 60)
    if success:
        print("[SUCCESS] 迁移成功完成")
    else:
        print("[FAILED] 迁移失败")
    print("=" * 60)
