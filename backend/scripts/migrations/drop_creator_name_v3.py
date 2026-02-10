# -*- coding: utf-8 -*-
"""
迁移脚本 v3：删除 creator_name 列（使用 SQL 命令）

执行方式：
    cd D:/project/省心投-cc
    python backend/scripts/migrations/drop_creator_name_v3.py
"""

import sqlite3
import os
from pathlib import Path

# 数据库路径
db_path = Path(__file__).parent.parent.parent.parent / 'database' / 'shengxintou.db'

print("=" * 60)
print("迁移脚本：删除 creator_name 列")
print("=" * 60)
print(f"\n数据库: {db_path}")

# 连接数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. 检查表结构
    print("\n1. 检查表结构...")
    cursor.execute("PRAGMA table_info(daily_notes_metrics_unified)")
    columns = cursor.fetchall()
    column_names = [col[1] for col in columns]

    print(f"   当前字段数: {len(column_names)}")
    print(f"   creator_name 存在: {'creator_name' in column_names}")

    if 'creator_name' not in column_names:
        print("\ncreator_name 列不存在，无需迁移")
        exit(0)

    # 2. 获取所有字段（排除 creator_name）
    columns_without_creator = [col for col in column_names if col != 'creator_name']
    print(f"\n2. 新表将包含 {len(columns_without_creator)} 个字段")

    # 3. 获取创建表的 SQL
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_notes_metrics_unified'")
    create_sql = cursor.fetchone()[0]

    # 4. 手动构建新表 SQL（排除 creator_name）
    # 简化方法：基于原表结构，去掉 creator_name 字段
    new_table_sql = """
    CREATE TABLE daily_notes_metrics_unified_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        note_id VARCHAR(100) NOT NULL,
        note_title VARCHAR(500),
        note_url TEXT,
        note_publish_time DATETIME,
        publish_account VARCHAR(200),
        producer VARCHAR(100),
        ad_strategy VARCHAR(50),
        note_type VARCHAR(50),
        cost DECIMAL(10, 2) DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        private_messages INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        favorites INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        total_interactions INTEGER DEFAULT 0,
        lead_users INTEGER DEFAULT 0,
        customer_mouth_users INTEGER DEFAULT 0,
        valid_lead_users INTEGER DEFAULT 0,
        opened_account_users INTEGER DEFAULT 0,
        valid_customer_users INTEGER DEFAULT 0,
        customer_assets_users INTEGER DEFAULT 0,
        customer_assets_amount DECIMAL(15, 2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        agency VARCHAR(100),
        delivery_mode VARCHAR(50),
        total_impressions INTEGER DEFAULT 0,
        ad_impressions INTEGER DEFAULT 0,
        organic_impressions INTEGER DEFAULT 0,
        total_clicks INTEGER DEFAULT 0,
        ad_clicks INTEGER DEFAULT 0,
        organic_clicks INTEGER DEFAULT 0,
        total_likes INTEGER DEFAULT 0,
        ad_likes INTEGER DEFAULT 0,
        organic_likes INTEGER DEFAULT 0,
        total_comments INTEGER DEFAULT 0,
        ad_comments INTEGER DEFAULT 0,
        organic_comments INTEGER DEFAULT 0,
        total_favorites INTEGER DEFAULT 0,
        ad_favorites INTEGER DEFAULT 0,
        organic_favorites INTEGER DEFAULT 0,
        total_shares INTEGER DEFAULT 0,
        ad_shares INTEGER DEFAULT 0,
        organic_shares INTEGER DEFAULT 0,
        ad_interactions INTEGER DEFAULT 0,
        organic_interactions INTEGER DEFAULT 0,
        total_private_messages INTEGER DEFAULT 0,
        ad_private_messages INTEGER DEFAULT 0,
        organic_private_messages INTEGER DEFAULT 0,
        UNIQUE(date, note_id)
    )
    """

    # 5. 创建新表
    print("\n3. 创建新表...")
    cursor.execute(new_table_sql)

    # 6. 复制数据（排除 creator_name）
    print("\n4. 复制数据...")
    columns_str = ', '.join(columns_without_creator)
    insert_sql = f"""
        INSERT INTO daily_notes_metrics_unified_new ({columns_str})
        SELECT {columns_str}
        FROM daily_notes_metrics_unified
    """
    cursor.execute(insert_sql)
    affected = cursor.rowcount
    print(f"   复制记录数: {affected}")

    # 7. 删除原表
    print("\n5. 删除原表...")
    cursor.execute("DROP TABLE daily_notes_metrics_unified")

    # 8. 重命名新表
    print("\n6. 重命名新表...")
    cursor.execute("ALTER TABLE daily_notes_metrics_unified_new RENAME TO daily_notes_metrics_unified")

    # 9. 重建索引
    print("\n7. 重建索引...")

    indexes = [
        ("CREATE INDEX IF NOT EXISTS idx_notes_date ON daily_notes_metrics_unified(date)", "日期索引"),
        ("CREATE INDEX IF NOT EXISTS idx_notes_note_id ON daily_notes_metrics_unified(note_id)", "笔记ID索引"),
        ("CREATE INDEX IF NOT EXISTS idx_notes_producer ON daily_notes_metrics_unified(producer)", "producer索引"),
    ]

    for sql, name in indexes:
        cursor.execute(sql)
        print(f"   - {name}")

    # 10. 提交事务
    conn.commit()
    print("\n   事务已提交")

    # 11. 验证结果
    print("\n8. 验证结果...")
    cursor.execute("PRAGMA table_info(daily_notes_metrics_unified)")
    new_columns = cursor.fetchall()
    new_column_names = [col[1] for col in new_columns]

    print(f"   新字段数: {len(new_column_names)}")
    print(f"   creator_name 已删除: {'creator_name' not in new_column_names}")
    print(f"   publish_account 存在: {'publish_account' in new_column_names}")
    print(f"   producer 存在: {'producer' in new_column_names}")

    # 检查记录数
    cursor.execute("SELECT COUNT(*) FROM daily_notes_metrics_unified")
    count = cursor.fetchone()[0]
    print(f"   总记录数: {count}")

    if 'creator_name' not in new_column_names:
        print("\n迁移成功！")
    else:
        print("\n迁移失败：creator_name 列仍然存在")

except Exception as e:
    conn.rollback()
    print(f"\n错误: {str(e)}")
    print("事务已回滚")
    import traceback
    traceback.print_exc()
finally:
    conn.close()

print("\n" + "=" * 60)
