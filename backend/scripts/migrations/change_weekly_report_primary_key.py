# -*- coding: utf-8 -*-
"""
迁移周报表主键

将 weekly_reports 表的主键从自增ID改为 report_id (VARCHAR, 格式: YYYY-MM-weeknum)
例如: 2026-01-1 表示 2026年1月第1周
"""

import sys
import os
import sqlalchemy as sa
from datetime import datetime

# 设置标准输出为UTF-8编码（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, project_root)
os.chdir(project_root)

from app import app
from backend.database import db
from backend.models import WeeklyReport


def migrate():
    """执行迁移"""
    print("=" * 60)
    print("开始迁移：周报表主键修改")
    print("=" * 60)

    with app.app_context():
        inspector = sa.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('weekly_reports')]

        print(f"\n当前表结构: {len(columns)} 个字段")
        print(f"字段列表: {columns}")

        # 检查是否已有 report_id 字段
        if 'report_id' in columns:
            print("\n⚠️  report_id 字段已存在，跳过迁移")
            return

        # 步骤1: 添加 report_id 字段
        print("\n步骤1: 添加 report_id 字段...")
        with db.engine.connect() as conn:
            # 添加新字段
            conn.execute(sa.text("""
                ALTER TABLE weekly_reports
                ADD COLUMN report_id VARCHAR(20)
            """))
            conn.commit()
            print("✓ report_id 字段已添加")

        # 步骤2: 为现有记录生成 report_id 值
        print("\n步骤2: 为现有记录生成 report_id 值...")
        with db.engine.connect() as conn:
            result = conn.execute(sa.text("""
                SELECT id, report_year, report_week
                FROM weekly_reports
                ORDER BY id
            """))

            existing_reports = result.fetchall()
            print(f"找到 {len(existing_reports)} 条现有记录")

            for record in existing_reports:
                old_id, year, week = record
                # 生成 report_id: YYYY-MM-weeknum
                report_id = f"{year}-{str(report_week or week).zfill(2)}-{week}"

                conn.execute(sa.text("""
                    UPDATE weekly_reports
                    SET report_id = :report_id
                    WHERE id = :old_id
                """), {'report_id': report_id, 'old_id': old_id})

                print(f"  记录 {old_id}: {report_id}")

            conn.commit()
            print("✓ report_id 值已填充")

        # 步骤3: 设置 report_id 为 NOT NULL
        print("\n步骤3: 设置 report_id 为 NOT NULL...")
        with db.engine.connect() as conn:
            # SQLite不支持直接修改列为NOT NULL，需要重建表
            # 这里先跳过，后续会通过重建表实现
            print("  (将在重建表时设置NOT NULL约束)")

        # 步骤4: 重建表结构（SQLite修改主键需要重建表）
        print("\n步骤4: 重建表结构以设置主键...")
        rebuild_table_with_new_primary_key()

        print("\n" + "=" * 60)
        print("✅ 迁移完成！")
        print("=" * 60)


