# -*- coding: utf-8 -*-
"""
上传文件清理脚本

功能:
1. 清理已成功处理的上传文件
2. 保留最近 N 天的文件（可配置）
3. 清理失败的任务文件（可配置）
"""

import os
import sys
from datetime import datetime, timedelta

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import db
from backend.models import DataImportLog


def cleanup_uploads(keep_days=7, delete_failed=False, dry_run=False):
    """
    清理上传文件

    Args:
        keep_days: 保留最近几天的文件（默认7天）
        delete_failed: 是否删除失败任务的文件（默认False）
        dry_run: 只显示将要删除的文件，不实际删除

    Returns:
        dict: 清理统计信息
    """
    from app import app

    with app.app_context():
        # 从config获取上传目录
        from config import UPLOAD_FOLDER

        # 计算截止日期
        cutoff_date = datetime.now() - timedelta(days=keep_days)

        print(f"\n{'='*60}")
        print(f"上传文件清理工具")
        print(f"{'='*60}")
        print(f"上传目录: {UPLOAD_FOLDER}")
        print(f"保留天数: {keep_days} 天")
        print(f"截止日期: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"清理失败任务: {'是' if delete_failed else '否'}")
        print(f"模拟运行: {'是' if dry_run else '否'}")
        print(f"{'='*60}\n")

        # 查询可以清理的导入记录
        query = db.session.query(DataImportLog)

        # 条件1: 已完成且在截止日期之前的记录
        query = query.filter(
            DataImportLog.status == 'completed',
            DataImportLog.completed_at < cutoff_date
        )

        # 条件2: 如果 delete_failed=True，也包括失败的记录
        if delete_failed:
            query = query.filter(
                db.or_(
                    DataImportLog.status == 'failed',
                    DataImportLog.status == 'completed'
                ),
                DataImportLog.completed_at < cutoff_date
            )

        # 按完成时间排序
        records = query.order_by(DataImportLog.completed_at.asc()).all()

        if not records:
            print("✓ 没有需要清理的文件")
            return {
                'total_records': 0,
                'total_size': 0,
                'deleted_count': 0,
                'deleted_size': 0,
                'kept_count': 0,
                'kept_size': 0,
                'missing_files': 0
            }

        # 统计信息
        stats = {
            'total_records': len(records),
            'total_size': 0,
            'deleted_count': 0,
            'deleted_size': 0,
            'kept_count': 0,
            'kept_size': 0,
            'missing_files': 0
        }

        print(f"找到 {len(records)} 条可清理的记录\n")

        # 遍历记录
        for record in records:
            file_path = os.path.join(UPLOAD_FOLDER, record.file_path)

            # 检查文件是否存在
            if not os.path.exists(file_path):
                stats['missing_files'] += 1
                print(f"[WARNING] 文件不存在: {record.file_path}")
                continue

            # 获取文件大小
            file_size = os.path.getsize(file_path)
            stats['total_size'] += file_size

            # 判断是否删除
            should_delete = True

            # 规则1: 已完成的任务总是可以删除（超过保留期）
            # 规则2: 失败的任务需要配置才删除
            if record.status == 'failed' and not delete_failed:
                should_delete = False

            if should_delete:
                stats['deleted_count'] += 1
                stats['deleted_size'] += file_size

                # 显示信息
                size_mb = file_size / (1024 * 1024)
                completed_at = record.completed_at.strftime('%Y-%m-%d %H:%M:%S') if record.completed_at else 'N/A'

                if dry_run:
                    print(f"[DRY RUN] 将删除: {record.file_path}")
                    print(f"  状态: {record.status}")
                    print(f"  完成时间: {completed_at}")
                    print(f"  文件大小: {size_mb:.2f} MB")
                else:
                    print(f"[DELETE] {record.file_path}")
                    print(f"  状态: {record.status}")
                    print(f"  完成时间: {completed_at}")
                    print(f"  文件大小: {size_mb:.2f} MB")

                    # 实际删除文件
                    try:
                        os.remove(file_path)
                        print(f"  [OK] 已删除")
                    except Exception as e:
                        print(f"  [ERROR] 删除失败: {str(e)}")
            else:
                stats['kept_count'] += 1
                stats['kept_size'] += file_size

                size_mb = file_size / (1024 * 1024)
                print(f"[KEEP] {record.file_path} ({size_mb:.2f} MB)")

            print()

        # 打印统计信息
        print(f"{'='*60}")
        print(f"清理统计:")
        print(f"{'='*60}")
        print(f"总记录数: {stats['total_records']}")
        print(f"总文件大小: {stats['total_size'] / (1024 * 1024):.2f} MB")
        print(f"")
        print(f"将删除: {stats['deleted_count']} 个文件")
        print(f"删除大小: {stats['deleted_size'] / (1024 * 1024):.2f} MB")
        print(f"")
        print(f"保留: {stats['kept_count']} 个文件")
        print(f"保留大小: {stats['kept_size'] / (1024 * 1024):.2f} MB")
        print(f"")
        print(f"文件不存在: {stats['missing_files']} 个")
        print(f"{'='*60}")

        if dry_run:
            print("\n[模拟运行] 未实际删除文件")
            print("如需实际删除，请去掉 --dry-run 参数")

        return stats


def cleanup_all(delete_all=False, dry_run=False):
    """
    清理所有上传文件

    Args:
        delete_all: 是否删除所有文件（包括最近7天的）
        dry_run: 模拟运行

    Returns:
        dict: 清理统计信息
    """
    from app import app

    with app.app_context():
        from config import UPLOAD_FOLDER

        print(f"\n{'='*60}")
        print(f"清理所有上传文件")
        print(f"{'='*60}")
        print(f"上传目录: {UPLOAD_FOLDER}")
        print(f"删除所有: {'是' if delete_all else '否（保留最近7天）'}")
        print(f"模拟运行: {'是' if dry_run else '否'}")
        print(f"{'='*60}\n")

        if not os.path.exists(UPLOAD_FOLDER):
            print("✓ 上传目录不存在")
            return {'total_count': 0, 'total_size': 0, 'deleted_count': 0, 'deleted_size': 0}

        # 获取所有文件
        files = []
        for filename in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(file_path):
                files.append(file_path)

        if not files:
            print("[OK] 上传目录为空")
            return {'total_count': 0, 'total_size': 0, 'deleted_count': 0, 'deleted_size': 0}

        stats = {
            'total_count': len(files),
            'total_size': 0,
            'deleted_count': 0,
            'deleted_size': 0
        }

        # 计算截止时间
        cutoff_date = datetime.now() - timedelta(days=7)

        for file_path in files:
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            stats['total_size'] += file_size

            # 检查文件修改时间
            file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))

            should_delete = delete_all or (file_mtime < cutoff_date)

            if should_delete:
                stats['deleted_count'] += 1
                stats['deleted_size'] += file_size

                size_mb = file_size / (1024 * 1024)

                if dry_run:
                    print(f"[DRY RUN] 将删除: {filename}")
                    print(f"  修改时间: {file_mtime.strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"  文件大小: {size_mb:.2f} MB")
                else:
                    print(f"[DELETE] {filename} ({size_mb:.2f} MB)")
                    try:
                        os.remove(file_path)
                        print(f"  [OK] 已删除")
                    except Exception as e:
                        print(f"  [ERROR] 删除失败: {str(e)}")
            else:
                size_mb = file_size / (1024 * 1024)
                print(f"[KEEP] {filename} ({size_mb:.2f} MB)")

        print(f"\n{'='*60}")
        print(f"总文件数: {stats['total_count']}")
        print(f"总大小: {stats['total_size'] / (1024 * 1024):.2f} MB")
        print(f"将删除: {stats['deleted_count']} 个文件")
        print(f"删除大小: {stats['deleted_size'] / (1024 * 1024):.2f} MB")
        print(f"{'='*60}")

        if dry_run:
            print("\n[模拟运行] 未实际删除文件")

        return stats


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='清理上传文件')
    parser.add_argument('--keep-days', type=int, default=7,
                        help='保留最近几天的文件（默认7天）')
    parser.add_argument('--delete-failed', action='store_true',
                        help='是否删除失败任务的文件')
    parser.add_argument('--dry-run', action='store_true',
                        help='模拟运行，不实际删除文件')
    parser.add_argument('--delete-all', action='store_true',
                        help='删除所有文件（忽略保留天数）')

    args = parser.parse_args()

    if args.delete_all:
        cleanup_all(delete_all=True, dry_run=args.dry_run)
    else:
        cleanup_uploads(
            keep_days=args.keep_days,
            delete_failed=args.delete_failed,
            dry_run=args.dry_run
        )
