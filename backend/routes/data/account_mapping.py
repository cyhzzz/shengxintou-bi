# -*- coding: utf-8 -*-
"""
账户映射接口 - 账户与代理商映射管理
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, Integer, case, literal
from backend.models import (
    DailyMetricsUnified,
    AccountAgencyMapping,
    AgencyAbbreviationMapping,
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    BackendConversions
)
from backend.database import db
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('account_mapping', __name__)

@bp.route('/account-mapping', methods=['GET'])
def get_account_mapping():
    """
    获取账号代理商映射数据
    """
    from backend.database import db

    try:
        # 查询所有映射数据（包含所有字段）
        mappings = db.session.query(AccountAgencyMapping).order_by(
            AccountAgencyMapping.platform,
            AccountAgencyMapping.agency
        ).all()

        # 转换结果
        data = []
        for row in mappings:
            data.append({
                'platform': row.platform,
                'account_id': row.account_id,
                'account_name': row.account_name,
                'main_account_id': row.main_account_id,
                'sub_account_name': row.sub_account_name,
                'agency': row.agency,
                'business_model': row.business_model
            })

        return jsonify({
            'data': data,
            'total': len(data)
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/account-agency-mapping', methods=['GET'])
def get_account_agency_mapping():
    """
    获取账号代理商映射数据（别名路由，与前端API调用保持一致）
    """
    return get_account_mapping()



@bp.route('/account-mapping', methods=['POST'])
def create_account_mapping():
    """
    创建新的账号代理商映射（v2.2 - 支持小红书字段）
    请求体: {
        "platform": "腾讯/抖音/小红书",
        "account_id": "123456",  // 腾讯/抖音必填，小红书可选（直投时为null）
        "account_name": "测试账号",
        "main_account_id": "66b0686c000000001d020d1f",  // 小红书必填
        "sub_account_name": "代理商子账户名称",  // 小红书可选
        "agency": "众联",
        "business_model": "信息流"
    }
    """
    from backend.database import db

    try:
        data = request.get_json()

        # 验证必填字段
        if 'platform' not in data or not data['platform']:
            return jsonify({'error': '缺少必填字段: platform'}), 400
        if 'agency' not in data or not data['agency']:
            return jsonify({'error': '缺少必填字段: agency'}), 400

        platform = data['platform']

        # 小红书特殊验证
        if platform == '小红书':
            if 'main_account_id' not in data or not data['main_account_id']:
                return jsonify({'error': '小红书账号必填字段: main_account_id'}), 400
        else:
            # 腾讯/抖音必填 account_id
            if 'account_id' not in data or not data['account_id']:
                return jsonify({'error': '腾讯/抖音账号必填字段: account_id'}), 400

        # 检查是否已存在
        existing_query = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform
        )

        # 如果有 account_id，通过 account_id 检查
        if data.get('account_id'):
            existing_query = existing_query.filter(
                AccountAgencyMapping.account_id == str(data['account_id'])
            )
        else:
            # 小红书直投：通过 main_account_id 检查
            existing_query = existing_query.filter(
                AccountAgencyMapping.main_account_id == data['main_account_id'],
                AccountAgencyMapping.account_id.is_(None)
            )

        existing = existing_query.first()

        if existing:
            return jsonify({'error': '该账号映射已存在'}), 400

        # 创建新映射
        mapping = AccountAgencyMapping(
            platform=platform,
            account_id=str(data['account_id']) if data.get('account_id') else None,
            account_name=data.get('account_name', ''),
            main_account_id=data.get('main_account_id'),
            sub_account_name=data.get('sub_account_name'),
            agency=data['agency'],
            business_model=data.get('business_model', '信息流')
        )

        db.session.add(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '创建成功',
            'data': {
                'platform': mapping.platform,
                'account_id': mapping.account_id,
                'account_name': mapping.account_name,
                'agency': mapping.agency,
                'business_model': mapping.business_model
            }
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'创建失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['PUT'])
def update_account_mapping(platform, account_id):
    """
    更新账号代理商映射（v2.2 - 支持小红书字段）
    请求体: {
        "account_name": "新账号名称",
        "agency": "新代理商",
        "business_model": "直播",
        "main_account_id": "66b0686c000000001d020d1f",  // 小红书字段
        "sub_account_name": "代理商子账户名称"  // 小红书字段
    }
    """
    from backend.database import db

    try:
        data = request.get_json()

        # 查找现有映射
        # 处理 account_id 为特殊值的情况（小红书直投）
        if account_id in ['null', '', 'None', 'undefined']:
            # 对于小红书直投，account_id在URL中可能为特殊值
            # 需要通过main_account_id来查找
            main_account_id = data.get('main_account_id')
            if not main_account_id:
                return jsonify({'error': '小红书直投账号必须提供main_account_id'}), 400

            mapping = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == platform,
                AccountAgencyMapping.main_account_id == main_account_id,
                AccountAgencyMapping.account_id.is_(None)
            ).first()
        else:
            # 正常通过account_id查找
            mapping = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == platform,
                AccountAgencyMapping.account_id == account_id
            ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        # 更新字段
        if 'account_name' in data:
            mapping.account_name = data['account_name']
        if 'agency' in data:
            mapping.agency = data['agency']
        if 'business_model' in data:
            mapping.business_model = data['business_model']
        if 'main_account_id' in data:
            mapping.main_account_id = data['main_account_id']
        if 'sub_account_name' in data:
            mapping.sub_account_name = data['sub_account_name']

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '更新成功',
            'data': {
                'platform': mapping.platform,
                'account_id': mapping.account_id,
                'account_name': mapping.account_name,
                'main_account_id': mapping.main_account_id,
                'sub_account_name': mapping.sub_account_name,
                'agency': mapping.agency,
                'business_model': mapping.business_model
            }
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'更新失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['DELETE'])
def delete_account_mapping(platform, account_id):
    """
    删除账号代理商映射
    """
    from backend.database import db

    try:
        # 查找现有映射
        mapping = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform,
            AccountAgencyMapping.account_id == account_id
        ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        db.session.delete(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '删除成功'
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/account-mapping/<string:platform>/main/<string:main_account_id>', methods=['DELETE'])
def delete_account_mapping_by_main(platform, main_account_id):
    """
    通过主账号ID删除账号代理商映射（用于小红书直投账号）
    """
    from backend.database import db
    from sqlalchemy import or_

    try:
        # 查找现有映射（account_id为NULL，通过main_account_id查找）
        mapping = db.session.query(AccountAgencyMapping).filter(
            AccountAgencyMapping.platform == platform,
            AccountAgencyMapping.main_account_id == main_account_id,
            AccountAgencyMapping.account_id.is_(None)
        ).first()

        if not mapping:
            return jsonify({'error': '映射不存在'}), 404

        db.session.delete(mapping)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '删除成功'
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



