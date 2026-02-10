# -*- coding: utf-8 -*-
"""
从广告投放数据推断 publish_time

对于没有 publish_time 的笔记，使用 xhs_notes_daily 表中的
最早投放日期作为 publish_time 的估算值
"""

import sys
import os
from datetime import datetime

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app
from backend.database import db
from backend.models import XhsNoteInfo, XhsNotesDaily
from sqlalchemy import text


def safe_print(text):
    """安全打印，处理编码错误"""
    try:
        print(text)
    except UnicodeEncodeError:
        # 如果编码失败，替换无法编码的字符
        print(text.encode('gbk', errors='replace').decode('gbk'))


def infer_publish_time_from_ad_data():
    """
    从广告投放数据推断 publish_time

    逻辑：
    1. 查找 publish_time 为 NULL 的笔记
    2. 从 xhs_notes_daily 表中查找这些笔记的投放数据
    3. 取最早的投放日期（MIN(date)）作为 publish_time
    4. 更新 xhs_note_info 表
    """
    with app.app_context():
        safe_print("=" * 60)
        safe_print("从广告投放数据推断 publish_time")
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
            safe_print("\n[SUCCESS] 所有笔记的 publish_time 都已填充，无需推断")
            return

        # 步骤 2：从 xhs_notes_daily 表中查找这些笔记的最早投放日期
        safe_print("\n步骤 2: 从 xhs_notes_daily 表中查找最早投放日期...")

        updated_count = 0
        not_found_count = 0

        for note in null_notes:
            note_id = note.note_id

            # 从 xhs_notes_daily 表中查找该笔记的最早投放日期
            ad_data = db.session.query(
                db.func.min(XhsNotesDaily.date).label('earliest_date')
            ).filter(
                XhsNotesDaily.note_id == note_id,
                XhsNotesDaily.date.isnot(None)
            ).first()

            if ad_data and ad_data.earliest_date:
                # 将日期转换为 datetime（publish_time 是 DATETIME 类型）
                # 使用当天的 00:00:00 作为时间
                inferred_time = datetime.combine(ad_data.earliest_date, datetime.min.time())

                # 更新 xhs_note_info 表
                db.session.query(XhsNoteInfo).filter(
                    XhsNoteInfo.note_id == note_id
                ).update({
                    'publish_time': inferred_time
                })

                updated_count += 1
                safe_print(f"   [OK] {note_id}: {note.note_title} - 推断为 {ad_data.earliest_date}")
            else:
                not_found_count += 1
                safe_print(f"   [SKIP] {note_id}: {note.note_title} - 未找到投放数据")

        # 提交更改
        db.session.commit()

        safe_print(f"\n   [OK] 成功推断并更新 {updated_count} 条笔记")
        if not_found_count > 0:
            safe_print(f"   [WARN] {not_found_count} 条笔记未找到投放数据")

        # 步骤 3：验证结果
        safe_print("\n步骤 3: 验证结果...")

        result = db.session.execute(text('''
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN publish_time IS NULL THEN 1 END) as null_count
            FROM xhs_note_info
        ''')).fetchone()

        safe_print(f"   xhs_note_info 表:")
        safe_print(f"     总记录数: {result[0]}")
        safe_print(f"     publish_time 为 NULL: {result[1]}")

        safe_print(f"\n   更新后剩余 NULL 值: {result[1]} 条（原 {len(null_notes)} 条）")
        safe_print(f"   修复成功率: {(len(null_notes) - result[1]) / len(null_notes) * 100:.1f}%")

        safe_print("\n" + "=" * 60)
        safe_print(f"[SUCCESS] 完成！")
        safe_print("=" * 60)

        safe_print("\n下一步：运行聚合脚本更新 daily_notes_metrics_unified 表")
        safe_print("python backend/scripts/aggregations/update_daily_notes_metrics.py")


if __name__ == '__main__':
    infer_publish_time_from_ad_data()
