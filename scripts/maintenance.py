# -*- coding: utf-8 -*-
"""
数据库维护脚本

功能：
1. VACUUM - 优化SQLite数据库文件大小，清理碎片
2. ANALYZE - 更新统计信息，优化查询计划
3. REINDEX - 重建索引，提升查询性能

建议执行频率：每月一次
预期效果：
- 数据库文件大小减少 10-30%
- 查询性能提升 20-50%
"""

import sys
import os
import time

# 添加项目根目录到sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import app, db
from sqlalchemy import text

def get_db_size():
    """获取数据库文件大小（MB）"""
    try:
        db_path = app.config.get('DATABASE_PATH')
        if os.path.exists(db_path):
            size_bytes = os.path.getsize(db_path)
            size_mb = size_bytes / (1024 * 1024)
            return size_mb
        return 0
    except Exception as e:
        print(f"获取数据库大小失败: {e}")
        return 0

def vacuum_database():
    """执行VACUUM优化数据库"""
    print("\n" + "=" * 60)
    print("开始 VACUUM 优化...")
    print("=" * 60)

    start_time = time.time()
    size_before = get_db_size()

    print(f"优化前数据库大小: {size_before:.2f} MB")

    try:
        with app.app_context():
            # VACUUM会重建数据库文件，清理碎片
            db.session.execute(text("VACUUM"))
            db.session.commit()

        size_after = get_db_size()
        elapsed_time = time.time() - start_time

        print(f"优化后数据库大小: {size_after:.2f} MB")
        print(f"节省空间: {size_before - size_after:.2f} MB ({(1 - size_after/size_before)*100:.1f}%)")
        print(f"耗时: {elapsed_time:.2f} 秒")
        print("[OK] VACUUM 完成！")

    except Exception as e:
        print(f"[FAIL] VACUUM 失败: {e}")
        db.session.rollback()

def analyze_database():
    """执行ANALYZE更新统计信息"""
    print("\n" + "=" * 60)
    print("开始 ANALYZE 统计信息更新...")
    print("=" * 60)

    start_time = time.time()

    try:
        with app.app_context():
            # ANALYZE会收集表和索引的统计信息
            # 查询优化器使用这些信息选择最佳查询计划
            db.session.execute(text("ANALYZE"))
            db.session.commit()

        elapsed_time = time.time() - start_time
        print(f"耗时: {elapsed_time:.2f} 秒")
        print("[OK] ANALYZE 完成！")

    except Exception as e:
        print(f"[FAIL] ANALYZE 失败: {e}")
        db.session.rollback()

def reindex_database():
    """重建所有索引"""
    print("\n" + "=" * 60)
    print("开始 REINDEX 重建索引...")
    print("=" * 60)

    start_time = time.time()

    try:
        with app.app_context():
            # REINDEX会重建所有索引，提升查询性能
            db.session.execute(text("REINDEX"))
            db.session.commit()

        elapsed_time = time.time() - start_time
        print(f"耗时: {elapsed_time:.2f} 秒")
        print("[OK] REINDEX 完成！")

    except Exception as e:
        print(f"[FAIL] REINDEX 失败: {e}")
        db.session.rollback()

def show_database_info():
    """显示数据库信息"""
    print("\n" + "=" * 60)
    print("数据库信息")
    print("=" * 60)

    try:
        with app.app_context():
            # 获取数据库页面大小
            result = db.session.execute(text("PRAGMA page_size")).fetchone()
            page_size = result[0] if result else 0

            # 获取数据库页面数量
            result = db.session.execute(text("PRAGMA page_count")).fetchone()
            page_count = result[0] if result else 0

            # 计算数据库大小
            db_size = (page_size * page_count) / (1024 * 1024)

            print(f"数据库大小: {db_size:.2f} MB")
            print(f"页面大小: {page_size} bytes")
            print(f"页面数量: {page_count}")

            # 获取数据库编码
            result = db.session.execute(text("PRAGMA encoding")).fetchone()
            encoding = result[0] if result else "Unknown"
            print(f"数据库编码: {encoding}")

            # 获取WAL模式状态
            result = db.session.execute(text("PRAGMA journal_mode")).fetchone()
            journal_mode = result[0] if result else "Unknown"
            print(f"日志模式: {journal_mode}")

    except Exception as e:
        print(f"获取数据库信息失败: {e}")

def full_maintenance():
    """执行完整的维护流程"""
    print("=" * 60)
    print("数据库完整维护")
    print("=" * 60)

    start_time = time.time()

    # 显示维护前信息
    show_database_info()

    # 执行维护
    vacuum_database()
    analyze_database()
    reindex_database()

    # 显示维护后信息
    show_database_info()

    elapsed_time = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"总耗时: {elapsed_time:.2f} 秒")
    print("[OK] 数据库维护完成！")
    print("=" * 60)

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='SQLite数据库维护工具')
    parser.add_argument('--vacuum', action='store_true',
                       help='执行VACUUM优化数据库文件大小')
    parser.add_argument('--analyze', action='store_true',
                       help='执行ANALYZE更新统计信息')
    parser.add_argument('--reindex', action='store_true',
                       help='执行REINDEX重建索引')
    parser.add_argument('--full', action='store_true',
                       help='执行完整维护（VACUUM + ANALYZE + REINDEX）')
    parser.add_argument('--info', action='store_true',
                       help='显示数据库信息')

    args = parser.parse_args()

    # 如果没有指定任何操作，默认执行完整维护
    if not any([args.vacuum, args.analyze, args.reindex, args.full, args.info]):
        args.full = True

    if args.info:
        show_database_info()
    elif args.vacuum:
        vacuum_database()
    elif args.analyze:
        analyze_database()
    elif args.reindex:
        reindex_database()
    elif args.full:
        full_maintenance()
