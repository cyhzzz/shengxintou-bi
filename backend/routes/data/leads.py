# -*- coding: utf-8 -*-
"""线索明细接口（v2 - 查 fact_conv_content）

主播归因相关计算（聚类 / 走势 / 周度分析）已收敛到
backend/utils/anchor_attribution.py（唯一权威源），本文件只保留路由壳与明细查询。
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import and_, or_
from backend.models_v2 import FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import full_to_short
from backend.utils.anchor_attribution import (
    compute_anchor_cluster_items,
    build_anchor_clusters_payload,
    anchor_clusters_trend_response,
    anchor_weekly_analysis_response,
)

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
    agencies_raw = [r[0] for r in db.session.query(FactConvContent.广告代理商).distinct()
                .filter(FactConvContent.广告代理商.isnot(None), FactConvContent.广告代理商 != '')
                .order_by(FactConvContent.广告代理商).all()]
    agencies = sorted(set(full_to_short(a) for a in agencies_raw))
    employees = [r[0] for r in db.session.query(FactConvContent.添加员工姓名).distinct()
                 .filter(FactConvContent.添加员工姓名.isnot(None), FactConvContent.添加员工姓名 != '')
                 .order_by(FactConvContent.添加员工姓名).all()]
    return jsonify({
        'success': True,
        'data': {
            'platforms': [{'value': p, 'label': p} for p in platforms],
            'agencies': [{'value': a, 'label': a} for a in agencies],
            'employees': [{'value': e, 'label': e} for e in employees],
        }
    })


@bp.route('/leads-detail/anchor-clusters', methods=['POST'])
@handle_exceptions
def get_anchor_clusters():
    """主播聚类：解析 客户来源 为 (平台, 主播)，聚合线索/开口/开户/有效户/资产。

    计算体见 backend/utils/anchor_attribution.py（唯一权威源，周报详细版共用）。
    """
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    top_n = int(data.get('top_n', 50))

    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms_filter = filters.get('platforms') or []
    agencies_filter = filters.get('agencies') or []
    # 直播类型筛选（分析师/投顾IP/投顾配合做带货/带货直播）
    live_types_filter = filters.get('live_types') or []

    items = compute_anchor_cluster_items(sd, ed, platforms_filter, agencies_filter, live_types_filter)
    payload = build_anchor_clusters_payload(items, top_n)
    return jsonify({'success': True, **payload})


@bp.route('/leads-detail/anchor-clusters-trend', methods=['POST'])
@handle_exceptions
def get_anchor_clusters_trend():
    """主播引流走势 (v3.1.27, v3.3.0 加 live_types 过滤)。计算体见 anchor_attribution.py。"""
    data = request.get_json() or {}
    payload = anchor_clusters_trend_response(data.get('granularity', 'daily'), data.get('filters') or {})
    return jsonify({'success': True, 'data': payload})


@bp.route('/leads-detail/anchor-weekly-analysis', methods=['POST'])
@handle_exceptions
def get_anchor_weekly_analysis():
    """主播周度拿量 + 各环节转化率分析。计算体见 anchor_attribution.py。

    入参: filters={start_date, end_date, platforms, live_types}, top_n（默认 30）
    """
    data = request.get_json() or {}
    payload = anchor_weekly_analysis_response(data.get('filters') or {}, int(data.get('top_n', 30)))
    return jsonify({'success': True, **payload})
