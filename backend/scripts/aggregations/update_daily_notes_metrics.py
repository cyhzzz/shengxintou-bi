"""
更新小红书笔记日级指标聚合表 v2.0

数据来源：
1. 维度字段：xhs_note_info (优先) + xhs_notes_content_daily (补充)
2. 广告投放指标：xhs_notes_daily（投放量）
3. 总业务指标：xhs_notes_content_daily（投放+自然流量）
4. 自然流量：计算得出（总量 - 投放量）
5. 转化指标：backend_conversions (按 note_id + lead_date 关联)

聚合粒度：date + note_id
更新策略：UPSERT (存在则更新，不存在则插入)

指标拆分规则：
- 总量（total_*）：来自 xhs_notes_content_daily（投放+自然流量总和）
- 投放量（ad_*）：来自 xhs_notes_daily（投放带来的数据）
- 自然量（organic_*）：计算得出（总量 - 投放量）

使用方式:
    # 更新最近30天的数据（默认）
    python backend/scripts/aggregations/update_daily_notes_metrics.py

    # 更新指定日期范围
    python backend/scripts/aggregations/update_daily_notes_metrics.py 2025-01-01 2025-01-15

    # 更新单日数据
    python backend/scripts/aggregations/update_daily_notes_metrics.py 2025-01-15 2025-01-15
"""

import sys
import os
from datetime import datetime, timedelta

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app import app
from backend.database import db
from backend.models import (
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    XhsNotesDaily,
    XhsNotesContentDaily,
    BackendConversions,
    AccountAgencyMapping
)
from sqlalchemy import func, and_, or_, distinct, case, literal


