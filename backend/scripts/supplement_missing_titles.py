# -*- coding: utf-8 -*-
"""
补充 xhs_notes_content_daily 表中缺失的笔记标题

从 xhs_note_info 表中获取 note_title，更新到 content_daily 表中缺失的记录
"""
import sys
sys.path.insert(0, '.')

from app import app
from backend.database import db
from backend.models import XhsNotesContentDaily, XhsNoteInfo
from sqlalchemy import and_, update
import logging

logger = logging.getLogger(__name__)


def supplement_missing_titles():
    """
    补充缺失的笔记标题

    Returns:
        dict: 补充结果统计
    """
    with app.app_context():
        try:
            # 查找所有缺少标题的记录，且在 mapping 表中能找到对应标题的
            missing_records = db.session.query(
                XhsNotesContentDaily.id,
                XhsNotesContentDaily.note_id,
                XhsNoteInfo.note_title
            ).join(
                XhsNoteInfo,
                XhsNotesContentDaily.note_id == XhsNoteInfo.note_id
            ).filter(
                and_(
                    XhsNotesContentDaily.note_title == None,
                    XhsNoteInfo.note_title != None,
                    XhsNoteInfo.note_title != ''
                )
            ).all()

            if not missing_records:
                return {
                    'success': True,
                    'total_found': 0,
                    'updated': 0,
                    'message': '没有需要补充的标题记录'
                }

            logger.info(f"找到 {len(missing_records)} 条可以补充的记录")

            # 批量更新
            updated_count = 0
            batch_size = 100

            for i in range(0, len(missing_records), batch_size):
                batch = missing_records[i:i + batch_size]

                for record in batch:
                    # 使用 UPDATE 语句直接更新
                    db.session.query(XhsNotesContentDaily).filter(
                        XhsNotesContentDaily.id == record.id
                    ).update(
                        {'note_title': record.note_title},
                        synchronize_session=False
                    )
                    updated_count += 1

                # 每批次提交一次
                db.session.commit()
                logger.info(f"进度: {updated_count}/{len(missing_records)} 条记录已更新")

            logger.info(f"✓ 标题补充完成！共更新 {updated_count} 条记录")

            return {
                'success': True,
                'total_found': len(missing_records),
                'updated': updated_count,
                'message': f'成功补充 {updated_count} 条笔记标题'
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"补充标题失败: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': f'补充标题失败: {str(e)}'
            }


def get_statistics():
    """
    获取标题缺失统计信息

    Returns:
        dict: 统计信息
    """
    with app.app_context():
        try:
            # 总缺失数
            total_missing = db.session.query(XhsNotesContentDaily.id).filter(
                XhsNotesContentDaily.note_title == None
            ).count()

            # 可以从 mapping 表找到的
            can_find = db.session.query(XhsNotesContentDaily.id).join(
                XhsNoteInfo,
                XhsNotesContentDaily.note_id == XhsNoteInfo.note_id
            ).filter(
                and_(
                    XhsNotesContentDaily.note_title == None,
                    XhsNoteInfo.note_title != None,
                    XhsNoteInfo.note_title != ''
                )
            ).count()

            return {
                'total_missing': total_missing,
                'can_find_in_mapping': can_find,
                'cannot_find': total_missing - can_find
            }

        except Exception as e:
            logger.error(f"获取统计信息失败: {str(e)}")
            return {
                'error': str(e)
            }


if __name__ == '__main__':
    print('\n=== 笔记标题补充工具 ===\n')

    # 先显示统计信息
    print('当前状态:')
    stats = get_statistics()

    if 'error' in stats:
        print(f"错误: {stats['error']}")
        sys.exit(1)

    print(f"  缺少标题的记录总数: {stats['total_missing']}")
    print(f"  可从 mapping 表补充: {stats['can_find_in_mapping']}")
    print(f"  无法找到的记录: {stats['cannot_find']}")
    print()

    if stats['can_find_in_mapping'] == 0:
        print('没有需要补充的记录。')
        sys.exit(0)

    # 执行补充
    print('开始补充...')
    result = supplement_missing_titles()

    if result['success']:
        print(f"\n✓ {result['message']}")
        print(f"  找到: {result['total_found']} 条")
        print(f"  更新: {result['updated']} 条")

        # 验证结果
        print('\n验证结果:')
        final_stats = get_statistics()
        print(f"  剩余缺少标题: {final_stats['total_missing']} 条")
    else:
        print(f"\n✗ {result['message']}")
        sys.exit(1)
