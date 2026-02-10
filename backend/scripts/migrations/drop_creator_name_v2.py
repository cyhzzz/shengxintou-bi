# -*- coding: utf-8 -*-
"""
迁移脚本 v2：删除 creator_name 列（使用 SQLAlchemy）

执行方式：
    cd D:/project/省心投-cc
    python backend/scripts/migrations/drop_creator_name_v2.py
"""

import sys
import os
from pathlib import Path

# 设置项目根目录
project_root = Path(__file__).parent.parent.parent.parent
os.chdir(project_root)
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from config import DATABASE_PATH

# 数据库路径
db_uri = f'sqlite:///{DATABASE_PATH}'
engine = create_engine(db_uri)

print("=" * 60)
print("开始迁移：删除 creator_name 列")
print("=" * 60)
print(f"\n数据库: {DATABASE_PATH}")

with engine.connect() as conn:
    # 1. 检查当前表结构
    print("\n1. 检查当前表结构...")
    result = conn.execute(text("PRAGMA table_info(daily_notes_metrics_unified)"))
    columns = result.fetchall()
    column_names = [col[1] for col in columns]

    print(f"   当前字段数: {len(column_names)}")
    print(f"   creator_name 存在: {'creator_name' in column_names}")

    if 'creator_name' not in column_names:
        print("\ncreator_name 列不存在，无需迁移")
        exit(0)

    # 2. 使用现有事务（SQLAlchemy 自动开启）
    try:
        # 3. 获取原表数据（排除 creator_name）
        print("\n2. 备份数据...")
        result = conn.execute(text("""
            SELECT * FROM daily_notes_metrics_unified
            LIMIT 1
        """))
        original_columns = result.keys()
        columns_to_keep = [col for col in original_columns if col != 'creator_name']

        print(f"   保留字段数: {len(columns_to_keep)}")

        # 4. 创建新表（复制所有字段，除了 creator_name）
        print("\n3. 创建新表...")
        columns_def = []
        for col in columns:
            col_name = col[1]
            if col_name == 'creator_name':
                continue

            col_type = col[2]
            not_null = " NOT NULL" if col[3] else ""
            default = f" DEFAULT {col[4]}" if col[4] is not None else ""

            columns_def.append(f"{col_name} {col_type}{default}{not_null}")

        # 添加主键
        columns_def.insert(0, "id INTEGER PRIMARY KEY AUTOINCREMENT")

        create_sql = f"""
            CREATE TABLE daily_notes_metrics_unified_new (
                {', '.join(columns_def)}
            )
        """
        conn.execute(text(create_sql))

        # 5. 复制数据（排除 creator_name）
        print("\n4. 复制数据...")
        columns_str = ', '.join(columns_to_keep)
        insert_sql = f"""
            INSERT INTO daily_notes_metrics_unified_new ({columns_str})
            SELECT {columns_str}
            FROM daily_notes_metrics_unified
        """
        result = conn.execute(text(insert_sql))
        print(f"   复制记录数: {result.rowcount}")

        # 6. 删除原表
        print("\n5. 删除原表...")
        conn.execute(text("DROP TABLE daily_notes_metrics_unified"))

        # 7. 重命名新表
        print("\n6. 重命名新表...")
        conn.execute(text("ALTER TABLE daily_notes_metrics_unified_new RENAME TO daily_notes_metrics_unified"))

        # 8. 重建索引
        print("\n7. 重建索引...")

        # 日期索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notes_date
            ON daily_notes_metrics_unified(date)
        """))
        print("   - 日期索引")

        # 笔记ID索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notes_note_id
            ON daily_notes_metrics_unified(note_id)
        """))
        print("   - 笔记ID索引")

        # producer索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notes_producer
            ON daily_notes_metrics_unified(producer)
        """))
        print("   - producer索引")

        # 提交事务
        trans.commit()
        print("\n   事务已提交")

    except Exception as e:
        trans.rollback()
        print(f"\n错误: {str(e)}")
        print("事务已回滚")
        raise

    # 9. 验证结果
    print("\n8. 验证迁移结果...")
    result = conn.execute(text("PRAGMA table_info(daily_notes_metrics_unified)"))
    new_columns = result.fetchall()
    new_column_names = [col[1] for col in new_columns]

    print(f"   新字段数: {len(new_column_names)}")
    print(f"   creator_name 已删除: {'creator_name' not in new_column_names}")
    print(f"   publish_account 仍存在: {'publish_account' in new_column_names}")
    print(f"   producer 仍存在: {'producer' in new_column_names}")

    # 检查记录数
    result = conn.execute(text("SELECT COUNT(*) FROM daily_notes_metrics_unified"))
    count = result.fetchone()[0]
    print(f"   总记录数: {count}")

    if 'creator_name' not in new_column_names:
        print("\n迁移成功完成！")
    else:
        print("\n迁移失败：creator_name 列仍然存在")

print("\n" + "=" * 60)