def update_daily_notes_metrics(start_date=None, end_date=None):
    """
    更新小红书笔记日级指标聚合表

    参数:
        start_date: 开始日期（YYYY-MM-DD 或 datetime.date），默认为最近30天
        end_date: 结束日期（YYYY-MM-DD 或 datetime.date），默认为今天
    """

    with app.app_context():
        # 默认日期范围：最近30天
        if not end_date:
            end_date = datetime.now().date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        if not start_date:
            start_date = end_date - timedelta(days=30)

        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()

        print(f"开始更新 daily_notes_metrics_unified v1.0: {start_date} 到 {end_date}")
        print(f"[INFO] 将聚合 {(end_date - start_date).days + 1} 天的数据")

        # ===== 步骤1: 聚合笔记映射数据（独立获取，不依赖投放数据）=====
        print("\n步骤1: 聚合笔记映射数据...")

        notes_mapping_data = _aggregate_notes_mapping_data()

        print(f"   找到 {len(notes_mapping_data)} 条笔记映射数据")

        # 创建映射字典
        mapping_dict = {d['note_id']: d for d in notes_mapping_data}

        # ===== 步骤2: 聚合笔记维度数据 + 广告投放指标 =====
        print("\n步骤2: 聚合笔记维度数据 + 广告投放指标...")

        notes_ad_data = _aggregate_notes_ad_data(start_date, end_date)

        print(f"   找到 {len(notes_ad_data)} 条笔记广告数据")

        # ===== 步骤3: 聚合运营指标 =====
        print("\n步骤3: 聚合运营指标...")

        notes_content_data = _aggregate_notes_content_data(start_date, end_date)

        print(f"   找到 {len(notes_content_data)} 条笔记运营数据")

        # ===== 步骤3.5: 获取所有内容数据的维度信息（用于填充缺失的维度字段）=====
        print("\n步骤3.5: 获取所有内容数据的维度信息...")

        # 不限制日期范围，获取所有内容数据用于维度填充
        all_content_data = _aggregate_notes_content_data_all()

        print(f"   找到 {len(all_content_data)} 条笔记内容数据（全量，用于维度填充）")

        # ===== 步骤4: 聚合转化指标 =====
        print("\n步骤4: 聚合转化指标...")

        notes_conversion_data = _aggregate_notes_conversion_data(start_date, end_date)

        print(f"   找到 {len(notes_conversion_data)} 条笔记转化数据")

        # ===== 步骤5: 合并所有数据并写入聚合表 =====
        print("\n步骤5: 合并数据并写入聚合表...")

        # 收集所有笔记ID（包括映射表中的 note_id，确保只有映射没有投放数据的笔记也能处理）
        all_note_ids = set()
        all_note_ids.update([d['note_id'] for d in notes_ad_data])
        all_note_ids.update([d['note_id'] for d in notes_content_data])
        all_note_ids.update([d['note_id'] for d in notes_mapping_data])  # 修复：添加映射数据的 note_id

        # 创建数据字典，便于快速查找
        ad_dict = {f"{d['date']}_{d['note_id']}": d for d in notes_ad_data}
        content_dict = {f"{d['date']}_{d['note_id']}": d for d in notes_content_data}
        conversion_dict = {f"{d['date']}_{d['note_id']}": d for d in notes_conversion_data}

        # 新增：为每个笔记创建最新维度数据字典（用于填充缺失的维度字段）
        # 当内容数据没有对应日期的记录时，使用该笔记最新的内容数据
        # 使用 all_content_data（全量数据）而不是 notes_content_data（日期范围过滤后的数据）
        latest_content_dict = {}
        for d in all_content_data:
            note_id = d['note_id']
            # 如果该笔记还没有记录，或者当前记录日期更新，则保存
            if note_id not in latest_content_dict or d['date'] > latest_content_dict[note_id]['date']:
                latest_content_dict[note_id] = d

        # 合并数据
        merged_count = 0
        for note_id in all_note_ids:
            # 遍历日期范围
            current_date = start_date
            while current_date <= end_date:
                key = f"{current_date}_{note_id}"

                # 获取各部分数据
                ad_data = ad_dict.get(key)
                content_data = content_dict.get(key)
                conversion_data = conversion_dict.get(key)
                mapping_data = mapping_dict.get(note_id)  # 映射数据（不依赖日期）

                # 新增：如果没有精确日期的内容数据，使用最新的内容数据填充维度
                content_for_dimensions = content_data
                if not content_data and note_id in latest_content_dict:
                    content_for_dimensions = latest_content_dict[note_id]

                # 至少有一个数据源才写入
                if ad_data or content_data or conversion_data:
                    _save_merged_metric(
                        current_date, note_id,
                        ad_data, content_data, conversion_data, mapping_data,
                        content_for_dimensions  # 新增：用于填充维度的内容数据
                    )
                    merged_count += 1

                current_date += timedelta(days=1)

        db.session.commit()

        print(f"   [OK] 数据合并完成，共写入/更新 {merged_count} 条记录")

        print(f"\n[SUCCESS] 完成！")


def _aggregate_notes_mapping_data():
    """
    聚合笔记映射数据（独立获取，不依赖日期和投放数据）

    数据来源：xhs_note_info

    返回: List of dict

    说明：
    - 获取所有笔记的维度信息（note_id, note_title, producer, ad_strategy, publish_time）
    - 用于填充聚合表中的维度字段，即使没有投放数据也能获取
    """
    query = db.session.query(
        XhsNoteInfo.note_id,
        XhsNoteInfo.note_title,
        XhsNoteInfo.note_url,
        XhsNoteInfo.publish_account,
        XhsNoteInfo.publish_time,
        XhsNoteInfo.producer,
        XhsNoteInfo.ad_strategy
    ).all()

    results = []
    for row in query:
        results.append({
            'note_id': row.note_id,
            'note_title': row.note_title,
            'note_url': row.note_url,
            'publish_account': row.publish_account,
            'publish_time': row.publish_time,
            'producer': row.producer,
            'ad_strategy': row.ad_strategy
        })

    # 调试输出：检查第一条数据是否包含 note_url
    if results:
        print(f"   [DEBUG] 第一条映射数据包含的键: {list(results[0].keys())}")
        print(f"   [DEBUG] note_url 是否存在: {'note_url' in results[0]}")
        if 'note_url' in results[0]:
            url = results[0]['note_url']
            if url:
                print(f"   [DEBUG] note_url 值（前80字符）: {url[:80] if len(url) > 80 else url}")
            else:
                print(f"   [DEBUG] note_url 为空")

    return results


