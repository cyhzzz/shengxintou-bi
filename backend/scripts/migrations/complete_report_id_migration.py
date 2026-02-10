# -*- coding: utf-8 -*-
"""
完成周报表主键迁移

将 weekly_reports 表的主键从自增ID改为 report_id
"""

import sys
import os
import sqlalchemy as sa

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


def migrate():
    """执行迁移"""
    print("=" * 60)
    print("开始迁移：周报表主键修改（完成版）")
    print("=" * 60)

    with app.app_context():
        # 步骤1: 填充 report_id 字段
        print("\n步骤1: 填充 report_id 字段...")
        with db.engine.connect() as conn:
            result = conn.execute(sa.text("""
                SELECT id, report_year, report_week, report_month
                FROM weekly_reports
                ORDER BY id
            """))

            existing_reports = result.fetchall()
            print(f"找到 {len(existing_reports)} 条现有记录")

            for record in existing_reports:
                old_id, year, week, month = record
                # 生成 report_id: YYYY-MM-weeknum
                report_id = f"{year}-{str(month).zfill(2)}-{week}"

                conn.execute(sa.text("""
                    UPDATE weekly_reports
                    SET report_id = :report_id
                    WHERE id = :old_id
                """), {'report_id': report_id, 'old_id': old_id})

                print(f"  记录 {old_id}: {report_id}")

            conn.commit()
            print("完成 report_id 填充")

        # 步骤2: 由于SQLite限制，需要重建表
        print("\n步骤2: 重建表结构...")
        rebuild_table()

        print("\n" + "=" * 60)
        print("迁移完成！")
        print("=" * 60)


def rebuild_table():
    """重建表，设置report_id为主键"""

    with app.app_context():
        # 导出现有数据
        print("  2.1 导出现有数据...")
        with db.engine.connect() as conn:
            result = conn.execute(sa.text("""
                SELECT
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
                    key_works, status, created_by, created_at, updated_at, published_at
                FROM weekly_reports
                ORDER BY id
            """))

            rows = result.fetchall()
            print(f"  导出 {len(rows)} 条记录")

            # 保存到临时列表
            data = []
            for row in rows:
                data.append({
                    'report_id': row[0],
                    'report_year': row[1],
                    'report_week': row[2],
                    'report_month': row[3],
                    'report_month_week': row[4],
                    'start_date': row[5],
                    'end_date': row[6],
                    'report_name': row[7],
                    'report_sequence': row[8],
                    'content_count': row[9],
                    'content_count_cumulative': row[10],
                    'content_views': row[11],
                    'content_views_cumulative': row[12],
                    'live_sessions': row[13],
                    'live_sessions_cumulative': row[14],
                    'live_viewers': row[15],
                    'live_viewers_cumulative': row[16],
                    'ad_impressions': row[17],
                    'ad_impressions_cumulative': row[18],
                    'ad_clicks': row[19],
                    'ad_clicks_cumulative': row[20],
                    'new_accounts': row[21],
                    'new_accounts_cumulative': row[22],
                    'enterprise_wechat_add': row[23],
                    'enterprise_wechat_add_cumulative': row[24],
                    'subscription_count': row[25],
                    'subscription_count_cumulative': row[26],
                    'branch_new_accounts': row[27],
                    'branch_new_accounts_cumulative': row[28],
                    'key_works': row[29],
                    'status': row[30],
                    'created_by': row[31],
                    'created_at': row[32],
                    'updated_at': row[33],
                    'published_at': row[34]
                })

        # 删除旧表
        print("  2.2 删除旧表...")
        from backend.models import WeeklyReport
        WeeklyReport.__table__.drop(db.engine)
        print("  完成")

        # 创建新表
        print("  2.3 创建新表...")
        db.create_all()
        print("  完成")

        # 导入数据
        print("  2.4 导入数据...")
        with db.engine.connect() as conn:
            for row in data:
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
                        key_works, status, created_by, created_at, updated_at, published_at
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
                        :key_works, :status, :created_by, :created_at, :updated_at, :published_at
                    )
                """), row)

            conn.commit()
            print(f"  完成，导入 {len(data)} 条记录")


if __name__ == '__main__':
    migrate()
