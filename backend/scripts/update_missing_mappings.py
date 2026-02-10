# -*- coding: utf-8 -*-
"""
补充缺失的小红书笔记映射记录

用于在导入小红书笔记数据后，自动补充 xhs_note_info 表中缺失的记录
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app
from backend.database import db
from backend.models import XhsNoteInfo, XhsNotesContentDaily
import sqlalchemy as sa


def update_missing_mappings_sql():
    """
    使用 SQL 批量操作补充缺失的笔记映射记录（性能优化版）

    1. 创建新记录：对于 xhs_note_info 表中不存在的 note_id，创建映射记录
    2. 更新空字段：对于已存在但 publish_account 或 publish_time 为空的记录，更新这些字段

    Returns:
        int: 新增的记录数
    """
    with app.app_context():
        print('=== SQL Batch: Supplementing Missing XHS Notes Mapping ===')
        print('')

        # 统计当前状态
        print('Step 1: Analyzing current status...')
        content_notes = db.session.query(
            XhsNotesContentDaily.note_id
        ).distinct().all()
        content_note_ids = set([r[0] for r in content_notes])

        mapping_notes = db.session.query(
            XhsNoteInfo.note_id
        ).distinct().all()
        mapping_note_ids = set([r[0] for r in mapping_notes])

        missing_count = len(content_note_ids) - len(mapping_note_ids)

        print(f'  content_daily unique notes: {len(content_note_ids):,}')
        print(f'  mapping unique notes:      {len(mapping_note_ids):,}')
        print(f'  missing notes:              {missing_count:,}')
        print('')

        # 统计需要更新空字段的记录数
        print('Step 1.5: Analyzing empty fields...')
        empty_account_count = db.session.query(XhsNoteInfo).filter(
            sa.or_(
                XhsNoteInfo.publish_account.is_(None),
                XhsNoteInfo.publish_account == ''
            )
        ).count()

        empty_time_count = db.session.query(XhsNoteInfo).filter(
            XhsNoteInfo.publish_time.is_(None)
        ).count()

        print(f'  records with empty publish_account: {empty_account_count:,}')
        print(f'  records with empty publish_time: {empty_time_count:,}')
        print('')

        if missing_count == 0 and empty_account_count == 0 and empty_time_count == 0:
            print('[OK] All mappings are complete')
            return 0

        # 使用 SQL INSERT ... SELECT 批量创建映射记录
        print(f'Step 2: Batch inserting {missing_count:,} missing mappings...')
        try:
            with db.engine.connect() as conn:
                # 使用 INSERT ... SELECT 语句
                # 从 xhs_notes_content_daily 中选择不在 mapping 表中的记录
                # 对于每个 note_id，选择 note_title 和 note_publish_time（使用 MAX 获取非空值）
                result = conn.execute(sa.text("""
                    INSERT INTO xhs_note_info (note_id, note_title, publish_time, created_at)
                    SELECT
                        content.note_id,
                        MAX(content.note_title) as note_title,
                        MAX(content.note_publish_time) as publish_time,
                        datetime('now') as created_at
                    FROM xhs_notes_content_daily content
                    WHERE content.note_id NOT IN (
                        SELECT mapping.note_id
                        FROM xhs_note_info mapping
                    )
                    GROUP BY content.note_id
                """))
                conn.commit()

                created_count = result.rowcount
                print(f'  [OK] Successfully created {created_count:,} mapping records')
                print('')

                # 步骤3：更新已存在但字段为空的记录
                print('Step 3: Updating empty fields in existing mappings...')
                try:
                    with db.engine.connect() as conn:
                        # 更新 publish_account 为空的记录
                        # 优先使用 creator_name，如果为空则使用默认值"申万宏源证券财富管理"
                        updated_account = conn.execute(sa.text("""
                            UPDATE xhs_note_info
                            SET publish_account = COALESCE(
                                (SELECT creator_name
                                 FROM xhs_notes_content_daily
                                 WHERE xhs_notes_content_daily.note_id = xhs_note_info.note_id
                                 AND creator_name IS NOT NULL
                                 AND creator_name != ''
                                 LIMIT 1),
                                '申万宏源证券财富管理'
                            )
                            WHERE publish_account IS NULL OR publish_account = ''
                        """))
                        conn.commit()

                        # 更新 publish_time 为空的记录
                        updated_time = conn.execute(sa.text("""
                            UPDATE xhs_note_info
                            SET publish_time = (
                                SELECT note_publish_time
                                FROM xhs_notes_content_daily
                                WHERE xhs_notes_content_daily.note_id = xhs_note_info.note_id
                                AND note_publish_time IS NOT NULL
                                LIMIT 1
                            )
                            WHERE publish_time IS NULL
                        """))
                        conn.commit()

                        print(f'  [OK] Updated {updated_account.rowcount:,} records with publish_account')
                        print(f'  [OK] Updated {updated_time.rowcount:,} records with publish_time')
                        print('')

                        total_updated = updated_account.rowcount + updated_time.rowcount
                        total_processed = created_count + total_updated
                        print(f'Total: {created_count:,} created, {total_updated:,} updated, {total_processed:,} total processed')

                        # 返回总处理数（创建 + 更新）
                        return total_processed

                except Exception as e:
                    print(f'  [WARNING] Update empty fields failed: {e}')
                    print('  Created records are preserved, but empty fields not updated.')
                    print('')
                    return created_count

        except Exception as e:
            print(f'  [ERROR] Batch insert failed: {e}')
            print('  Falling back to Python loop method...')
            print('')
            # 如果 SQL 批量操作失败，回退到 Python 循环方法
            return _fallback_update(content_note_ids, mapping_note_ids)


def _fallback_update(content_note_ids, mapping_note_ids):
    """
    回退方案：使用 Python 循环创建映射记录

    当 SQL 批量操作失败时使用
    """
    missing_note_ids = content_note_ids - mapping_note_ids

    # 查询缺失笔记的详细信息
    print('Step 3 (Fallback): Querying missing notes details...')
    missing_notes_data = db.session.query(
        XhsNotesContentDaily.note_id,
        XhsNotesContentDaily.note_title,
        XhsNotesContentDaily.note_publish_time,
        XhsNotesContentDaily.creator_name
    ).filter(
        XhsNotesContentDaily.note_id.in_(missing_note_ids)
    ).distinct().all()

    print(f'  Found {len(missing_notes_data):,} missing records')
    print('')

    # 批量创建映射记录
    print('Step 4 (Fallback): Creating mapping records...')
    batch_size = 100
    created_count = 0

    for i, note_data in enumerate(missing_notes_data, 1):
        note_id = note_data[0]
        note_title = note_data[1]
        note_publish_time = note_data[2]
        creator_name = note_data[3] if len(note_data) > 3 else None

        new_mapping = XhsNoteInfo(
            note_id=note_id,
            note_title=note_title,
            publish_time=note_publish_time,
            publish_account=creator_name,  # 使用 creator_name
            producer=None,
            ad_strategy=None
        )
        db.session.add(new_mapping)
        created_count += 1

        # 批量提交
        if i % batch_size == 0:
            db.session.commit()
            print(f'  Progress: {i}/{len(missing_notes_data)} ({i/len(missing_notes_data)*100:.1f}%)')

    # 提交剩余数据
    if created_count % batch_size != 0:
        db.session.commit()

    print(f'  [OK] Created {created_count:,} records')
    print('')

    # 验证结果
    print('Step 5: Verifying results...')
    final_mapping_count = db.session.query(XhsNoteInfo).count()
    final_unique = db.session.query(
        XhsNoteInfo.note_id
    ).distinct().count()

    print(f'  Total mapping records:      {final_mapping_count:,}')
    print(f'  Unique note_id count:       {final_unique:,}')
    print(f'  Expected count:             {len(content_note_ids):,}')
    print('')

    if final_unique == len(content_note_ids):
        print('[SUCCESS] Mapping supplement completed!')
        print('')
        print('Next steps:')
        print('  1. Fill in producer (生产者) field for new mappings')
        print('  2. Fill in ad_strategy (广告策略) field for new mappings')
    else:
        print('[WARNING] Supplement incomplete, please check logs')

    return created_count


def update_missing_mappings():
    """
    保留的旧函数名称，用于兼容性
    直接调用新的 SQL 批量操作版本
    """
    return update_missing_mappings_sql()


if __name__ == '__main__':
    update_missing_mappings()
