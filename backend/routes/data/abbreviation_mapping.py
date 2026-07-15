# -*- coding: utf-8 -*-
"""简称映射接口（v2 - 改对 dim_vendor 做 CRUD）"""
from flask import Blueprint, request, jsonify
from backend.models_v2 import DimVendor
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import reset_cache

bp = Blueprint('abbreviation_mapping', __name__)


@bp.route('/abbreviation-mapping', methods=['GET'])
@handle_exceptions
def get_abbreviation_mapping():
    rows = db.session.query(DimVendor).order_by(DimVendor.agency_name).all()
    data = []
    for r in rows:
        data.append({
            'id': r.id,
            'abbreviation': r.agency_letter or '',
            'full_name': r.agency_name,
            'display_name': r.agency_short or r.agency_name,
            'mapping_type': 'agency',
            'platform': None,
            'description': None,
            'is_active': True,
        })
    return jsonify({'success': True, 'data': data})


@bp.route('/abbreviation-mapping', methods=['POST'])
@handle_exceptions
def create_abbreviation_mapping():
    body = request.get_json() or {}
    new_id = (db.session.query(DimVendor.id).order_by(DimVendor.id.desc()).first() or [0])[0] + 1
    row = DimVendor(
        id=new_id,
        agency_name=body.get('full_name'),
        agency_short=body.get('display_name') or body.get('full_name'),
        agency_letter=body.get('abbreviation'),
    )
    db.session.add(row)
    db.session.commit()
    reset_cache()
    return jsonify({'success': True, 'message': '创建成功', 'data': {'id': new_id}})


@bp.route('/abbreviation-mapping/<int:id>', methods=['PUT'])
@handle_exceptions
def update_abbreviation_mapping(id):
    body = request.get_json() or {}
    row = db.session.query(DimVendor).filter(DimVendor.id == id).first()
    if not row:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    if 'full_name' in body:
        row.agency_name = body['full_name']
    if 'display_name' in body:
        row.agency_short = body['display_name']
    if 'abbreviation' in body:
        row.agency_letter = body['abbreviation']
    db.session.commit()
    reset_cache()
    return jsonify({'success': True, 'message': '更新成功'})


@bp.route('/abbreviation-mapping/<int:id>', methods=['DELETE'])
@handle_exceptions
def delete_abbreviation_mapping(id):
    row = db.session.query(DimVendor).filter(DimVendor.id == id).first()
    if not row:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    db.session.delete(row)
    db.session.commit()
    reset_cache()
    return jsonify({'success': True, 'message': '删除成功'})
