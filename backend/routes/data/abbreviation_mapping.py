# -*- coding: utf-8 -*-
"""
简称映射接口 - 代理商简称映射管理
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
bp = Blueprint('abbreviation_mapping', __name__)

@bp.route('/abbreviation-mapping', methods=['GET'])
def get_abbreviation_mapping():
    """
    获取所有代理商简称映射
    
    查询参数:
    - mapping_type: 映射类型 (agency/platform)
    - is_active: 是否启用 (true/false)
    """
    try:
        query = AgencyAbbreviationMapping.query
        
        # 筛选条件
        mapping_type = request.args.get('mapping_type')
        if mapping_type:
            query = query.filter_by(mapping_type=mapping_type)
        
        is_active = request.args.get('is_active')
        if is_active is not None:
            query = query.filter_by(is_active=(is_active.lower() == 'true'))
        
        # 按类型和简称排序
        mappings = query.order_by(
            AgencyAbbreviationMapping.mapping_type,
            AgencyAbbreviationMapping.abbreviation
        ).all()
        
        # 转换为字典
        data = []
        for m in mappings:
            data.append({
                'id': m.id,
                'abbreviation': m.abbreviation,
                'full_name': m.full_name,
                'mapping_type': m.mapping_type,
                'platform': m.platform,
                'display_name': m.display_name,
                'description': m.description,
                'is_active': m.is_active,
                'created_at': m.created_at.isoformat() if m.created_at else None,
                'updated_at': m.updated_at.isoformat() if m.updated_at else None
            })
        
        return jsonify({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/abbreviation-mapping', methods=['POST'])
def create_abbreviation_mapping():
    """
    创建新的代理商简称映射
    
    请求体:
    {
        "abbreviation": "lz",
        "full_name": "量子",
        "mapping_type": "agency",
        "platform": null,
        "display_name": "量子",
        "description": "代理商简称",
        "is_active": true
    }
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['abbreviation', 'full_name', 'mapping_type']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'error': f'缺少必需字段: {field}'
                }), 400
        
        # 检查简称是否已存在
        existing = AgencyAbbreviationMapping.query.filter_by(
            abbreviation=data['abbreviation'],
            platform=data.get('platform')
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'error': '该简称已存在'
            }), 400
        
        # 创建新记录
        new_mapping = AgencyAbbreviationMapping(
            abbreviation=data['abbreviation'],
            full_name=data['full_name'],
            mapping_type=data['mapping_type'],
            platform=data.get('platform'),
            display_name=data.get('display_name'),
            description=data.get('description'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(new_mapping)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '创建成功',
            'data': {
                'id': new_mapping.id
            }
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'success': False,
            'error': f'创建失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/abbreviation-mapping/<int:id>', methods=['PUT'])
def update_abbreviation_mapping(id):
    """
    更新代理商简称映射
    
    请求体:
    {
        "full_name": "量子",
        "is_active": true
    }
    """
    try:
        data = request.get_json()
        
        # 查找记录
        mapping = AgencyAbbreviationMapping.query.get(id)
        if not mapping:
            return jsonify({
                'success': False,
                'error': '记录不存在'
            }), 404
        
        # 更新字段
        if 'full_name' in data:
            mapping.full_name = data['full_name']
        if 'display_name' in data:
            mapping.display_name = data['display_name']
        if 'description' in data:
            mapping.description = data['description']
        if 'is_active' in data:
            mapping.is_active = data['is_active']

        # 更新时间戳
        mapping.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '更新成功'
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({
            'success': False,
            'error': f'更新失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/abbreviation-mapping/<int:id>', methods=['DELETE'])
def delete_abbreviation_mapping(id):
    """删除代理商简称映射"""
    try:
        mapping = AgencyAbbreviationMapping.query.get(id)
        if not mapping:
            return jsonify({
                'success': False,
                'error': '记录不存在'
            }), 404
        
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
            'success': False,
            'error': f'删除失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


# ===== 数据概览 API 接口 =====


# ===== 数据概览 API 接口 =====


