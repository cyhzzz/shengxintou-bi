# -*- coding: utf-8 -*-
"""
数据库索引优化脚本

根据PRD要求，为高频查询字段添加复合索引
预期性能提升：查询速度提升 30% 以上
"""

import sys
import os

# 添加项目根目录到sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app import app, db
from backend.models import *
from sqlalchemy import text

def create_indexes():
    """创建复合索引以优化查询性能"""

    print("=" * 60)
    print("数据库索引优化")
    print("=" * 60)

    indexes_to_create = [
        # ===== daily_metrics_unified 表的复合索引 =====
        {
            'name': 'idx_date_platform',
            'table': 'daily_metrics_unified',
            'columns': 'date, platform',
            'description': '按日期和平台查询'
        },
        {
            'name': 'idx_date_agency',
            'table': 'daily_metrics_unified',
            'columns': 'date, agency',
            'description': '按日期和代理商查询'
        },
        {
            'name': 'idx_platform_bm',
            'table': 'daily_metrics_unified',
            'columns': 'platform, business_model',
            'description': '按平台和业务模式查询'
        },
        {
            'name': 'idx_date_platform_agency',
            'table': 'daily_metrics_unified',
            'columns': 'date, platform, agency',
            'description': '按日期、平台和代理商查询'
        },

        # ===== daily_notes_metrics_unified 表的复合索引 =====
        {
            'name': 'idx_notes_date_producer',
            'table': 'daily_notes_metrics_unified',
            'columns': 'date, producer',
            'description': '按日期和创作者查询'
        },
        {
            'name': 'idx_notes_date_agency',
            'table': 'daily_notes_metrics_unified',
            'columns': 'date, agency',
            'description': '按日期和代理商查询'
        },
        {
            'name': 'idx_notes_producer_strategy',
            'table': 'daily_notes_metrics_unified',
            'columns': 'producer, ad_strategy',
            'description': '按创作者和策略查询'
        },

        # ===== backend_conversions 表的复合索引 =====
        {
            'name': 'idx_conversions_date_platform',
            'table': 'backend_conversions',
            'columns': 'lead_date, platform_source',
            'description': '按线索日期和平台查询'
        },
        {
            'name': 'idx_conversions_platform_agency',
            'table': 'backend_conversions',
            'columns': 'platform_source, agency',
            'description': '按平台和代理商查询'
        },
        {
            'name': 'idx_conversions_date_opened',
            'table': 'backend_conversions',
            'columns': 'lead_date, is_opened_account',
            'description': '按线索日期和开户状态查询'
        },

        # ===== xhs_notes_daily 表的复合索引 =====
        {
            'name': 'idx_xhs_daily_date_note',
            'table': 'xhs_notes_daily',
            'columns': 'date, note_id',
            'description': '按日期和笔记ID查询'
        },

        # ===== account_agency_mapping 表的复合索引 =====
        {
            'name': 'idx_mapping_platform_bm',
            'table': 'account_agency_mapping',
            'columns': 'platform, business_model',
            'description': '按平台和业务模式查询账号映射'
        },
        {
            'name': 'idx_mapping_agency_bm',
            'table': 'account_agency_mapping',
            'columns': 'agency, business_model',
            'description': '按代理商和业务模式查询账号映射'
        },
    ]

    with app.app_context():
        for idx_info in indexes_to_create:
            try:
                # 检查索引是否已存在
                check_sql = f"""
                    SELECT name FROM sqlite_master
                    WHERE type='index' AND name='{idx_info['name']}'
                """
                result = db.session.execute(text(check_sql)).fetchone()

                if result:
                    print(f"[SKIP] 索引 {idx_info['name']} 已存在")
                else:
                    # 创建索引
                    create_sql = f"""
                        CREATE INDEX {idx_info['name']}
                        ON {idx_info['table']} ({idx_info['columns']})
                    """
                    db.session.execute(text(create_sql))
                    db.session.commit()
                    print(f"[OK] 创建索引: {idx_info['name']} ({idx_info['description']})")

            except Exception as e:
                print(f"[FAIL] 创建索引失败 {idx_info['name']}: {e}")
                db.session.rollback()

        print("\n" + "=" * 60)
        print("索引优化完成！")
        print("=" * 60)

        # 显示创建的索引统计
        show_index_summary()

def show_index_summary():
    """显示索引统计信息"""
    try:
        sql = """
            SELECT name, tbl_name
            FROM sqlite_master
            WHERE type='index' AND name LIKE 'idx_%'
            ORDER BY tbl_name, name
        """
        results = db.session.execute(text(sql)).fetchall()

        print("\n[当前索引列表]")
        current_table = None
        for name, table in results:
            if table != current_table:
                print(f"\n{table}:")
                current_table = table
            print(f"  - {name}")

    except Exception as e:
        print(f"获取索引列表失败: {e}")

def analyze_query_performance():
    """使用EXPLAIN QUERY PLAN分析查询性能"""
    print("\n" + "=" * 60)
    print("查询性能分析")
    print("=" * 60)

    test_queries = [
        ("按日期和平台查询", """
            SELECT date, platform, SUM(cost) as total_cost
            FROM daily_metrics_unified
            WHERE date >= '2026-01-01' AND platform = '腾讯'
            GROUP BY date, platform
        """),
        ("按代理商查询", """
            SELECT agency, SUM(cost) as total_cost
            FROM daily_metrics_unified
            WHERE date >= '2026-01-01'
            GROUP BY agency
        """),
    ]

    with app.app_context():
        for query_name, query_sql in test_queries:
            print(f"\n{query_name}:")
            try:
                explain_sql = f"EXPLAIN QUERY PLAN {query_sql}"
                results = db.session.execute(text(explain_sql)).fetchall()

                for row in results:
                    print(f"  {row[0]}")
            except Exception as e:
                print(f"  分析失败: {e}")

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='数据库索引优化工具')
    parser.add_argument('--analyze', action='store_true',
                       help='分析查询性能（使用EXPLAIN QUERY PLAN）')

    args = parser.parse_args()

    # 创建索引
    create_indexes()

    # 如果指定了--analyze参数，则执行性能分析
    if args.analyze:
        analyze_query_performance()
