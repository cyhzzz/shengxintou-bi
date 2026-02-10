# -*- coding: utf-8 -*-
"""
省心投 BI - 系统配置管理接口
"""

from flask import Blueprint, request, jsonify
from backend.models import SystemConfiguration
from backend.database import db
import json

bp = Blueprint('config', __name__, url_prefix='/api/v1/config')


@bp.route('', methods=['GET'])
def get_configs():
    """获取所有配置"""
    try:
        category = request.args.get('category')

        query = SystemConfiguration.query

        # 按分类筛选
        if category:
            query = query.filter_by(category=category)

        configs = query.order_by(SystemConfiguration.category, SystemConfiguration.id).all()

        return jsonify({
            'success': True,
            'data': [config.to_dict() for config in configs]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<config_key>', methods=['GET'])
def get_config(config_key):
    """获取单个配置"""
    try:
        config = SystemConfiguration.query.filter_by(config_key=config_key).first()

        if not config:
            return jsonify({
                'success': False,
                'error': '配置不存在'
            }), 404

        return jsonify({
            'success': True,
            'data': config.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('', methods=['POST'])
def create_config():
    """创建配置"""
    try:
        data = request.get_json()

        # 验证必需字段
        if not data.get('config_key'):
            return jsonify({
                'success': False,
                'error': '配置键不能为空'
            }), 400

        # 检查是否已存在
        existing = SystemConfiguration.query.filter_by(config_key=data['config_key']).first()
        if existing:
            return jsonify({
                'success': False,
                'error': '配置键已存在'
            }), 400

        # 创建配置
        config = SystemConfiguration(
            config_key=data['config_key'],
            config_value=data.get('config_value', ''),
            config_type=data.get('config_type', 'string'),
            category=data.get('category', 'general'),
            description=data.get('description', ''),
            is_editable=data.get('is_editable', True)
        )

        db.session.add(config)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '配置创建成功',
            'data': config.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<config_key>', methods=['PUT'])
def update_config(config_key):
    """更新配置"""
    try:
        config = SystemConfiguration.query.filter_by(config_key=config_key).first()

        if not config:
            return jsonify({
                'success': False,
                'error': '配置不存在'
            }), 404

        # 检查是否可编辑
        if not config.is_editable:
            return jsonify({
                'success': False,
                'error': '该配置不可编辑'
            }), 400

        data = request.get_json()

        # 更新字段
        if 'config_value' in data:
            config.config_value = data['config_value']
        if 'description' in data:
            config.description = data['description']
        if 'category' in data:
            config.category = data['category']
        if 'config_type' in data:
            config.config_type = data['config_type']

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '配置更新成功',
            'data': config.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<config_key>', methods=['DELETE'])
def delete_config(config_key):
    """删除配置"""
    try:
        config = SystemConfiguration.query.filter_by(config_key=config_key).first()

        if not config:
            return jsonify({
                'success': False,
                'error': '配置不存在'
            }), 404

        # 检查是否可编辑
        if not config.is_editable:
            return jsonify({
                'success': False,
                'error': '该配置不可删除'
            }), 400

        db.session.delete(config)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '配置删除成功'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/batch', methods=['PUT'])
def batch_update_configs():
    """批量更新配置"""
    try:
        data = request.get_json()
        configs = data.get('configs', [])

        updated = []

        for config_data in configs:
            config_key = config_data.get('config_key')
            if not config_key:
                continue

            config = SystemConfiguration.query.filter_by(config_key=config_key).first()
            if not config:
                continue

            # 检查是否可编辑
            if not config.is_editable:
                continue

            if 'config_value' in config_data:
                config.config_value = config_data['config_value']

            updated.append(config.to_dict())

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'成功更新 {len(updated)} 项配置',
            'data': updated
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# 添加模型序列化方法
def to_dict(self):
    """转换为字典"""
    value = self.config_value

    # 根据类型转换值
    if self.config_type == 'number':
        try:
            value = float(value) if value else 0
        except ValueError:
            value = 0
    elif self.config_type == 'boolean':
        value = value in ['true', 'True', '1', 'yes', 'Yes']
    elif self.config_type == 'json':
        try:
            value = json.loads(value) if value else {}
        except json.JSONDecodeError:
            value = {}

    return {
        'id': self.id,
        'config_key': self.config_key,
        'config_value': value,
        'config_type': self.config_type,
        'category': self.category,
        'description': self.description,
        'is_editable': self.is_editable,
        'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
        'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
    }


# 动态添加方法到模型
SystemConfiguration.to_dict = to_dict
