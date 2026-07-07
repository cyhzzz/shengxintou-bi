# -*- coding: utf-8 -*-
"""账号映射接口（v2 - 改对 dim_account 做 CRUD）"""
from flask import Blueprint, request, jsonify
from backend.models_v2 import DimAccount
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('account_mapping', __name__)


@bp.route('/account-mapping', methods=['GET'])
@handle_exceptions
def get_account_mapping():
    rows = db.session.query(DimAccount).order_by(DimAccount.platform, DimAccount.agency_name).all()
    data = []
    for r in rows:
        data.append({
            'platform': r.platform,
            'account_id': r.sub_account_id,
            'account_name': r.sub_account_name,
            'main_account_id': r.main_account_id,
            'sub_account_name': r.sub_account_name,
            'agency': r.agency_name,
            'business_model': r.business_model,
        })
    return jsonify({'success': True, 'data': data, 'total': len(data)})


@bp.route('/account-agency-mapping', methods=['GET'])
@handle_exceptions
def get_account_agency_mapping():
    return get_account_mapping()


@bp.route('/account-mapping', methods=['POST'])
@handle_exceptions
def create_account_mapping():
    body = request.get_json() or {}
    new_id = (db.session.query(DimAccount.id).order_by(DimAccount.id.desc()).first() or [0])[0] + 1
    row = DimAccount(
        id=new_id,
        platform=body.get('platform'),
        sub_account_id=body.get('account_id'),
        sub_account_name=body.get('account_name') or body.get('sub_account_name'),
        main_account_id=body.get('main_account_id'),
        main_account_name=body.get('main_account_name'),
        agency_name=body.get('agency'),
        agency_short=body.get('agency_short'),
        agency_letter=body.get('agency_letter'),
        business_model=body.get('business_model'),
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({'success': True, 'message': '创建成功', 'data': {'id': new_id}})


@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['PUT'])
@handle_exceptions
def update_account_mapping(platform, account_id):
    body = request.get_json() or {}
    row = db.session.query(DimAccount).filter(
        DimAccount.platform == platform, DimAccount.sub_account_id == account_id
    ).first()
    if not row:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    if body.get('agency') is not None:
        row.agency_name = body.get('agency')
    if body.get('agency_short') is not None:
        row.agency_short = body.get('agency_short')
    if body.get('agency_letter') is not None:
        row.agency_letter = body.get('agency_letter')
    if body.get('business_model') is not None:
        row.business_model = body.get('business_model')
    if body.get('account_name') is not None:
        row.sub_account_name = body.get('account_name')
    if body.get('main_account_id') is not None:
        row.main_account_id = body.get('main_account_id')
    if body.get('main_account_name') is not None:
        row.main_account_name = body.get('main_account_name')
    db.session.commit()
    return jsonify({'success': True, 'message': '更新成功'})


@bp.route('/account-mapping/<string:platform>/<string:account_id>', methods=['DELETE'])
@handle_exceptions
def delete_account_mapping(platform, account_id):
    row = db.session.query(DimAccount).filter(
        DimAccount.platform == platform, DimAccount.sub_account_id == account_id
    ).first()
    if not row:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({'success': True, 'message': '删除成功'})


@bp.route('/account-mapping/<string:platform>/main/<string:main_account_id>', methods=['DELETE'])
@handle_exceptions
def delete_account_mapping_by_main(platform, main_account_id):
    row = db.session.query(DimAccount).filter(
        DimAccount.platform == platform, DimAccount.main_account_id == main_account_id,
        DimAccount.sub_account_id.is_(None)
    ).first()
    if not row:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({'success': True, 'message': '删除成功'})
