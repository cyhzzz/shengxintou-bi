# -*- coding: utf-8 -*-
"""
小红书笔记信息管理 API
提供笔记基础属性的查询和更新功能
"""

from flask import Blueprint, request, jsonify
from backend.models import XhsNoteInfo
from backend.database import db
from sqlalchemy import func

bp = Blueprint('xhs_note_info', __name__)


@bp.route('/enums', methods=['GET'])
def get_enums():
    """
    获取枚举值选项
    返回创作者和广告策略的所有可用值
    """
    try:
        # 获取所有创作者（producer）
        creators = db.session.query(
            XhsNoteInfo.producer
        ).filter(
            XhsNoteInfo.producer != None,
            XhsNoteInfo.producer != ''
        ).distinct().order_by(
            XhsNoteInfo.producer
        ).all()

        creator_list = [c[0] for c in creators if c[0]]

        # 获取所有广告策略（ad_strategy）
        strategies = db.session.query(
            XhsNoteInfo.ad_strategy
        ).filter(
            XhsNoteInfo.ad_strategy != None,
            XhsNoteInfo.ad_strategy != ''
        ).distinct().order_by(
            XhsNoteInfo.ad_strategy
        ).all()

        strategy_list = [s[0] for s in strategies if s[0]]

        return jsonify({
            'success': True,
            'data': {
                'creators': creator_list,
                'ad_strategies': strategy_list
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/update', methods=['POST'])
def update_note():
    """
    更新笔记信息
    支持更新 producer 和 ad_strategy 字段

    请求体:
    {
        "note_id": "xxx",
        "updates": {
            "producer": "创作者名称",
            "ad_strategy": "广告策略"
        }
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'error': '请求体不能为空'
            }), 400

        note_id = data.get('note_id')
        if not note_id:
            return jsonify({
                'success': False,
                'error': 'note_id 不能为空'
            }), 400

        updates = data.get('updates', {})
        if not updates:
            return jsonify({
                'success': False,
                'error': 'updates 不能为空'
            }), 400

        # 查找笔记记录
        note = db.session.query(XhsNoteInfo).filter(
            XhsNoteInfo.note_id == note_id
        ).first()

        if not note:
            # 如果不存在，创建新记录
            note = XhsNoteInfo(note_id=note_id)
            db.session.add(note)

        # 更新字段
        if 'producer' in updates:
            note.producer = updates['producer']

        if 'ad_strategy' in updates:
            note.ad_strategy = updates['ad_strategy']

        if 'note_title' in updates:
            note.note_title = updates['note_title']

        if 'note_url' in updates:
            note.note_url = updates['note_url']

        if 'publish_account' in updates:
            note.publish_account = updates['publish_account']

        if 'publish_time' in updates:
            from datetime import datetime
            if isinstance(updates['publish_time'], str):
                try:
                    note.publish_time = datetime.fromisoformat(updates['publish_time'])
                except:
                    pass

        # 提交更改
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '笔记信息更新成功',
            'data': {
                'note_id': note.note_id,
                'producer': note.producer,
                'ad_strategy': note.ad_strategy,
                'note_title': note.note_title
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/batch-update', methods=['POST'])
def batch_update_notes():
    """
    批量更新笔记信息
    支持批量更新多条记录

    请求体:
    {
        "updates": [
            {
                "note_id": "xxx",
                "producer": "创作者名称"
            },
            {
                "note_id": "yyy",
                "ad_strategy": "广告策略"
            }
        ]
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'error': '请求体不能为空'
            }), 400

        updates = data.get('updates', [])
        if not updates:
            return jsonify({
                'success': False,
                'error': 'updates 不能为空'
            }), 400

        success_count = 0
        failed_count = 0
        errors = []

        for update_data in updates:
            try:
                note_id = update_data.get('note_id')
                if not note_id:
                    failed_count += 1
                    errors.append(f'缺少 note_id')
                    continue

                # 查找或创建笔记记录
                note = db.session.query(XhsNoteInfo).filter(
                    XhsNoteInfo.note_id == note_id
                ).first()

                if not note:
                    note = XhsNoteInfo(note_id=note_id)
                    db.session.add(note)

                # 更新字段
                if 'producer' in update_data:
                    note.producer = update_data['producer']

                if 'ad_strategy' in update_data:
                    note.ad_strategy = update_data['ad_strategy']

                if 'note_title' in update_data:
                    note.note_title = update_data['note_title']

                if 'note_url' in update_data:
                    note.note_url = update_data['note_url']

                if 'publish_account' in update_data:
                    note.publish_account = update_data['publish_account']

                if 'publish_time' in update_data:
                    from datetime import datetime
                    if isinstance(update_data['publish_time'], str):
                        try:
                            note.publish_time = datetime.fromisoformat(update_data['publish_time'])
                        except:
                            pass

                success_count += 1

            except Exception as e:
                failed_count += 1
                errors.append(f'{note_id}: {str(e)}')

        # 提交更改
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'批量更新完成：{success_count} 成功，{failed_count} 失败',
            'data': {
                'success_count': success_count,
                'failed_count': failed_count,
                'errors': errors
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/note/<note_id>', methods=['GET'])
def get_note(note_id):
    """
    获取单个笔记信息

    Args:
        note_id: 笔记ID

    Returns:
        笔记详细信息
    """
    try:
        note = db.session.query(XhsNoteInfo).filter(
            XhsNoteInfo.note_id == note_id
        ).first()

        if not note:
            return jsonify({
                'success': False,
                'error': '笔记不存在'
            }), 404

        return jsonify({
            'success': True,
            'data': {
                'note_id': note.note_id,
                'note_title': note.note_title,
                'note_url': note.note_url,
                'publish_account': note.publish_account,
                'publish_time': note.publish_time.isoformat() if note.publish_time else None,
                'producer': note.producer,
                'ad_strategy': note.ad_strategy
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
