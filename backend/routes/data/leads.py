# -*- coding: utf-8 -*-
"""线索明细接口（v2 - 查 fact_conv_content）"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, case
from backend.models_v2 import FactConvContent, DimAnchorLiveType
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
    # 直播类型筛选（分析师/投顾IP/投顾配合做带货/带货直播）
    live_types_filter = filters.get('live_types') or []

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

    # 加载主播直播类型映射表（source_token -> {anchor_name, live_type, remark}）
    # 用于给每个 (platform, anchor) 聚类项打 live_type 标签 + 归一化 anchor_name（错字校正）
    live_type_rows = db.session.query(
        DimAnchorLiveType.source_token,
        DimAnchorLiveType.anchor_name,
        DimAnchorLiveType.live_type,
        DimAnchorLiveType.is_active,
    ).all()
    token_to_anchor = {}  # source_token -> 归一化 anchor_name
    token_to_live_type = {}  # source_token -> live_type
    anchor_to_live_types = {}  # 归一化 anchor_name -> set(live_type)
    for lt_row in live_type_rows:
        if not lt_row.is_active:
            continue
        token_to_anchor[lt_row.source_token] = lt_row.anchor_name
        token_to_live_type[lt_row.source_token] = lt_row.live_type
        anchor_to_live_types.setdefault(lt_row.anchor_name, set()).add(lt_row.live_type)

    # 在 Python 端按 (platform, anchor) 聚类
    PATTERN = re.compile(r"^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$")
    SPLIT_PATTERN = re.compile(r"[,，;；、]+")

    # 平台归一化 — 把正则抽出的引流平台映射到 fact_conv_content.平台来源 的实际值
    # 数据库 平台来源 字段只有「腾讯/抖音/小红书/财联社/yj/快手/高德」，没有「视频号」/「微信」
    # 但「视频号引流-XXX」/「微信引流-XXX」的记录在数据库中都归在 平台来源='腾讯' 下
    # 若不归一化，前端筛选项会出现「视频号」但用 平台来源.in_(['视频号']) 过滤会命中 0 行
    PLATFORM_NORMALIZE = {
        '视频号': '腾讯',
        '视频号直播': '腾讯',
        '微信': '腾讯',
    }

    # 预提取纯人名 token (JSON 里不含"引流-"/"直播带货-"的 source_token，如"黄天平"/"赵茜")
    # 数据库"客户来源"字段可能是纯人名（分支投顾自IP），PATTERN 不匹配，需按 token 归类
    plain_name_tokens = {tok for tok in token_to_anchor
                         if '引流-' not in tok and '直播带货-' not in tok}

    agg_map = {}
    for r in rows:
        src = (r.客户来源 or "").strip()
        matches = []
        for part in SPLIT_PATTERN.split(src):
            segment = part.strip()
            if not segment:
                continue
            m = PATTERN.match(segment)
            if m:
                anchor_platform = m.group(1)
                # 归一化平台名，让前端筛选项与 fact_conv_content.平台来源 一致
                anchor_platform = PLATFORM_NORMALIZE.get(anchor_platform, anchor_platform)
                raw_anchor_name = m.group(2).strip()
                if not raw_anchor_name:
                    continue
                # 通过 dim_anchor_live_type 表做 anchor_name 归一化 + 错字校正
                # segment 是原始 token（如"直播带货-胡磊" / "抖音引流-直播带货-胡磊"）
                # 若 token 在表中，用表里的 anchor_name；否则用正则解析的 raw_anchor_name
                normalized_anchor = token_to_anchor.get(segment, raw_anchor_name)
                matches.append((anchor_platform, normalized_anchor, segment))
            elif segment in plain_name_tokens:
                # 纯人名 token（如"黄天平"），平台用该记录的平台来源
                anchor_platform = (r.平台来源 or '').strip()
                normalized_anchor = token_to_anchor.get(segment, segment)
                matches.append((anchor_platform, normalized_anchor, segment))

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
                    'live_types': set(),  # 该 anchor 跨 token 涉及的所有直播类型
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
            # 累加该 anchor 的直播类型
            # 优先用 segment 精确查 token；查不到则用归一化 anchor_name 查该主播所有 live_type 兜底
            # （数据库"客户来源"字段值可能与 JSON source_token 有细微差异，但主播名能对上）
            lt = token_to_live_type.get(segment)
            if lt:
                a['live_types'].add(lt)
            elif anchor_name in anchor_to_live_types:
                for t in anchor_to_live_types[anchor_name]:
                    a['live_types'].add(t)

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
        # live_types 取该 anchor 跨 token 涉及的所有类型
        # 若配置表里该 anchor 涉及多种类型（如胡磊既有"投顾IP"又有"投顾配合做带货"），
        # 则取第一个非空的类型作为 primary live_type，其余放入 secondary_live_types
        anchor_live_types = sorted(a['live_types']) if a['live_types'] else []
        # 优先级：若 anchor 在配置表中只有一种类型，直接用；若多种，按线索量来源最多的 token 决定
        # 简化：直接取第一个，余下放 secondary
        primary_live_type = anchor_live_types[0] if anchor_live_types else None
        secondary_live_types = anchor_live_types[1:] if len(anchor_live_types) > 1 else []
        items.append({
            'platform': a['platform'],
            'anchor': a['anchor'],
            'live_type': primary_live_type,  # 直播类型（分析师/投顾IP/投顾配合做带货/带货直播/None=未映射）
            'live_types': anchor_live_types,  # 该 anchor 涉及的全部直播类型
            'secondary_live_types': secondary_live_types,
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

    # live_types 筛选（保留 items 中 live_types 与筛选有交集的项）
    if live_types_filter:
        wanted = set(live_types_filter)
        items = [i for i in items if set(i['live_types']) & wanted]

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

    # 按 live_type 拆分的汇总（用于前端类型对比卡片）
    live_type_breakdown = {}
    for i in items:
        lt = i['live_type'] or '未映射'
        if lt not in live_type_breakdown:
            live_type_breakdown[lt] = {
                'live_type': lt,
                'anchors': 0,
                'leads': 0,
                'new_leads': 0,
                'new_opened': 0,
                'new_valid': 0,
                'new_assets': 0.0,
            }
        b = live_type_breakdown[lt]
        b['anchors'] += 1
        b['leads'] += i['leads']
        b['new_leads'] += i['new_leads']
        b['new_opened'] += i['new_opened']
        b['new_valid'] += i['new_valid']
        b['new_assets'] += i['new_assets']
    for b in live_type_breakdown.values():
        b['new_assets'] = round(b['new_assets'], 2)
        b['opening_rate'] = round(b['new_opened'] / b['leads'] * 100, 2) if b['leads'] > 0 else 0
        b['valid_rate'] = round(b['new_valid'] / b['leads'] * 100, 2) if b['leads'] > 0 else 0

    return jsonify({
        'success': True,
        'data': {
            'items': items[:top_n],
            'totals': totals,
            'live_type_breakdown': list(live_type_breakdown.values()),
            'top_n': top_n,
            'all_count': len(items),
            'platforms': sorted(set(i['platform'] for i in items)),
            'live_types': sorted(set(lt for i in items for lt in i['live_types'])),
        },
        'meta': {
            'version': 'anchor-cluster-with-live-type',
            'source': 'fact_conv_content.客户来源 + dim_anchor_live_type',
            'pattern': '^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$',
            'note': '新增 live_type / live_types / secondary_live_types 字段，由 dim_anchor_live_type 表按 source_token 映射得到；支持 live_types 筛选参数；新增 live_type_breakdown 按直播类型拆分汇总。存量剔除口径与非存量条件一致（是否为存量客户==0 OR IS NULL）。未在配置表的 token 仍按正则解析得到 anchor_name，但 live_type=None。',
        },
    })


@bp.route('/leads-detail/anchor-clusters-trend', methods=['POST'])
@handle_exceptions
def get_anchor_clusters_trend():
    """主播引流走势 (v3.1.27, v3.3.0 加 live_types 过滤)"""
    from collections import defaultdict
    import re
    data = request.get_json() or {}
    filters = data.get('filters') or {}
    granularity = data.get('granularity', 'daily')
    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms_filter = filters.get('platforms') or []
    agencies_filter = filters.get('agencies') or []
    # 直播类型筛选
    live_types_filter = filters.get('live_types') or []  # noqa: F841

    if granularity == 'weekly':
        granularity = 'weekly'
        # dialect 无关：SQLite strftime('%Y-%W') / PG to_char('YYYY-IW')
        from backend.utils.dialect_helpers import make_period_expr
        period_expr = make_period_expr(FactConvContent.线索日期, 'weekly')
    elif granularity == 'monthly':
        granularity = 'monthly'
        period_expr = func.substr(FactConvContent.线索日期, 1, 7)
    else:
        granularity = 'daily'
        period_expr = func.substr(FactConvContent.线索日期, 1, 10)
    period_label = period_expr.label('period')
    non_existing = or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None))

    # 预加载 dim_anchor_live_type 表，构建 plain_name_tokens
    # 纯人名 token（如"黄天平"）不含"引流-"，原有的 like('%引流-%') 过滤
    # 会漏掉这些记录，导致日历年度总开户数偏少
    lt_rows_all = db.session.query(
        DimAnchorLiveType.source_token,
        DimAnchorLiveType.live_type,
        DimAnchorLiveType.is_active,
    ).all()
    plain_name_tokens = {row.source_token for row in lt_rows_all
                         if row.is_active and '引流-' not in row.source_token and '直播带货-' not in row.source_token}

    source_filter = and_(
        FactConvContent.客户来源.isnot(None),
        FactConvContent.客户来源 != '',
    )
    if plain_name_tokens:
        source_filter = and_(
            source_filter,
            or_(
                FactConvContent.客户来源.like('%引流-%'),
                FactConvContent.客户来源.in_(plain_name_tokens),
            ),
        )
    else:
        source_filter = and_(source_filter, FactConvContent.客户来源.like('%引流-%'))

    q = db.session.query(
        period_label,
        FactConvContent.平台来源.label('platform'),
        FactConvContent.客户来源,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(case((non_existing, 1), else_=0)), 0).label('new_leads'),
        func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
        func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否开户 == 1, non_existing), 1), else_=0)), 0).label('new_opened'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否为有效户 == 1, non_existing), 1), else_=0)), 0).label('new_valid'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否开户 == 1, non_existing), FactConvContent.资产), else_=0)), 0).label('new_assets'),
    ).filter(source_filter)
    if sd and ed:
        q = q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms_filter:
        q = q.filter(FactConvContent.平台来源.in_(platforms_filter))
    if agencies_filter:
        q = q.filter(FactConvContent.广告代理商.in_(agencies_filter))

    # 若启用 live_types 筛选，从已加载的 lt_rows_all 构建 wanted_tokens
    # （包含纯人名 token，与 get_anchor_clusters 口径一致）
    wanted_tokens = set()
    if live_types_filter:
        wanted = set(live_types_filter)
        for lt_row in lt_rows_all:
            if not lt_row.is_active:
                continue
            if lt_row.live_type in wanted:
                wanted_tokens.add(lt_row.source_token)

    rows = q.group_by('period', FactConvContent.平台来源, FactConvContent.客户来源).order_by('period', FactConvContent.平台来源).all()
    pt = defaultdict(lambda: {'leads':0,'new_leads':0,'mouth':0,'valid_lead':0,'new_opened':0,'new_valid':0,'new_assets':0.0})
    pp = defaultdict(lambda: defaultdict(lambda: {'leads':0,'new_leads':0,'mouth':0,'valid_lead':0,'new_opened':0,'new_valid':0,'new_assets':0.0}))
    all_platforms = set()
    SPLIT_PATTERN = re.compile(r"[,，;；、]+")
    for r in rows:
        # live_types 筛选 — 拆 客户来源 token，看是否命中 wanted_tokens
        if live_types_filter:
            src = (r.客户来源 or '').strip()
            tokens = [t.strip() for t in SPLIT_PATTERN.split(src) if t.strip()]
            if not any(t in wanted_tokens for t in tokens):
                continue
        period = r.period
        platform = r.platform or '未知'
        all_platforms.add(platform)
        b = pt[period]
        b['leads'] += int(r.leads or 0)
        b['new_leads'] += int(r.new_leads or 0)
        b['mouth'] += int(r.mouth or 0)
        b['valid_lead'] += int(r.valid_lead or 0)
        b['new_opened'] += int(r.new_opened or 0)
        b['new_valid'] += int(r.new_valid or 0)
        b['new_assets'] += float(r.new_assets or 0)
        bx = pp[period][platform]
        bx['leads'] += int(r.leads or 0)
        bx['new_leads'] += int(r.new_leads or 0)
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
                'version': 'anchor-trend-with-live-type',
                'source': 'fact_conv_content.客户来源 + dim_anchor_live_type',
                'pattern': '%引流-% or plain_name_tokens',
                'note': '支持 live_types 筛选：按 dim_anchor_live_type 表中 source_token 集合过滤原始 客户来源。按 (period, platform) 聚合，主播层面落到平台维度。period 由 granularity 决定：daily=YYYY-MM-DD，weekly=YYYY-Www，monthly=YYYY-MM。存量客户只贡献存量资产，new_opened/new_valid/new_assets 仅含非存量，与 anchor-clusters 口径一致。',
            }
        }
    })


@bp.route('/leads-detail/anchor-weekly-analysis', methods=['POST'])
@handle_exceptions
def get_anchor_weekly_analysis():
    """主播周度拿量 + 各环节转化率分析

    业务定位：对齐应用市场 plan-analysis 的「主播 × 周」交叉表设计，
    回答两个核心问题：
      1. 拿量能力：主播线索/开户/有效户是否衰减（周度量趋势）
      2. 精准性变化：各漏斗节点转化率是否稳定（周度率趋势）

    数据源: fact_conv_content（按 主播 × 周起始日 聚合）
    入参:
      filters: { start_date, end_date, platforms, live_types }
      top_n: int，Top N 主播（默认 30，按新开户降序）
    返回:
      anchors: 主播列表
      weekly_totals: 整体周度走势
      anchor_items: [{anchor, live_type, totals, weekly}]
      totals: 整体汇总
    """
    import re as _re
    from backend.utils.dialect_helpers import make_week_start_expr

    data = request.get_json() or {}
    filters = data.get('filters') or {}
    top_n = int(data.get('top_n', 30))
    sd = filters.get('start_date')
    ed = filters.get('end_date')
    platforms_filter = filters.get('platforms') or []
    live_types_filter = filters.get('live_types') or []

    # 周起始日（dialect 无关）：SQLite date(d, 'weekday 0', '-6 days')；PG date_trunc('week', d::date)
    week_start_expr = make_week_start_expr(FactConvContent.线索日期).label('week_start')
    non_existing = or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None))

    # 预加载 dim_anchor_live_type 表（与 get_anchor_clusters 同口径）
    lt_rows_all = db.session.query(
        DimAnchorLiveType.source_token,
        DimAnchorLiveType.anchor_name,
        DimAnchorLiveType.live_type,
        DimAnchorLiveType.is_active,
    ).all()
    token_to_anchor = {r.source_token: r.anchor_name for r in lt_rows_all if r.is_active}
    token_to_live_type = {r.source_token: r.live_type for r in lt_rows_all if r.is_active}
    anchor_to_live_types = {}
    for r in lt_rows_all:
        if r.is_active:
            anchor_to_live_types.setdefault(r.anchor_name, set()).add(r.live_type)
    plain_name_tokens = {tok for tok in token_to_anchor
                         if '引流-' not in tok and '直播带货-' not in tok}

    source_filter = and_(
        FactConvContent.客户来源.isnot(None),
        FactConvContent.客户来源 != '',
    )
    if plain_name_tokens:
        source_filter = and_(
            source_filter,
            or_(
                FactConvContent.客户来源.like('%引流-%'),
                FactConvContent.客户来源.in_(plain_name_tokens),
            ),
        )
    else:
        source_filter = and_(source_filter, FactConvContent.客户来源.like('%引流-%'))

    # live_types 筛选为 token 级（与 get_anchor_clusters 完全一致）
    # 不能用主播级筛选：一个主播在 dim 表里可能有多 token，分别属于不同 live_type
    # （如黄天平有 '视频号引流-黄天平'(分析师) 和 '抖音引流-黄天平'(带货直播)）。
    # 主播级筛选会把该主播所有 token 都算进来，包括非目标 live_type 的 token，导致口径偏宽。
    wanted_live_types = set(live_types_filter) if live_types_filter else set()

    # SQL 按 (week, platform, 客户来源) 聚合 6 阶段 SUM（主播归一化在 Python 端做）
    q = db.session.query(
        week_start_expr,
        FactConvContent.平台来源.label('platform'),
        FactConvContent.客户来源,
        func.count(FactConvContent.id).label('leads'),
        func.coalesce(func.sum(case((FactConvContent.是否客户开口 == 1, 1), else_=0)), 0).label('mouth'),
        func.coalesce(func.sum(case((FactConvContent.是否有效线索 == 1, 1), else_=0)), 0).label('valid_lead'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否有效线索 == 1, non_existing), 1), else_=0)), 0).label('new_valid_lead'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否开户 == 1, non_existing), 1), else_=0)), 0).label('new_opened'),
        func.coalesce(func.sum(case((and_(FactConvContent.是否为有效户 == 1, non_existing), 1), else_=0)), 0).label('new_valid'),
    ).filter(source_filter)
    if sd and ed:
        q = q.filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    if platforms_filter:
        q = q.filter(FactConvContent.平台来源.in_(platforms_filter))
    rows = q.group_by(week_start_expr, FactConvContent.平台来源, FactConvContent.客户来源).all()

    # Python 端按 (anchor, week) 二次聚合（复用 get_anchor_clusters 的 token 拆分逻辑）
    PATTERN = _re.compile(r"^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$")
    SPLIT_PATTERN = _re.compile(r"[,，;；、]+")
    PLATFORM_NORMALIZE = {'视频号': '腾讯', '视频号直播': '腾讯', '微信': '腾讯'}

    anchor_map = {}   # anchor_name -> {totals: {...}, weekly: {week: {...}}}
    weekly_agg = {}   # week_start -> totals（整体）
    all_anchors = set()

    def _calc_rates(leads, mouth, valid_lead, new_valid_lead, new_opened, new_valid):
        """直播 6 阶段漏斗的 5 个转化率。"""
        return {
            '线索_开口率': round(mouth / leads * 100, 2) if leads > 0 else 0,
            '开口_有效率': round(valid_lead / mouth * 100, 2) if mouth > 0 else 0,
            '有效_非存量率': round(new_valid_lead / valid_lead * 100, 2) if valid_lead > 0 else 0,
            '非存量_新开户率': round(new_opened / new_valid_lead * 100, 2) if new_valid_lead > 0 else 0,
            '新开户_新有效率': round(new_valid / new_opened * 100, 2) if new_opened > 0 else 0,
        }

    for r in rows:
        week = str(r.week_start)[:10] if r.week_start is not None else '未知周'
        src = (r.客户来源 or '').strip()
        matches = []  # (anchor_name, segment, segment_live_types)
        for part in SPLIT_PATTERN.split(src):
            segment = part.strip()
            if not segment:
                continue
            m = PATTERN.match(segment)
            if m:
                anchor_platform = PLATFORM_NORMALIZE.get(m.group(1), m.group(1))
                raw_anchor_name = m.group(2).strip()
                if not raw_anchor_name:
                    continue
                normalized_anchor = token_to_anchor.get(segment, raw_anchor_name)
            elif segment in plain_name_tokens:
                normalized_anchor = token_to_anchor.get(segment, segment)
            else:
                continue

            # token 级 live_type：先查 token 精确匹配，回退到该主播的所有 live_type
            seg_lt = token_to_live_type.get(segment)
            if seg_lt:
                seg_lts = {seg_lt}
            else:
                seg_lts = set(anchor_to_live_types.get(normalized_anchor, set()))

            # live_types 筛选：只保留 live_types 与 wanted 有交集的 (anchor, segment)
            if wanted_live_types and not (seg_lts & wanted_live_types):
                continue

            matches.append((normalized_anchor, segment))

        if not matches:
            continue

        for anchor_name, segment in sorted(set(matches)):
            if anchor_name not in anchor_map:
                # 取该主播的 primary live_type
                anchor_lts = sorted(anchor_to_live_types.get(anchor_name, set()))
                primary_lt = anchor_lts[0] if anchor_lts else None
                anchor_map[anchor_name] = {
                    'anchor': anchor_name,
                    'live_type': primary_lt,
                    'totals': {'leads': 0, 'mouth': 0, 'valid_lead': 0, 'new_valid_lead': 0, 'new_opened': 0, 'new_valid': 0},
                    'weekly': {},
                }
                all_anchors.add(anchor_name)

            a = anchor_map[anchor_name]
            for k in ('leads', 'mouth', 'valid_lead', 'new_valid_lead', 'new_opened', 'new_valid'):
                a['totals'][k] += int(getattr(r, k) or 0)
            w = a['weekly'].setdefault(week, {'leads': 0, 'mouth': 0, 'valid_lead': 0, 'new_valid_lead': 0, 'new_opened': 0, 'new_valid': 0})
            w['leads'] += int(r.leads or 0)
            w['mouth'] += int(r.mouth or 0)
            w['valid_lead'] += int(r.valid_lead or 0)
            w['new_valid_lead'] += int(r.new_valid_lead or 0)
            w['new_opened'] += int(r.new_opened or 0)
            w['new_valid'] += int(r.new_valid or 0)

            # 整体周度汇总
            if week not in weekly_agg:
                weekly_agg[week] = {'leads': 0, 'mouth': 0, 'valid_lead': 0, 'new_valid_lead': 0, 'new_opened': 0, 'new_valid': 0}
            for k in ('leads', 'mouth', 'valid_lead', 'new_valid_lead', 'new_opened', 'new_valid'):
                weekly_agg[week][k] += int(getattr(r, k) or 0)

    # 组装 anchor_items + 派生率
    anchor_items = []
    for a in anchor_map.values():
        t = a['totals']
        a['totals'] = {**t, **_calc_rates(t['leads'], t['mouth'], t['valid_lead'], t['new_valid_lead'], t['new_opened'], t['new_valid'])}
        weekly_list = []
        for wk in sorted(a['weekly'].keys()):
            w = a['weekly'][wk]
            weekly_list.append({
                'week_start': wk,
                **w,
                **_calc_rates(w['leads'], w['mouth'], w['valid_lead'], w['new_valid_lead'], w['new_opened'], w['new_valid']),
            })
        a['weekly'] = weekly_list
        anchor_items.append(a)

    # Top N 排序（按新开户 → 线索量 降序）
    anchor_items.sort(key=lambda x: (x['totals']['new_opened'], x['totals']['leads']), reverse=True)
    top_anchors = anchor_items[:top_n]

    # 整体周度走势
    weekly_totals = []
    for wk in sorted(weekly_agg.keys()):
        t = weekly_agg[wk]
        weekly_totals.append({
            'week_start': wk,
            **t,
            **_calc_rates(t['leads'], t['mouth'], t['valid_lead'], t['new_valid_lead'], t['new_opened'], t['new_valid']),
        })

    # 整体汇总
    totals = {
        'total_anchors': len(anchor_items),
        'top_anchors': len(top_anchors),
        'total_leads': sum(a['totals']['leads'] for a in anchor_items),
        'total_new_valid_lead': sum(a['totals']['new_valid_lead'] for a in anchor_items),
        'total_new_opened': sum(a['totals']['new_opened'] for a in anchor_items),
        'total_new_valid': sum(a['totals']['new_valid'] for a in anchor_items),
        'total_weeks': len(weekly_totals),
    }

    return jsonify({
        'success': True,
        'data': {
            'anchors': sorted(all_anchors),
            'weekly_totals': weekly_totals,
            'anchor_items': top_anchors,
            'totals': totals,
            'top_n': top_n,
            'all_count': len(anchor_items),
        },
        'meta': {
            'version': 'p2-anchor-weekly-analysis',
            'source': 'fact_conv_content.客户来源 + dim_anchor_live_type',
            'group_by': '主播 × 周起始日',
            'funnel_stages': ['客户线索', '客户开口', '有效线索', '有效线索(剔除存量)', '成功开户(新)', '有效户(新)'],
            'rate_keys': ['线索_开口率', '开口_有效率', '有效_非存量率', '非存量_新开户率', '新开户_新有效率'],
            'note': '存量剔除口径：是否为存量客户==0 OR IS NULL。周起始日为该日期所在周的周一。',
        },
    })