def _aggregate_notes_ad_data(start_date, end_date):
    """
    聚合笔记广告投放数据（投放量）

    数据来源：
    - xhs_notes_daily (投放指标 + 账户ID)
    - xhs_note_info (笔记维度)
    - account_agency_mapping (代理商映射，v3.1 新增)

    返回: List of dict

    注意（v3.1 Final）：
    - 通过 sub_account_id 关联 account_agency_mapping 获取 agency
    - ad_strategy 从 xhs_note_info 获取
    - note_title, producer 从 xhs_note_info 获取
    - 支持 16 字段结构（新增 2 个账户ID字段，无 ad_plan_id）

    代理商映射逻辑：
    - 优先：sub_account_id (代理商子账户ID) → account_agency_mapping.account_id
    - 备用：advertiser_account_id (主账户ID) → account_agency_mapping.main_account_id
    """
    # 从 xhs_note_info 获取维度信息（不 JOIN account_agency_mapping，避免行翻倍）
    # 代理商信息在聚合后单独查询填充
    query = db.session.query(
        XhsNotesDaily.date,
        XhsNotesDaily.note_id,
        XhsNoteInfo.note_title.label('note_title'),
        XhsNoteInfo.note_url.label('note_url'),
        func.coalesce(XhsNoteInfo.publish_account, '申万宏源证券财富管理').label('publish_account'),
        XhsNoteInfo.publish_time.label('note_publish_time'),
        func.coalesce(XhsNoteInfo.producer, '申万宏源证券财富管理').label('producer'),
        func.coalesce(XhsNoteInfo.ad_strategy, '未知').label('ad_strategy'),

        # 账户ID字段（v3.1 新增）
        XhsNotesDaily.advertiser_account_id,
        XhsNotesDaily.sub_account_id,

        # 广告投放指标
        func.sum(XhsNotesDaily.cost).label('cost'),
        func.sum(XhsNotesDaily.impressions).label('impressions'),
        func.sum(XhsNotesDaily.clicks).label('clicks'),

        # 投放互动指标（投放带来的）
        func.sum(XhsNotesDaily.likes).label('likes'),
        func.sum(XhsNotesDaily.comments).label('comments'),
        func.sum(XhsNotesDaily.favorites).label('favorites'),
        func.sum(XhsNotesDaily.shares).label('shares'),
        func.sum(XhsNotesDaily.total_interactions).label('total_interactions'),

        # 投放私信指标（只保留进线数）
        func.sum(XhsNotesDaily.private_message_leads).label('private_messages')
    ).outerjoin(
        XhsNoteInfo,
        XhsNoteInfo.note_id == XhsNotesDaily.note_id
    ).filter(
        and_(
            XhsNotesDaily.date >= start_date,
            XhsNotesDaily.date <= end_date
        )
    ).group_by(
        XhsNotesDaily.date,
        XhsNotesDaily.note_id,
        XhsNoteInfo.note_title,
        XhsNoteInfo.publish_time,
        XhsNoteInfo.producer,
        XhsNoteInfo.ad_strategy,
        XhsNotesDaily.advertiser_account_id,
        XhsNotesDaily.sub_account_id
    ).all()

    # 预加载所有小红书账号代理商映射（批量查询，提高性能）
    all_mappings = db.session.query(AccountAgencyMapping).filter(
        AccountAgencyMapping.platform == '小红书'
    ).all()

    # 创建查找字典
    mapping_by_account_id = {m.account_id: m.agency for m in all_mappings if m.account_id}
    mapping_by_main_account_id = {m.main_account_id: m.agency for m in all_mappings if m.main_account_id}

    results = []
    for row in query:
        # 查询代理商信息（从预加载的字典中查找，避免 JOIN 导致的行翻倍问题）
        agency = None
        if row.sub_account_id and row.sub_account_id in mapping_by_account_id:
            # 优先：通过 sub_account_id 匹配
            agency = mapping_by_account_id[row.sub_account_id]

        if not agency and row.advertiser_account_id and row.advertiser_account_id in mapping_by_main_account_id:
            # 备用：通过 advertiser_account_id 匹配
            agency = mapping_by_main_account_id[row.advertiser_account_id]

        results.append({
            'date': row.date,
            'note_id': row.note_id,
            'note_title': row.note_title or '未知笔记',
            'note_url': row.note_url,
            'note_publish_time': row.note_publish_time,
            'publish_account': row.publish_account,
            'producer': row.producer,
            'ad_strategy': row.ad_strategy,
            # 代理商信息：从预加载字典获取
            'agency': agency,
            'delivery_mode': None,  # 暂无数据源
            'advertiser_account_id': row.advertiser_account_id,
            'sub_account_id': row.sub_account_id,
            # 广告指标
            'cost': float(row.cost or 0),
            'impressions': int(row.impressions or 0),
            'clicks': int(row.clicks or 0),
            # 投放互动指标
            'likes': int(row.likes or 0),
            'comments': int(row.comments or 0),
            'favorites': int(row.favorites or 0),
            'shares': int(row.shares or 0),
            'total_interactions': int(row.total_interactions or 0),
            # 投放私信指标（只保留进线数）
            'private_messages': int(row.private_messages or 0)
        })

    return results