def rebuild_table_with_new_primary_key():
    """重建表结构，设置 report_id 为主键"""

    with app.app_context():
        # 导出现有数据
        print("  4.1 导出现有数据...")
        with db.engine.connect() as conn:
            result = conn.execute(sa.text("""
                SELECT
                    report_year, report_week, report_month, report_month_week,
                    start_date, end_date, report_name, report_sequence,
                    content_count, content_count_cumulative,
                    content_views, content_views_cumulative,
                    live_sessions, live_sessions_cumulative,
                    live_viewers, live_viewers_cumulative,
                    ad_impressions, ad_impressions_cumulative,
                    ad_clicks, ad_clicks_cumulative,
                    new_accounts, new_accounts_cumulative,
                    enterprise_wechat_add, enterprise_wechat_add_cumulative,
                    subscription_count, subscription_count_cumulative,
                    branch_new_accounts, branch_new_accounts_cumulative,
                    key_works, status, created_at, updated_at, published_at
                FROM weekly_reports
                ORDER BY id
            """))

            existing_data = result.fetchall()
            print(f"  导出 {len(existing_data)} 条记录")

        # 删除旧表
        print("  4.2 删除旧表...")
        WeeklyReport.__table__.drop(db.engine)
        print("  ✓ 旧表已删除")

        # 创建新表（使用新的主键结构）
        print("  4.3 创建新表...")
        db.create_all()
        print("  ✓ 新表已创建")

        # 重新导入数据
        print("  4.4 重新导入数据...")
        with db.engine.connect() as conn:
            for row in existing_data:
                (report_year, report_week, report_month, report_month_week,
                 start_date, end_date, report_name, report_sequence,
                 content_count, content_count_cumulative,
                 content_views, content_views_cumulative,
                 live_sessions, live_sessions_cumulative,
                 live_viewers, live_viewers_cumulative,
                 ad_impressions, ad_impressions_cumulative,
                 ad_clicks, ad_clicks_cumulative,
                 new_accounts, new_accounts_cumulative,
                 enterprise_wechat_add, enterprise_wechat_add_cumulative,
                 subscription_count, subscription_count_cumulative,
                 branch_new_accounts, branch_new_accounts_cumulative,
                 key_works, status, created_at, updated_at, published_at) = row

                # 生成 report_id
                report_id = f"{report_year}-{str(report_month).zfill(2)}-{report_week}"

                # 插入数据
                conn.execute(sa.text("""
                    INSERT INTO weekly_reports (
                        report_id, report_year, report_week, report_month, report_month_week,
                        start_date, end_date, report_name, report_sequence,
                        content_count, content_count_cumulative,
                        content_views, content_views_cumulative,
                        live_sessions, live_sessions_cumulative,
                        live_viewers, live_viewers_cumulative,
                        ad_impressions, ad_impressions_cumulative,
                        ad_clicks, ad_clicks_cumulative,
                        new_accounts, new_accounts_cumulative,
                        enterprise_wechat_add, enterprise_wechat_add_cumulative,
                        subscription_count, subscription_count_cumulative,
                        branch_new_accounts, branch_new_accounts_cumulative,
                        key_works, status, created_at, updated_at, published_at
                    ) VALUES (
                        :report_id, :report_year, :report_week, :report_month, :report_month_week,
                        :start_date, :end_date, :report_name, :report_sequence,
                        :content_count, :content_count_cumulative,
                        :content_views, :content_views_cumulative,
                        :live_sessions, :live_sessions_cumulative,
                        :live_viewers, :live_viewers_cumulative,
                        :ad_impressions, :ad_impressions_cumulative,
                        :ad_clicks, :ad_clicks_cumulative,
                        :new_accounts, :new_accounts_cumulative,
                        :enterprise_wechat_add, :enterprise_wechat_add_cumulative,
                        :subscription_count, :subscription_count_cumulative,
                        :branch_new_accounts, :branch_new_accounts_cumulative,
                        :key_works, :status, :created_at, :updated_at, :published_at
                    )
                """), {
                    'report_id': report_id,
                    'report_year': report_year,
                    'report_week': report_week,
                    'report_month': report_month,
                    'report_month_week': report_month_week,
                    'start_date': start_date,
                    'end_date': end_date,
                    'report_name': report_name,
                    'report_sequence': report_sequence,
                    'content_count': content_count,
                    'content_count_cumulative': content_count_cumulative,
                    'content_views': content_views,
                    'content_views_cumulative': content_views_cumulative,
                    'live_sessions': live_sessions,
                    'live_sessions_cumulative': live_sessions_cumulative,
                    'live_viewers': live_viewers,
                    'live_viewers_cumulative': live_viewers_cumulative,
                    'ad_impressions': ad_impressions,
                    'ad_impressions_cumulative': ad_impressions_cumulative,
                    'ad_clicks': ad_clicks,
                    'ad_clicks_cumulative': ad_clicks_cumulative,
                    'new_accounts': new_accounts,
                    'new_accounts_cumulative': new_accounts_cumulative,
                    'enterprise_wechat_add': enterprise_wechat_add,
                    'enterprise_wechat_add_cumulative': enterprise_wechat_add_cumulative,
                    'subscription_count': subscription_count,
                    'subscription_count_cumulative': subscription_count_cumulative,
                    'branch_new_accounts': branch_new_accounts,
                    'branch_new_accounts_cumulative': branch_new_accounts_cumulative,
                    'key_works': key_works,
                    'status': status,
                    'created_at': created_at,
                    'updated_at': updated_at,
                    'published_at': published_at
                })

            conn.commit()
            print(f"  ✓ 重新导入 {len(existing_data)} 条记录")


if __name__ == '__main__':
    migrate()
