# -*- coding: utf-8 -*-
"""线索明细接口（v2 - 查 fact_conv_content）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, case
from backend.models_v2 import FactConvContent
from backend.database import db
from backend.utils.decorators import handle_exceptions
from backend.utils.agency_mapper import expand_short_to_fulls, full_to_short

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
    """Bug 6: 主播聚类

    解析 客户来源 字段，识别 [平台]引流-[主播名字] 模式，按 (平台, 主播) 聚合。
    例: 视频号引流-姚立琦 -> (视频号, 姚立琦)
        抖音引流-赵茜 -> (抖音, 赵茜)
        财联社引流-谭记恩 -> (财联社, 谭记恩)
        广告投放-新客权益 -> (广告投放, 新客权益) (非引流类，跳过)

    返回: 每个主播的线索数 / 开口 / 开户 / 有效户 / 总资产
    """
    import re
    from sqlalchemy import case

    data = request.get_json() or {}
    filters = data.get('filters') or {}
    top_n = int(data.get('top_n', 50))

    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms_filter = filters.get('platforms') or []
    agencies_filter = filters.get('agencies') or []

    # 主播聚类正则: (平台)引流-(主播名)
    # 复合来源如 "视频号引流-姚立琦,视频号引流-蒋亦凡" 需按分隔符拆成多个主播归因。
    # v3.1.26: 存量剔除口径与 cost_analysis/conversion-funnel/split 对齐
    # 非存量条件: 是否为存量客户 == 0 OR IS NULL
    non_existing = or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None))

    base_q = db.session.query(
        FactConvContent.客户来源,
        FactConvContent.平台来源,
        func.count(FactConvContent.id).label('leads'),
        # 存量客户线索数（是否为存量客户==1）
        func.coalesce(func.sum(case((FactConvContent.是否为存量客户 == 1, 1), else_=0)), 0).label('existing_leads'),
        # 非存量客户线索数
        func.coalesce(func.sum(case((non_existing, 1), else_=0)), 0).label('new_leads'),
        func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
        func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
        func.coalesce(func.sum(case((FactConvContent.是否开户 == 1, 1), else_=0)), 0).label('opened'),
        # 非存量有效线索(剔除存量)
        func.coalesce(func.sum(case(
            (and_(FactConvContent.是否有效线索 == 1, non_existing), 1), else_=0
        )), 0).label('new_valid_lead'),
        # 非存量且开户成功
        func.coalesce(func.sum(case(
            (and_(FactConvContent.是否开户 == 1, non_existing), 1), else_=0
        )), 0).label('new_opened'),
        func.coalesce(func.sum(case((FactConvContent.是否为有效户 == 1, 1), else_=0)), 0).label('valid'),
        # 非存量且有效户
        func.coalesce(func.sum(case(
            (and_(FactConvContent.是否为有效户 == 1, non_existing), 1), else_=0
        )), 0).label('new_valid'),
        # v3.1.25: 资产拆分新开 vs 存量
        func.coalesce(func.sum(case(
            (non_existing, FactConvContent.资产),
            else_=0
        )), 0).label('new_assets'),
        func.coalesce(func.sum(case(
            (FactConvContent.是否为存量客户 == 1, FactConvContent.资产),
            else_=0
        )), 0).label('existing_assets'),
        func.coalesce(func.sum(FactConvContent.资产), 0).label('assets'),
    ).filter(
        and_(
            FactConvContent.客户来源.isnot(None),
            FactConvContent.客户来源 != '',
        )
    )
    if sd and ed:
        base_q = base_q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms_filter:
        base_q = base_q.filter(FactConvContent.平台来源.in_(platforms_filter))
    if agencies_filter:
        base_q = base_q.filter(FactConvContent.广告代理商.in_(agencies_filter))

    base_q = base_q.group_by(FactConvContent.客户来源, FactConvContent.平台来源)
    rows = base_q.all()

    # 在 Python 端按 (platform, anchor) 聚类
    PATTERN = re.compile(r"^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$")
    SPLIT_PATTERN = re.compile(r"[,，;；、]+")

    agg_map = {}
    for r in rows:
        src = (r.客户来源 or "").strip()
        matches = []
        for part in SPLIT_PATTERN.split(src):
            segment = part.strip()
            if not segment:
                continue
            m = PATTERN.match(segment)
            if not m:
                continue
            anchor_platform = m.group(1)
            anchor_name = m.group(2).strip()
            if not anchor_name:
                continue
            matches.append((anchor_platform, anchor_name, segment))

        # 同一个原始来源里若重复出现同一主播，只归因一次。
        for anchor_platform, anchor_name, segment in sorted(set(matches)):
            key = f"{anchor_platform}|||{anchor_name}"
            if key not in agg_map:
                agg_map[key] = {
                    'platform': anchor_platform,
                    'anchor': anchor_name,
                    'leads': 0,
                    'existing_leads': 0,
                    'new_leads': 0,
                    'mouth': 0,
                    'valid_lead': 0,
                    'new_valid_lead': 0,
                    'opened': 0,
                    'new_opened': 0,
                    'valid': 0,
                    'new_valid': 0,
                    'new_assets': 0.0,
                    'existing_assets': 0.0,
                    'assets': 0.0,
                    'raw_sources': set(),
                }
            a = agg_map[key]
            a['leads'] += int(r.leads or 0)
            a['existing_leads'] += int(r.existing_leads or 0)
            a['new_leads'] += int(r.new_leads or 0)
            a['mouth'] += int(r.mouth or 0)
            a['valid_lead'] += int(r.valid_lead or 0)
            a['new_valid_lead'] += int(r.new_valid_lead or 0)
            a['opened'] += int(r.opened or 0)
            a['new_opened'] += int(r.new_opened or 0)
            a['valid'] += int(r.valid or 0)
            a['new_valid'] += int(r.new_valid or 0)
            a['new_assets'] += float(r.new_assets or 0)
            a['existing_assets'] += float(r.existing_assets or 0)
            a['assets'] += float(r.assets or 0)
            a['raw_sources'].add(segment)

    items = []
    for a in agg_map.values():
        leads = a['leads']
        existing_leads = a['existing_leads']
        new_leads = a['new_leads']
        opened = a['opened']
        new_opened = a['new_opened']
        valid = a['valid']
        new_valid = a['new_valid']
        new_valid_lead = a['new_valid_lead']
        items.append({
            'platform': a['platform'],
            'anchor': a['anchor'],
            'leads': leads,
            'existing_leads': existing_leads,
            'new_leads': new_leads,
            'mouth': a['mouth'],
            'valid_lead': a['valid_lead'],
            'new_valid_lead': new_valid_lead,
            'opened': opened,
            'new_opened': new_opened,
            'existing_opened': opened - new_opened,
            'valid': valid,
            'new_valid': new_valid,
            'existing_valid': valid - new_valid,
            'new_assets': round(a['new_assets'], 2),
            'existing_assets': round(a['existing_assets'], 2),
            'assets': round(a['assets'], 2),
            # 漏斗转化率按新口径计算（线索 → 非存量有效线索 → 非存量开户 → 非存量有效户）
            'opening_rate': round(new_opened / leads * 100, 2) if leads > 0 else 0,
            'valid_rate': round(new_valid / leads * 100, 2) if leads > 0 else 0,
            'sources': sorted(a['raw_sources']),
        })
    items.sort(key=lambda x: (x['leads'], x['new_opened']), reverse=True)

    totals = {
        'total_anchors': len(items),
        'total_leads': sum(i['leads'] for i in items),
        'total_existing_leads': sum(i['existing_leads'] for i in items),
        'total_new_leads': sum(i['new_leads'] for i in items),
        'total_valid_lead': sum(i['valid_lead'] for i in items),
        'total_new_valid_lead': sum(i['new_valid_lead'] for i in items),
        'total_opened': sum(i['opened'] for i in items),
        'total_new_opened': sum(i['new_opened'] for i in items),
        'total_existing_opened': sum(i['existing_opened'] for i in items),
        'total_valid': sum(i['valid'] for i in items),
        'total_new_valid': sum(i['new_valid'] for i in items),
        'total_existing_valid': sum(i['existing_valid'] for i in items),
        'total_new_assets': round(sum(i['new_assets'] for i in items), 2),
        'total_existing_assets': round(sum(i['existing_assets'] for i in items), 2),
        'total_assets': round(sum(i['assets'] for i in items), 2),
    }

    return jsonify({
        'success': True,
        'data': {
            'items': items[:top_n],
            'totals': totals,
            'top_n': top_n,
            'all_count': len(items),
            'platforms': sorted(set(i['platform'] for i in items)),
        },
        'meta': {
            'version': 'v3.1.26-anchor-cluster',
            'source': 'fact_conv_content.客户来源',
            'pattern': '^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$',
            'note': '按 客户来源 中"平台引流-主播"模式聚合；复合来源会拆分并分别归因给每个主播。v3.1.26 起新增 existing_leads/new_leads/new_valid_lead/new_valid 字段。存量客户(是否为存量客户==1)线索计入 existing_leads，但其开户/有效户通常=0(已在别处开户)，其资产计入 existing_assets；非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 对齐。',
        },
    })


@bp.route('/leads-detail/anchor-clusters-trend', methods=['POST'])
@handle_exceptions
def get_anchor_clusters_trend():
    """主播引流走势 (v3.1.27)"""
    from collections import defaultdict
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    granularity = data.get('granularity', 'daily')
    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms_filter = filters.get('platforms') or []
    agencies_filter = filters.get('agencies') or []
    if granularity == 'weekly':
        granularity = 'weekly'
        period_expr = (
            func.substr(FactConvContent.线索日期, 1, 4)
            + '-W'
            + func.substr(func.concat('0', func.strftime('%W', FactConvContent.线索日期)), -2)
        )
    elif granularity == 'monthly':
        granularity = 'monthly'
        period_expr = func.substr(FactConvContent.线索日期, 1, 7)
    else:
        granularity = 'daily'
        period_expr = func.substr(FactConvContent.线索日期, 1, 10)
    period_label = period_expr.label('period')
    non_existing = or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None))
    q = db.session.query(
        period_label,
        FactConvContent.平台来源.label('platform'),
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
        func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否开户 == 1, non_existing), 1), else_=0)), 0).label('new_opened'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否为有效户 == 1, non_existing), 1), else_=0)), 0).label('new_valid'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否开户 == 1, non_existing), FactConvContent.资产), else_=0)), 0).label('new_assets'),
    ).filter(and_(
        FactConvContent.客户来源.isnot(None),
        FactConvContent.客户来源 != '',
        FactConvContent.客户来源.like('%引流-%'),
    ))
    if sd and ed:
        q = q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms_filter:
        q = q.filter(FactConvContent.平台来源.in_(platforms_filter))
    if agencies_filter:
        q = q.filter(FactConvContent.广告代理商.in_(agencies_filter))
    rows = q.group_by('period', FactConvContent.平台来源).order_by('period', FactConvContent.平台来源).all()
    pt = defaultdict(lambda: {'leads':0,'mouth':0,'valid_lead':0,'new_opened':0,'new_valid':0,'new_assets':0.0})
    pp = defaultdict(lambda: defaultdict(lambda: {'leads':0,'mouth':0,'valid_lead':0,'new_opened':0,'new_valid':0,'new_assets':0.0}))
    all_platforms = set()
    for r in rows:
        period = r.period
        platform = r.platform or '未知'
        all_platforms.add(platform)
        b = pt[period]
        b['leads'] += int(r.leads or 0)
        b['mouth'] += int(r.mouth or 0)
        b['valid_lead'] += int(r.valid_lead or 0)
        b['new_opened'] += int(r.new_opened or 0)
        b['new_valid'] += int(r.new_valid or 0)
        b['new_assets'] += float(r.new_assets or 0)
        bx = pp[period][platform]
        bx['leads'] += int(r.leads or 0)
        bx['mouth'] += int(r.mouth or 0)
        bx['valid_lead'] += int(r.valid_lead or 0)
        bx['new_opened'] += int(r.new_opened or 0)
        bx['new_valid'] += int(r.new_valid or 0)
        bx['new_assets'] += float(r.new_assets or 0)
    periods = sorted(pt.keys())
    return jsonify({
        'success': True,
        'data': {
            'granularity': granularity,
            'periods': periods,
            'totals': {p: dict(pt[p]) for p in periods},
            'by_platform': {
                p: {pl: dict(pp[p][pl]) for pl in pp[p]}
                for p in periods
            },
            'platforms': sorted(all_platforms),
            'meta': {
                'version': 'v3.1.27-anchor-trend',
                'source': 'fact_conv_content.客户来源',
                'pattern': '%引流-%',
                'note': '按 (period, platform) 聚合，主播层面落到平台维度。period 由 granularity 决定：daily=YYYY-MM-DD，weekly=YYYY-Www，monthly=YYYY-MM。存量客户只贡献存量资产，new_opened/new_valid/new_assets 仅含非存量，与 anchor-clusters 口径一致。',
            }
        }
    })