def _aggregate_notes_content_data(start_date, end_date):
    """
    聚合笔记总业务数据（总量 = 投放 + 自然流量）

    数据来源：xhs_notes_content_daily

    返回: List of dict

    说明：
    - total_impressions: 总展现量（投放+自然）
    - total_reads: 总阅读量（投放+自然）
    - total_interactions: 总互动量（投放+自然）
    - 个体互动指标：当前无此数据，估算值供参考
    """
    query = db.session.query(
        XhsNotesContentDaily.data_date.label('date'),
        XhsNotesContentDaily.note_id,
        XhsNotesContentDaily.note_url,
        XhsNotesContentDaily.note_type,
        func.sum(XhsNotesContentDaily.total_impressions).label('total_impressions'),
        func.sum(XhsNotesContentDaily.total_reads).label('total_reads'),
        func.sum(XhsNotesContentDaily.total_interactions).label('total_interactions')
    ).filter(
        and_(
            XhsNotesContentDaily.data_date >= start_date,
            XhsNotesContentDaily.data_date <= end_date
        )
    ).group_by(
        XhsNotesContentDaily.data_date,
        XhsNotesContentDaily.note_id,
        XhsNotesContentDaily.note_url,
        XhsNotesContentDaily.note_type
    ).all()

    results = []
    for row in query:
        total_interactions = int(row.total_interactions or 0)

        # 个体互动指标估算（从 total_interactions 分配）
        # 注意：这些是估算值，实际数据来自投放数据+自然流量拆分
        likes = int(total_interactions * 0.5)
        comments = int(total_interactions * 0.2)
        favorites = int(total_interactions * 0.2)
        shares = int(total_interactions * 0.1)

        results.append({
            'date': row.date,
            'note_id': row.note_id,
            'note_url': row.note_url,
            'note_type': row.note_type,
            # 总量指标
            'total_impressions': int(row.total_impressions or 0),
            'total_reads': int(row.total_reads or 0),
            'total_interactions': total_interactions,
            # 个体互动指标（估算）
            'likes': likes,
            'comments': comments,
            'favorites': favorites,
            'shares': shares
        })

    return results


def _aggregate_notes_content_data_all():
    """
    聚合所有笔记内容数据的维度信息（不限制日期范围）

    数据来源：xhs_notes_content_daily（全部数据，用于维度填充）

    返回: List of dict

    说明：
    - 获取所有内容数据，不限制日期范围
    - 用于填充维度字段（note_type 等）
    - 当某日期没有内容数据时，使用该笔记最新的内容数据填充
    """
    query = db.session.query(
        XhsNotesContentDaily.data_date.label('date'),
        XhsNotesContentDaily.note_id,
        XhsNotesContentDaily.note_url,
        XhsNotesContentDaily.note_type
    ).all()

    results = []
    for row in query:
        results.append({
            'date': row.date,
            'note_id': row.note_id,
            'note_url': row.note_url,
            'note_type': row.note_type
        })

    return results


