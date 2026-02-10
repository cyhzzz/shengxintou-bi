# -*- coding: utf-8 -*-
"""
补充 xhs_note_info 表中缺失的 publish_time 字段

从 xhs_notes_content_daily 表中查找并补充 publish_time
"""

import sys
import os
from datetime import datetime

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app
from backend.database import db
from backend.models import XhsNoteInfo, XhsNotesContentDaily
from sqlalchemy import text


def safe_print(text):
    """安全打印，处理编码错误"""
    try:
        print(text)
    except UnicodeEncodeError:
        # 如果编码失败，替换无法编码的字符
        print(text.encode('gbk', errors='replace').decode('gbk'))

def supplement_missing_publish_times():
    """
    补充 xhs_note_info 表中缺失的 publish_time 字段

    数据来源：
    1. 从 xhs_notes_content_daily 表中查找 note_publish_time
    2. 更新到 xhs_note_info 表
    3. 重新运行聚合脚本更新 daily_notes_metrics_unified
    """
    with app.app_context():
        safe_print("=" * 60)
        safe_print("补充 xhs_note_info 表中缺失的 publish_time 字段")
        safe_print("=" * 60)

        # 步骤 1：查找 publish_time 为 NULL 的笔记
        safe_print("\n步骤 1: 查找 publish_time 为 NULL 的笔记...")

        null_notes = db.session.query(
            XhsNoteInfo.note_id,
            XhsNoteInfo.note_title
        ).filter(
            XhsNoteInfo.publish_time.is_(None)
        ).all()

        safe_print(f"   找到 {len(null_notes)} 条 publish_time 为 NULL 的笔记")

        if not null_notes:
            safe_print("\n[SUCCESS] 所有笔记的 publish_time 都已填充，无需补充")
            return

        # 步骤 2：从 content_daily 表中查找这些笔记的 note_publish_time
        safe_print("\n步骤 2: 从 xhs_notes_content_daily 表中查找 publish_time...")

        updated_count = 0
        not_found_count = 0

        for note in null_notes:
            note_id = note.note_id

            # 从 content_daily 表中查找该笔记的 note_publish_time
            # 取最新的非空值
            content_data = db.session.query(
                XhsNotesContentDaily.note_publish_time
            ).filter(
                XhsNotesContentDaily.note_id == note_id,
                XhsNotesContentDaily.note_publish_time.isnot(None)
            ).order_by(
                XhsNotesContentDaily.data_date.desc()
            ).first()

            if content_data and content_data.note_publish_time:
                # 更新 xhs_note_info 表
                db.session.query(XhsNoteInfo).filter(
                    XhsNoteInfo.note_id == note_id
                ).update({
                    'publish_time': content_data.note_publish_time
                })

                updated_count += 1
                safe_print(f"   [OK] {note_id}: {note.note_title} - {content_data.note_publish_time}")
            else:
                not_found_count += 1
                safe_print(f"   [SKIP] {note_id}: {note.note_title} - 未找到 publish_time")

        # 提交更改
        db.session.commit()

        safe_print(f"\n   [OK] 成功更新 {updated_count} 条笔记")
        if not_found_count > 0:
            safe_print(f"   [WARN] {not_found_count} 条笔记未找到 publish_time")

        # 步骤 3：重新运行聚合脚本更新聚合表
        safe_print("\n步骤 3: 重新运行聚合脚本更新 daily_notes_metrics_unified...")
        safe_print("   提示：请手动运行以下命令：")
        safe_print("   python backend/scripts/aggregations/update_daily_notes_metrics.py")

        safe_print("\n" + "=" * 60)
        safe_print(f"[SUCCESS] 完成！")
        safe_print("=" * 60)

        # 验证结果
        safe_print("\n验证结果:")

        result = db.session.execute(text('''
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN publish_time IS NULL THEN 1 END) as null_count
            FROM xhs_note_info
        ''')).fetchone()

        safe_print(f"   xhs_note_info 表:")
        safe_print(f"     总记录数: {result[0]}")
        safe_print(f"     publish_time 为 NULL: {result[1]}")

        # 检查聚合表
        agg_result = db.session.execute(text('''
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN note_publish_time IS NULL THEN 1 END) as null_count
            FROM daily_notes_metrics_unified
        ''')).fetchone()

        safe_print(f"\n   daily_notes_metrics_unified 表:")
        safe_print(f"     总记录数: {agg_result[0]}")
        safe_print(f"     note_publish_time 为 NULL: {agg_result[1]}")

        safe_print("\n[提示] 请运行聚合脚本以更新聚合表中的 note_publish_time 字段")


if __name__ == '__main__':
    supplement_missing_publish_times()
