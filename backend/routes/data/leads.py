# -*- coding: utf-8 -*-
"""线索明细接口（v2 - 查 fact_conv_content）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_
from backend.models_v2 import FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions

bp = Blueprint('leads', __name__)


def _row_to_dict(r):
    return {
        'wechat_nickname': r.微信昵称,
        'capital_account': r.资金账号,
        'opening_branch': r.开户营业部,
        'customer_gender': r.客户性别,
        'platform_source': r.平台来源,
        'traffic_type': r.流量类型,
        'customer_source': r.客户来源,
        'is_customer_mouth': bool(r.是否客户开口),
        'is_valid_lead': bool(r.是否有效线索),
        'is_open_account_interrupted': bool(r.是否开户中断),
        'open_account_interrupted_date': r.开户中断日期,
        'is_opened_account': bool(r.是否开户),
        'is_valid_customer': bool(r.是否为有效户),
        'is_existing_customer': bool(r.是否为存量客户),
        'is_existing_valid_customer': bool(r.是否为存量有效户),
        'is_delete_enterprise_wechat': bool(r.是否删除企微),
        'lead_date': r.线索日期,
        'first_contact_time': r.首次触达时间,
        'last_contact_time': r.最近互动时间,
        'account_opening_time': r.开户时间,
        'wechat_verify_status': str(r.微信认证状态) if r.微信认证状态 is not None else None,
        'wechat_verify_time': r.微信认证时间,
        'valid_customer_time': r.有效户时间,
        'ad_click_date': r.广告点击日期,
        'interaction_count': int(r.互动次数 or 0),
        'sales_interaction_count': float(r.营销人员互动次数 or 0),
        'assets': float(r.资产 or 0),
        'customer_contribution': float(r.客户贡献 or 0),
        'add_employee_no': str(r.添加员工号) if r.添加员工号 is not None else None,
        'add_employee_name': r.添加员工姓名,
        'ad_account': r.广告账号,
        'agency': r.广告代理商,
        'ad_id': r.广告ID,
        'creative_id': r.创意ID,
        'note_id': r.笔记ID,
        'note_title': r.笔记名称,
        'platform_user_id': r.平台用户ID,
        'platform_user_nickname': r.平台用户昵称,
        'producer': r.生产者,
        'enterprise_wechat_tags': r.企微标签,
    }


@bp.route('/leads-detail', methods=['GET'])
@handle_exceptions
def get_leads_detail():
    page = max(1, int(request.args.get('page', 1)))
    page_size = min(200, max(1, int(request.args.get('page_size', 50))))
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    platforms = [p for p in (request.args.get('platforms') or '').split(',') if p]
    agencies = [a for a in (request.args.get('agencies') or '').split(',') if a]
    employee_name = request.args.get('employee_name', '')
    is_opened_account = request.args.get('is_opened_account')

    q = db.session.query(FactConvContent)
    if start_date and end_date:
        q = q.filter(and_(FactConvContent.线索日期 >= start_date, FactConvContent.线索日期 <= end_date))
    if platforms:
        q = q.filter(FactConvContent.平台来源.in_(platforms))
    if agencies:
        q = q.filter(FactConvContent.广告代理商.in_(agencies))
    if employee_name:
        q = q.filter(FactConvContent.添加员工姓名 == employee_name)
    if is_opened_account == 'true':
        q = q.filter(FactConvContent.是否开户 == 1)
    elif is_opened_account == 'false':
        q = q.filter(or_(FactConvContent.是否开户 == 0, FactConvContent.是否开户.is_(None)))
    total = q.count()
    rows = q.order_by(FactConvContent.线索日期.desc()).limit(page_size).offset((page - 1) * page_size).all()
    items = [_row_to_dict(r) for r in rows]
    return jsonify({
        'success': True,
        'data': {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        }
    })


@bp.route('/leads-detail/filter-options', methods=['GET'])
@handle_exceptions
def get_filter_options():
    platforms = [r[0] for r in db.session.query(FactConvContent.平台来源).distinct()
                 .filter(FactConvContent.平台来源.isnot(None), FactConvContent.平台来源 != '')
                 .order_by(FactConvContent.平台来源).all()]
    employees = [r[0] for r in db.session.query(FactConvContent.添加员工姓名).distinct()
                 .filter(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '')
                 .order_by(FactConvContent.添加员工姓名).all()]
    return jsonify({
        'success': True,
        'data': {
            'platforms': [{'value': p, 'label': p} for p in platforms],
            'agencies': [],
            'employees': [{'value': e, 'label': e} for e in employees],
        }
    })