def _aggregate_notes_conversion_data(start_date, end_date):
    """
    聚合转化指标

    数据来源：backend_conversions (按 note_id + lead_date 关联)

    返回: List of dict
    """
    # 构建用户标识去重表达式
    user_identifier = func.concat(
        BackendConversions.platform_source, '|',
        func.coalesce(BackendConversions.wechat_nickname, ''), '|',
        func.coalesce(BackendConversions.capital_account, ''), '|',
        func.coalesce(BackendConversions.platform_user_id, '')
    )

    query = db.session.query(
        BackendConversions.lead_date.label('date'),
        BackendConversions.note_id,
        func.count(func.distinct(user_identifier)).label('lead_users'),
        func.count(
            func.distinct(
                case(
                    (BackendConversions.is_customer_mouth == True, user_identifier),
                    else_=None
                )
            )
        ).label('customer_mouth_users'),
        func.count(
            func.distinct(
                case(
                    (BackendConversions.is_valid_lead == True, user_identifier),
                    else_=None
                )
            )
        ).label('valid_lead_users'),
        func.count(
            func.distinct(
                case(
                    (BackendConversions.is_opened_account == True, user_identifier),
                    else_=None
                )
            )
        ).label('opened_account_users'),
        func.count(
            func.distinct(
                case(
                    (BackendConversions.is_valid_customer == True, user_identifier),
                    else_=None
                )
            )
        ).label('valid_customer_users'),
        func.count(
            func.distinct(
                case(
                    (BackendConversions.assets > 0, user_identifier),
                    else_=None
                )
            )
        ).label('customer_assets_users'),
        func.sum(BackendConversions.assets).label('customer_assets_amount')
    ).filter(
        and_(
            BackendConversions.note_id.isnot(None),
            BackendConversions.note_id != '',
            BackendConversions.lead_date >= start_date,
            BackendConversions.lead_date <= end_date
        )
    ).group_by(
        BackendConversions.lead_date,
        BackendConversions.note_id
    ).all()

    results = []
    for row in query:
        results.append({
            'date': row.date,
            'note_id': row.note_id,
            'lead_users': int(row.lead_users) if row.lead_users else 0,
            'customer_mouth_users': int(row.customer_mouth_users) if row.customer_mouth_users else 0,
            'valid_lead_users': int(row.valid_lead_users) if row.valid_lead_users else 0,
            'opened_account_users': int(row.opened_account_users) if row.opened_account_users else 0,
            'valid_customer_users': int(row.valid_customer_users) if row.valid_customer_users else 0,
            'customer_assets_users': int(row.customer_assets_users) if row.customer_assets_users else 0,
            'customer_assets_amount': float(row.customer_assets_amount) if row.customer_assets_amount else 0
        })

    return results


