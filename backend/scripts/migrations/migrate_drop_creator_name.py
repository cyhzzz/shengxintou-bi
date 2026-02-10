"""
数据库迁移脚本：删除 daily_notes_metrics_unified 表的 creator_name 字段

功能说明：
1. 删除 creator_name 列（该列与 publish_account 重复，存储的都是账号名称）
2. 保留 producer 列（创作者姓名）
3. 更新索引（如果 creator_name 有索引则删除）

执行方式：
    python backend/scripts/migrations/migrate_drop_creator_name.py

回滚方式：
    此脚本执行后不可回滚，请先备份数据库

作者: Claude
日期: 2026-01-26
版本: 1.0
"""

import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# 导入应用和数据库
import sys
import os
os.chdir(project_root)

from config import *
from backend.database import db
from flask import Flask

app = Flask(__name__)
app.config.from_object('config')
db.init_app(app)

import sqlalchemy as sa


def migrate():
    """执行迁移：删除 creator_name 列"""

    print("=" * 60)
    print("开始迁移：删除 creator_name 列")
    print("=" * 60)

    with app.app_context():
        # 1. 检查表结构
        print("\n1. 检查当前表结构...")
        inspector = sa.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('daily_notes_metrics_unified')]

        print(f"   当前字段数: {len(columns)}")
        print(f"   creator_name 存在: {'creator_name' in columns}")

        if 'creator_name' not in columns:
            print("\n⚠️  creator_name 列不存在，无需迁移")
            return

        # 2. 备份提示
        print("\n2. ⚠️  重要提示：")
        print("   即将删除 creator_name 列，该操作不可逆！")
        print("   建议先备份数据库：")
        print(f"   cp database/shengxintou.db database/shengxintou_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")

        # 3. 执行删除列操作
        print("\n3. 执行删除列操作...")

        try:
            with db.engine.connect() as conn:
                # SQLite 不支持 ALTER TABLE DROP COLUMN，
                # 需要重建表的方式

                print("   检测到 SQLite 数据库，使用重建表方式...")

                # Step 1: 获取原表的所有数据（不包括 creator_name）
                print("   - 导出数据（排除 creator_name 列）...")
                columns_without_creator = [col for col in columns if col != 'creator_name']
                columns_str = ', '.join(columns_without_creator)

                # 创建临时表
                temp_table = 'daily_notes_metrics_unified_temp'
                conn.execute(sa.text(f"""
                    CREATE TABLE {temp_table} AS
                    SELECT {columns_str}
                    FROM daily_notes_metrics_unified
                """))

                # Step 2: 删除原表
                print("   - 删除原表...")
                conn.execute(sa.text("DROP TABLE daily_notes_metrics_unified"))

                # Step 3: 重命名临时表
                print("   - 重命名新表...")
                conn.execute(sa.text(f"""
                    ALTER TABLE {temp_table}
                    RENAME TO daily_notes_metrics_unified
                """))

                # Step 4: 重建索引
                print("   - 重建索引...")

                # 日期索引
                conn.execute(sa.text("""
                    CREATE INDEX IF NOT EXISTS idx_notes_date
                    ON daily_notes_metrics_unified(date)
                """))

                # 笔记ID索引
                conn.execute(sa.text("""
                    CREATE INDEX IF NOT EXISTS idx_notes_note_id
                    ON daily_notes_metrics_unified(note_id)
                """))

                # creator索引（保留，用于创作者维度分析）
                conn.execute(sa.text("""
                    CREATE INDEX IF NOT EXISTS idx_notes_creator
                    ON daily_notes_metrics_unified(producer)
                """))

                # producer索引
                conn.execute(sa.text("""
                    CREATE INDEX IF NOT EXISTS idx_notes_producer
                    ON daily_notes_metrics_unified(producer)
                """))

                # 创建唯一约束
                conn.commit()

                print("   ✅ 列删除成功")

        except Exception as e:
            print(f"\n❌ 迁移失败: {str(e)}")
            print("   请检查错误信息并回滚数据库备份")
            raise

        # 4. 验证结果
        print("\n4. 验证迁移结果...")
        inspector = sa.inspect(db.engine)
        new_columns = [col['name'] for col in inspector.get_columns('daily_notes_metrics_unified')]

        print(f"   新字段数: {len(new_columns)}")
        print(f"   creator_name 已删除: {'creator_name' not in new_columns}")
        print(f"   producer 仍存在: {'producer' in new_columns}")
        print(f"   publish_account 仍存在: {'publish_account' in new_columns}")

        if 'creator_name' not in new_columns:
            print("\n✅ 迁移成功完成！")
        else:
            print("\n❌ 迁移失败：creator_name 列仍然存在")

        print("\n" + "=" * 60)


def verify_data_integrity():
    """验证数据完整性"""
    print("\n5. 验证数据完整性...")

    with app.app_context():
        from backend.models import DailyNotesMetricsUnified

        # 检查总记录数
        total_count = db.session.query(DailyNotesMetricsUnified).count()
        print(f"   总记录数: {total_count}")

        # 检查有 producer 的记录数
        has_producer = db.session.query(DailyNotesMetricsUnified).filter(
            DailyNotesMetricsUnified.producer.isnot(None)
        ).count()
        print(f"   有创作者姓名的记录: {has_producer}")

        # 检查有 publish_account 的记录数
        has_account = db.session.query(DailyNotesMetricsUnified).filter(
            DailyNotesMetricsUnified.publish_account.isnot(None)
        ).count()
        print(f"   有发布账号的记录: {has_account}")

        print("\n✅ 数据完整性验证完成")


if __name__ == '__main__':
    import datetime

    try:
        migrate()
        verify_data_integrity()
    except Exception as e:
        print(f"\n❌ 迁移过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
