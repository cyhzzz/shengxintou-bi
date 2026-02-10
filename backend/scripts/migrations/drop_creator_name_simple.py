# -*- coding: utf-8 -*-
"""
简化版迁移脚本：删除 daily_notes_metrics_unified 表的 creator_name 列

执行方式：
    cd "D:\project\省心投-cc"
    python backend/scripts/migrations/drop_creator_name_simple.py
"""

import sqlite3
import os
from pathlib import Path

# 数据库路径
db_path = Path(__file__).parent.parent.parent.parent / 'database' / 'shengxintou.db'

print("=" * 60)
print("开始迁移：删除 creator_name 列")
print("=" * 60)
print(f"\n数据库路径: {db_path}")

if not os.path.exists(db_path):
    print(f"\n❌ 数据库文件不存在: {db_path}")
    exit(1)

# 连接数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. 检查表结构
print("\n1. 检查当前表结构...")
cursor.execute("PRAGMA table_info(daily_notes_metrics_unified)")
columns = cursor.fetchall()
column_names = [col[1] for col in columns]

print(f"   当前字段数: {len(column_names)}")
print(f"   creator_name 存在: {'creator_name' in column_names}")

if 'creator_name' not in column_names:
    print("\n⚠️  creator_name 列不存在，无需迁移")
    conn.close()
    exit(0)

# 2. 获取所有字段名（排除 creator_name）
columns_without_creator = [col for col in column_names if col != 'creator_name']
columns_str = ', '.join(columns_without_creator)

print(f"\n2. 保留的字段数: {len(columns_without_creator)}")

# 3. 创建备份表（不包含 creator_name）
print("\n3. 创建新表（排除 creator_name 列）...")
temp_table = 'daily_notes_metrics_unified_new'

# 构建建表语句（基于原表结构，但排除 creator_name）
cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_notes_metrics_unified'")
create_sql = cursor.fetchone()[0]

# 简单替换：删除 creator_name 字段定义
# 注意：这是简化方法，实际应该解析 SQL
import re
# 移除 creator_name 字段定义
create_sql_new = re.sub(
    r',?\s*creator_name\s+VARCHAR\(200\)\s*,?\s*index=True[^,]*,?\s*',
    ',',
    create_sql
)
# 清理可能的连续逗号
create_sql_new = re.sub(r',\s*,', ',', create_sql_new)
# 替换表名
create_sql_new = create_sql_new.replace('CREATE TABLE daily_notes_metrics_unified', f'CREATE TABLE {temp_table}')

print(f"   新表名: {temp_table}")
cursor.execute(create_sql_new)

# 4. 复制数据（排除 creator_name）
print("\n4. 复制数据到新表...")
cursor.execute(f"""
    INSERT INTO {temp_table} ({columns_str})
    SELECT {columns_str}
    FROM daily_notes_metrics_unified
""")
affected_rows = cursor.rowcount
print(f"   复制记录数: {affected_rows}")

# 5. 删除原表
print("\n5. 删除原表...")
cursor.execute("DROP TABLE daily_notes_metrics_unified")

# 6. 重命名新表
print("\n6. 重命名新表...")
cursor.execute(f"ALTER TABLE {temp_table} RENAME TO daily_notes_metrics_unified")

# 7. 重建索引
print("\n7. 重建索引...")
indexes = [
    ("idx_notes_date", "CREATE INDEX IF NOT EXISTS idx_notes_date ON daily_notes_metrics_unified(date)"),
    ("idx_notes_note_id", "CREATE INDEX IF NOT EXISTS idx_notes_note_id ON daily_notes_metrics_unified(note_id)"),
    ("idx_notes_creator", "CREATE INDEX IF NOT EXISTS idx_notes_creator ON daily_notes_metrics_unified(producer)"),
    ("idx_notes_producer", "CREATE INDEX IF NOT EXISTS idx_notes_producer ON daily_notes_metrics_unified(producer)"),
]

for idx_name, sql in indexes:
    try:
        cursor.execute(sql)
        print(f"   ✅ 创建索引: {idx_name}")
    except Exception as e:
        print(f"   ⚠️  索引 {idx_name} 可能已存在")

# 提交事务
conn.commit()

# 8. 验证结果
print("\n8. 验证迁移结果...")
cursor.execute("PRAGMA table_info(daily_notes_metrics_unified)")
new_columns = cursor.fetchall()
new_column_names = [col[1] for col in new_columns]

print(f"   新字段数: {len(new_column_names)}")
print(f"   creator_name 已删除: {'creator_name' not in new_column_names}")
print(f"   publish_account 仍存在: {'publish_account' in new_column_names}")
print(f"   producer 仍存在: {'producer' in new_column_names}")

# 检查记录数
cursor.execute("SELECT COUNT(*) FROM daily_notes_metrics_unified")
total_count = cursor.fetchone()[0]
print(f"   总记录数: {total_count}")

if 'creator_name' not in new_column_names:
    print("\n✅ 迁移成功完成！")
else:
    print("\n❌ 迁移失败：creator_name 列仍然存在")

conn.close()
print("\n" + "=" * 60)
