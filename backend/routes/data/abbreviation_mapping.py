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
    获取所有简称映射
    ---
    tags:
      - Abbreviation Mapping
    summary: 获取简称映射列表
    description: 获取系统中所有的简称映射数据，支持按类型和状态筛选
    parameters:
      - name: mapping_type
        in: query
        type: string
        required: false
        description: 映射类型筛选
        enum: [agency, platform]
      - name: is_active
        in: query
        type: boolean
        required: false
        description: 是否启用筛选
        example: true
    produces:
      - application/json
    responses:
      200:
        description: 查询成功
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: 映射ID
                    example: 1
                  abbreviation:
                    type: string
                    description: 简称
                    example: "lz"
                  full_name:
                    type: string
                    description: 全称
                    example: "量子"
                  mapping_type:
                    type: string
                    description: 映射类型
                    enum: [agency, platform]
                    example: "agency"
                  platform:
                    type: string
                    description: 适用平台（null表示通用）
                    example: null
                  display_name:
                    type: string
                    description: 显示名称
                    example: "量子"
                  description:
                    type: string
                    description: 说明备注
                    example: "代理商简称"
                  is_active:
                    type: boolean
                    description: 是否启用
                    example: true
                  created_at:
                    type: string
                    format: date-time
                    description: 创建时间
                  updated_at:
                    type: string
                    format: date-time
                    description: 更新时间
      500:
        description: 服务器错误
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
    创建新的简称映射
    ---
    tags:
      - Abbreviation Mapping
    summary: 创建简称映射
    description: 创建新的简称到全称的映射关系，用于代理商简称和平台简称的转换
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - abbreviation
            - full_name
            - mapping_type
          properties:
            abbreviation:
              type: string
              description: 简称
              example: "lz"
            full_name:
              type: string
              description: 全称
              example: "量子"
            mapping_type:
              type: string
              description: 映射类型
              enum: [agency, platform]
              example: "agency"
            platform:
              type: string
              description: 适用平台（null表示通用）
              example: null
            display_name:
              type: string
              description: 显示名称
              example: "量子"
            description:
              type: string
              description: 说明备注
              example: "代理商简称"
            is_active:
              type: boolean
              description: 是否启用
              example: true
    produces:
      - application/json
    responses:
      200:
        description: 创建成功
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "创建成功"
            data:
              type: object
              properties:
                id:
                  type: integer
                  example: 1
      400:
        description: 请求参数错误或简称已存在
      500:
        description: 服务器错误
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
    更新简称映射
    ---
    tags:
      - Abbreviation Mapping
    summary: 更新简称映射
    description: 更新指定ID的简称映射信息，可更新全称、显示名称、描述和启用状态
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: 映射记录ID
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            full_name:
              type: string
              description: 新全称
              example: "量子"
            display_name:
              type: string
              description: 新显示名称
              example: "量子"
            description:
              type: string
              description: 新说明备注
              example: "更新后的代理商简称"
            is_active:
              type: boolean
              description: 是否启用
              example: true
    produces:
      - application/json
    responses:
      200:
        description: 更新成功
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "更新成功"
      404:
        description: 记录不存在
      500:
        description: 服务器错误
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
    """
    删除简称映射
    ---
    tags:
      - Abbreviation Mapping
    summary: 删除简称映射
    description: 删除指定ID的简称映射记录
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: 映射记录ID
    produces:
      - application/json
    responses:
      200:
        description: 删除成功
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "删除成功"
      404:
        description: 记录不存在
      500:
        description: 服务器错误
    """
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