def _save_merged_metric(date, note_id, ad_data, content_data, conversion_data, mapping_data=None, content_for_dimensions=None):
    """
    合并数据并写入聚合表（v3.0 - 基础属性统一从 mapping 表获取）

    指标拆分规则：
    - 总量（total_*）：来自 content_data（投放+自然流量总和）
    - 投放量（ad_*）：来自 ad_data（投放带来的数据）
    - 自然量（organic_*）：计算得出（总量 - 投放量）

    优先级规则（v3.0 更新）：
    1. **基础属性字段**（note_title, note_url, publish_account, publish_time, producer, ad_strategy）：
       - **统一从 mapping_data 获取**（xhs_note_info 作为基础属性主表）
    2. 其他维度字段（note_type 等）：从 content_data 获取
    3. 广告投放指标：从 ad_data 获取
    4. 总业务指标：从 content_data 获取
    5. 自然流量：计算得出
    6. 转化指标：从 conversion_data 获取

    参数说明：
        mapping_data: 笔记映射数据（基础属性主表，优先级最高）
        content_for_dimensions: 用于填充维度的内容数据（备用）
        ad_data: 广告投放数据
        content_data: 内容运营数据
        conversion_data: 转化数据
    """
    # 查找或创建记录
    metric = DailyNotesMetricsUnified.query.filter_by(
        date=date,
        note_id=note_id
    ).first()

    if not metric:
        metric = DailyNotesMetricsUnified(
            date=date,
            note_id=note_id
        )

    # ===== 基础属性字段（v3.1：mapping 表优先，NULL 值使用备用数据源）=====
    # xhs_note_info 是基础属性主表，但如果字段为 NULL，则尝试从备用数据源获取
    # 备用数据源优先级：ad_data > content_for_dimensions > content_data

    # 如果 mapping 表中没有数据，使用备用数据源
    if not mapping_data:
        dimension_source = content_for_dimensions or content_data

        metric.note_title = (ad_data or {}).get('note_title') or (dimension_source or {}).get('note_title') or '未知笔记'
        metric.note_url = (dimension_source or {}).get('note_url') if dimension_source else None
        metric.note_publish_time = (ad_data or {}).get('note_publish_time') or (dimension_source or {}).get('note_publish_time')

        # 修复：publish_account 应该使用默认值，而不是 None
        metric.publish_account = (ad_data or {}).get('publish_account') or '申万宏源证券财富管理'

        # 修复：producer 和 ad_strategy 也应该使用默认值
        metric.producer = (ad_data or {}).get('producer') or '申万宏源证券财富管理'
        metric.ad_strategy = (ad_data or {}).get('ad_strategy') or '未知'
    else:
        # mapping_data 存在，但字段可能为 NULL，使用备用数据源填充 NULL 值
        dimension_source = content_for_dimensions or content_data

        metric.note_title = mapping_data.get('note_title') or '未知笔记'
        metric.note_url = mapping_data.get('note_url') or (dimension_source or {}).get('note_url') if dimension_source else None

        # 修复：publish_time 为 None 时，尝试从备用数据源获取
        publish_time = mapping_data.get('publish_time')
        if not publish_time:
            publish_time = (ad_data or {}).get('note_publish_time') or (dimension_source or {}).get('note_publish_time')
        metric.note_publish_time = publish_time

        # 修复：正确处理 publish_account，优先使用 mapping 数据，如果为空则使用默认值
        publish_account = mapping_data.get('publish_account')
        if not publish_account or publish_account.strip() == '':
            publish_account = ((ad_data or {}).get('publish_account') if ad_data else None)
        if not publish_account or publish_account.strip() == '':
            publish_account = '申万宏源证券财富管理'
        metric.publish_account = publish_account

        metric.producer = mapping_data.get('producer') or ((ad_data or {}).get('producer') if ad_data else None)
        metric.ad_strategy = mapping_data.get('ad_strategy') or ((ad_data or {}).get('ad_strategy') if ad_data else None)

    # ===== 其他维度字段（从 content_data 获取）=====
    metric.note_type = (content_data or {}).get('note_type')

    # ===== 广告相关维度（从 ad_data 获取）=====
    if ad_data:
        metric.agency = ad_data.get('agency')
        metric.delivery_mode = ad_data.get('delivery_mode')

    # ===== 广告投放指标（只有投放量）=====
    metric.cost = (ad_data or {}).get('cost', 0)

    # ===== 展现量拆分（total / ad / organic）=====
    total_impressions = (content_data or {}).get('total_impressions', 0)
    ad_impressions = (ad_data or {}).get('impressions', 0)

    # 修复：total_impressions 至少等于 ad_impressions（防止 content_data 缺失导致 total=0 但 ad>0）
    total_impressions = max(total_impressions, ad_impressions)

    organic_impressions = max(0, total_impressions - ad_impressions)

    metric.total_impressions = total_impressions
    metric.ad_impressions = ad_impressions
    metric.organic_impressions = organic_impressions

    # ===== 点击量拆分（total / ad / organic）=====
    # 注意：content_daily 没有 total_clicks，使用 ad_clicks + 估算 organic
    ad_clicks = (ad_data or {}).get('clicks', 0)
    # 估算：假设自然点击率与投放点击率相同
    ad_click_rate = ad_clicks / ad_impressions if ad_impressions > 0 else 0
    organic_clicks = int(organic_impressions * ad_click_rate) if organic_impressions > 0 else 0
    total_clicks = ad_clicks + organic_clicks

    metric.total_clicks = total_clicks
    metric.ad_clicks = ad_clicks
    metric.organic_clicks = organic_clicks

    # ===== 互动指标拆分：点赞（total / ad / organic）=====
    total_likes = (content_data or {}).get('likes', 0)  # 估算值
    ad_likes = (ad_data or {}).get('likes', 0)
    organic_likes = max(0, total_likes - ad_likes)

    metric.total_likes = total_likes
    metric.ad_likes = ad_likes
    metric.organic_likes = organic_likes

    # ===== 互动指标拆分：评论（total / ad / organic）=====
    total_comments = (content_data or {}).get('comments', 0)  # 估算值
    ad_comments = (ad_data or {}).get('comments', 0)
    organic_comments = max(0, total_comments - ad_comments)

    metric.total_comments = total_comments
    metric.ad_comments = ad_comments
    metric.organic_comments = organic_comments

    # ===== 互动指标拆分：收藏（total / ad / organic）=====
    total_favorites = (content_data or {}).get('favorites', 0)  # 估算值
    ad_favorites = (ad_data or {}).get('favorites', 0)
    organic_favorites = max(0, total_favorites - ad_favorites)

    metric.total_favorites = total_favorites
    metric.ad_favorites = ad_favorites
    metric.organic_favorites = organic_favorites

    # ===== 互动指标拆分：分享（total / ad / organic）=====
    total_shares = (content_data or {}).get('shares', 0)  # 估算值
    ad_shares = (ad_data or {}).get('shares', 0)
    organic_shares = max(0, total_shares - ad_shares)

    metric.total_shares = total_shares
    metric.ad_shares = ad_shares
    metric.organic_shares = organic_shares

    # ===== 总互动量拆分（total / ad / organic）=====
    total_interactions = (content_data or {}).get('total_interactions', 0)
    ad_interactions = (ad_data or {}).get('total_interactions', 0)

    # 修复：total_interactions 至少等于 ad_interactions（防止 content_data 缺失导致 total=0 但 ad>0）
    total_interactions = max(total_interactions, ad_interactions)

    organic_interactions = max(0, total_interactions - ad_interactions)

    metric.total_interactions = total_interactions
    metric.ad_interactions = ad_interactions
    metric.organic_interactions = organic_interactions

    # ===== 私信指标拆分（total / ad / organic）=====
    # 注意：content_daily 没有私信数据，只有投放私信数据
    ad_private_messages = (ad_data or {}).get('private_messages', 0)
    # 假设自然流量私信为0（因为没有数据源）
    total_private_messages = ad_private_messages
    organic_private_messages = 0

    metric.total_private_messages = total_private_messages
    metric.ad_private_messages = ad_private_messages
    metric.organic_private_messages = organic_private_messages

    # ===== 转化指标（来自 conversion_data）=====
    if conversion_data:
        metric.lead_users = conversion_data.get('lead_users', 0)
        metric.customer_mouth_users = conversion_data.get('customer_mouth_users', 0)
        metric.valid_lead_users = conversion_data.get('valid_lead_users', 0)
        metric.opened_account_users = conversion_data.get('opened_account_users', 0)
        metric.valid_customer_users = conversion_data.get('valid_customer_users', 0)
        metric.customer_assets_users = conversion_data.get('customer_assets_users', 0)
        metric.customer_assets_amount = conversion_data.get('customer_assets_amount', 0)
    else:
        metric.lead_users = 0
        metric.customer_mouth_users = 0
        metric.valid_lead_users = 0
        metric.opened_account_users = 0
        metric.valid_customer_users = 0
        metric.customer_assets_users = 0
        metric.customer_assets_amount = 0

    db.session.add(metric)


if __name__ == '__main__':
    # 解析命令行参数
    start_date = sys.argv[1] if len(sys.argv) > 1 else None
    end_date = sys.argv[2] if len(sys.argv) > 2 else None

    # 执行更新
    update_daily_notes_metrics(start_date, end_date)
