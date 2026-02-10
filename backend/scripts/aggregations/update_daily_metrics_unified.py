"""
更新 daily_metrics_unified 聚合表 v3.0

变更说明：
1. 简化表结构，只保留必要的指标字段
2. 支持代理商关联失败的情况（agency可以为空）
3. 支持业务模式推断失败的情况（business_model可以为空）
4. 新增 potential_customers 字段（潜客人数）
5. 明确数据来源和关联逻辑

使用方式:
    # 更新最近30天的数据
    python backend/scripts/aggregations/update_daily_metrics_unified.py

    # 更新指定日期范围
    python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-01-01 2025-01-15
"""

import sys
import os
from datetime import datetime, timedelta

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app import app
from backend.database import db
from backend.models import (
    DailyMetricsUnified,
    RawAdDataTencent,
    RawAdDataDouyin,
    RawAdDataXiaohongshu,
    BackendConversions,
    AccountAgencyMapping,
    AgencyAbbreviationMapping
)
from sqlalchemy import func, and_, or_, distinct, case, text


# 业务模式映射规则（代理商 → 业务模式）
BUSINESS_MODEL_MAPPING = {
    '信息流': ['绩牛', '美洋', '量子', '风声'],
    '直播': ['信则', '优品', '高德']
}


def get_business_model_for_agency(agency):
    """
    根据代理商名称获取业务模式

    Args:
        agency: 代理商名称

    Returns:
        业务模式（'信息流' 或 '直播'），如果未找到返回 None
    """
    if not agency:
        return None

    for business_model, agencies in BUSINESS_MODEL_MAPPING.items():
        if agency in agencies:
            return business_model

    return None


def apply_business_model_mapping(agency, business_model, platform=None):
    """
    应用业务模式映射规则

    优先级：
    1. 如果已有业务模式且不为空，保持不变
    2. 腾讯申万宏源直投，未归因业务模式的，默认为直播
    3. 小红书平台，未归因业务模式的，默认为信息流（转化链路特殊）
    4. 腾讯众联，未归因业务模式的，默认为信息流
    5. 否则根据代理商名称映射
    6. 如果代理商也不在映射表中，返回空字符串

    Args:
        agency: 代理商名称
        business_model: 当前业务模式
        platform: 平台（腾讯/抖音/小红书）

    Returns:
        业务模式
    """
    # 如果已有业务模式，保持不变
    if business_model:
        return business_model

    # 特殊规则：腾讯申万宏源直投，默认为直播模式
    if platform == '腾讯' and agency == '申万宏源直投':
        return '直播'

    # 特殊规则：小红书平台，默认为信息流（转化链路特殊）
    if platform == '小红书':
        return '信息流'

    # 特殊规则：腾讯众联，默认为信息流
    if platform == '腾讯' and agency == '众联':
        return '信息流'

    # 根据代理商名称映射
    mapped_model = get_business_model_for_agency(agency)
    if mapped_model:
        return mapped_model

    # 无法映射，返回空字符串
    return ''


def build_abbreviation_mapping_case():
    """
    构建简称映射的 CASE 表达式

    从 AgencyAbbreviationMapping 表中读取所有启用的映射关系，
    构建动态的 CASE 表达式用于 SQL 查询

    Returns:
        SQLAlchemy case 表达式
    """
    # 查询所有启用的代理商简称映射
    mappings = db.session.query(
        AgencyAbbreviationMapping.abbreviation,
        AgencyAbbreviationMapping.full_name
    ).filter(
        AgencyAbbreviationMapping.mapping_type == 'agency',
        AgencyAbbreviationMapping.is_active == True
    ).all()

    # 构建 CASE 表达式的 when 条件列表
    when_clauses = [
        (BackendConversions.agency == abbr, full_name)
        for abbr, full_name in mappings
    ]

    # 构建 case 表达式
    # 如果有映射，使用 CASE WHEN；否则返回原值
    if when_clauses:
        return case(*when_clauses, else_=BackendConversions.agency)
    else:
        # 如果没有任何映射，返回原值
        return BackendConversions.agency


def update_daily_metrics(start_date=None, end_date=None):
    """
    更新日级指标聚合表 v3.0

    参数:
        start_date: 开始日期（YYYY-MM-DD 或 datetime.date），默认为所有数据的最早日期
        end_date: 结束日期（YYYY-MM-DD 或 datetime.date），默认为今天
    """

    with app.app_context():
        # 默认日期范围：全量数据（从最早的数据到今天）
        if not end_date:
            end_date = datetime.now().date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        if not start_date:
            # 查询所有数据表中的最早日期
            earliest_dates = []

            # 查询腾讯广告数据最早日期
            try:
                tencent_min = db.session.query(func.min(RawAdDataTencent.date)).scalar()
                if tencent_min:
                    earliest_dates.append(tencent_min)
            except:
                pass

            # 查询抖音广告数据最早日期
            try:
                douyin_min = db.session.query(func.min(RawAdDataDouyin.date)).scalar()
                if douyin_min:
                    earliest_dates.append(douyin_min)
            except:
                pass

            # 查询小红书广告数据最早日期
            try:
                xiaohongshu_min = db.session.query(func.min(RawAdDataXiaohongshu.date)).scalar()
                if xiaohongshu_min:
                    earliest_dates.append(xiaohongshu_min)
            except:
                pass

            # 查询转化数据最早日期
            try:
                conversion_min = db.session.query(func.min(BackendConversions.lead_date)).scalar()
                if conversion_min:
                    earliest_dates.append(conversion_min)
            except:
                pass

            # 取最早的日期
            if earliest_dates:
                start_date = min(earliest_dates)
                print(f"[INFO] 自动检测到数据最早日期: {start_date}")
            else:
                # 如果没有数据，使用默认值（今天）
                start_date = end_date
                print("[WARN] 未找到任何数据，将使用今天作为开始日期")

        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()

        print(f"开始更新 daily_metrics_unified v3.0: {start_date} 到 {end_date}")
        print(f"[INFO] 将聚合 {(end_date - start_date).days + 1} 天的数据")

        # ===== 1. 聚合广告数据 =====
        print("\n1. 聚合广告数据...")

        # 1.1 腾讯广告数据
        print("   1.1 聚合腾讯广告数据...")
        tencent_ads = db.session.query(
            RawAdDataTencent.date,
            func.coalesce(AccountAgencyMapping.agency, '').label('agency'),
            func.coalesce(AccountAgencyMapping.business_model, '').label('business_model'),
            func.sum(RawAdDataTencent.cost).label('cost'),
            func.sum(RawAdDataTencent.impressions).label('impressions'),
            func.sum(RawAdDataTencent.click_users).label('click_users')
        ).outerjoin(
            AccountAgencyMapping,
            and_(
                AccountAgencyMapping.account_id == RawAdDataTencent.account_id,
                AccountAgencyMapping.platform == '腾讯'
            )
        ).filter(
            and_(
                RawAdDataTencent.date >= start_date,
                RawAdDataTencent.date <= end_date
            )
        ).group_by(
            RawAdDataTencent.date,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.business_model
        ).all()

        print(f"      找到 {len(tencent_ads)} 条腾讯广告数据")

        # 保存腾讯广告数据
        for ad in tencent_ads:
            _save_ad_metric(ad, '腾讯')

        # 1.2 抖音广告数据
        # 注意：抖音没有 click_users 字段，使用 clicks 作为替代
        print("   1.2 聚合抖音广告数据...")
        douyin_ads = db.session.query(
            RawAdDataDouyin.date,
            func.coalesce(AccountAgencyMapping.agency, '').label('agency'),
            func.coalesce(AccountAgencyMapping.business_model, '').label('business_model'),
            func.sum(RawAdDataDouyin.cost).label('cost'),
            func.sum(RawAdDataDouyin.impressions).label('impressions'),
            func.sum(RawAdDataDouyin.clicks).label('click_users')
        ).outerjoin(
            AccountAgencyMapping,
            and_(
                AccountAgencyMapping.account_id == RawAdDataDouyin.account_id,
                AccountAgencyMapping.platform == '抖音'
            )
        ).filter(
            and_(
                RawAdDataDouyin.date >= start_date,
                RawAdDataDouyin.date <= end_date
            )
        ).group_by(
            RawAdDataDouyin.date,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.business_model
        ).all()

        print(f"      找到 {len(douyin_ads)} 条抖音广告数据")

        # 保存抖音广告数据
        for ad in douyin_ads:
            _save_ad_metric(ad, '抖音')

        # 1.3 小红书广告数据
        # 注意：小红书使用 advertiser_account_id（主账户）和 sub_account_id（子账户）
        # 小红书没有 click_users 字段，使用 clicks（总点击）作为替代
        print("   1.3 聚合小红书广告数据...")

        # 使用 CASE 表达式选择 account_id（优先使用子账户ID，用于JOIN映射表）
        account_id_case = case(
            (RawAdDataXiaohongshu.sub_account_id != None, RawAdDataXiaohongshu.sub_account_id),
            else_=RawAdDataXiaohongshu.advertiser_account_id
        )

        xhs_ads = db.session.query(
            RawAdDataXiaohongshu.date,
            func.coalesce(AccountAgencyMapping.agency, '').label('agency'),
            func.coalesce(AccountAgencyMapping.business_model, '').label('business_model'),
            func.sum(RawAdDataXiaohongshu.cost).label('cost'),
            func.sum(RawAdDataXiaohongshu.impressions).label('impressions'),
            func.sum(RawAdDataXiaohongshu.clicks).label('click_users')
        ).outerjoin(
            AccountAgencyMapping,
            and_(
                AccountAgencyMapping.platform == '小红书',
                # 优先匹配子账户（代理商投放）
                or_(
                    and_(
                        AccountAgencyMapping.account_id == account_id_case,
                        AccountAgencyMapping.account_id != None
                    ),
                    # 如果子账户不匹配，才匹配主账户（直投）
                    and_(
                        AccountAgencyMapping.main_account_id == RawAdDataXiaohongshu.advertiser_account_id,
                        AccountAgencyMapping.account_id == None,
                        # 关键修复：确保只在sub_account_id为NULL时才匹配直投映射
                        RawAdDataXiaohongshu.sub_account_id == None
                    )
                )
            )
        ).filter(
            and_(
                RawAdDataXiaohongshu.date >= start_date,
                RawAdDataXiaohongshu.date <= end_date
            )
        ).group_by(
            RawAdDataXiaohongshu.date,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.business_model
        ).all()

        print(f"      找到 {len(xhs_ads)} 条小红书广告数据")

        # 保存小红书广告数据
        for ad in xhs_ads:
            _save_ad_metric(ad, '小红书')

        db.session.commit()
        print("   [OK] 广告数据聚合完成")

        # ===== 2. 聚合转化数据 =====
        print("\n2. 聚合转化数据...")

        # 2.1 首先需要为 backend_conversions 关联代理商和业务模式
        print("   2.1 计算转化数据的代理商和业务模式...")

        conversion_data = _calculate_conversion_aggregation(start_date, end_date)

        print(f"      找到 {len(conversion_data)} 条转化聚合数据")

        # 保存转化数据
        for conv in conversion_data:
            _save_conversion_metric(conv)

        db.session.commit()
        print("   [OK] 转化数据聚合完成")

        # ===== 3. 聚合点击人数 =====
        # 注意：点击人数现在直接从广告数据获取，不再从后端转化数据计算
        # 之前从后端转化数据计算的方式只能统计有转化的点击，且逻辑有缺陷
        # 现在修改为：
        # - 腾讯：使用广告数据的 click_users 字段
        # - 抖音/小红书：使用广告数据的 clicks 字段作为替代
        # - 无广告数据的记录：click_users = 0
        print("\n3. 点击人数已从广告数据聚合，跳过后端转化数据计算步骤")

        # _calculate_click_users(start_date, end_date)  # 旧逻辑，已废弃

        db.session.commit()
        print("   [OK] 所有数据聚合完成")

        print(f"\n[SUCCESS] 完成！")


def _save_ad_metric(ad_data, platform):
    """保存广告数据到聚合表

    注意：不使用 account_id 维度，只按 date + platform + agency + business_model 聚合
    这样可以确保广告数据和转化数据能够正确合并
    """
    # 应用业务模式映射规则
    agency = ad_data.agency or ''
    business_model = apply_business_model_mapping(agency, ad_data.business_model or '', platform)

    # 查找或创建记录（不包含 account_id）
    metric = DailyMetricsUnified.query.filter_by(
        date=ad_data.date,
        platform=platform,
        agency=agency,
        business_model=business_model
    ).first()

    if not metric:
        metric = DailyMetricsUnified(
            date=ad_data.date,
            platform=platform,
            account_id='',  # 不再细分到账号
            account_name='',
            agency=agency,
            business_model=business_model
        )

    # 更新广告指标
    metric.cost = float(ad_data.cost or 0)
    metric.impressions = int(ad_data.impressions or 0)

    # 更新点击人数（从广告数据获取）
    if hasattr(ad_data, 'click_users'):
        metric.click_users = int(ad_data.click_users or 0)

    db.session.add(metric)


def _calculate_conversion_aggregation(start_date, end_date):
    """
    计算转化数据的代理商和业务模式聚合

    返回: List of dict，每个元素包含：
        - date, platform, agency, business_model
        - lead_users, potential_customers, customer_mouth_users,
          valid_lead_users, opened_account_users, valid_customer_users

    重要说明：
        - backend_conversions 表本身已天然去重（外部导入时已去重）
        - 直接使用 id 字段计数，不再使用 user_identifier 去重
        - wechat_nickname 相同不代表同一个人，不应作为去重依据
    """
    # 从 AgencyAbbreviationMapping 表动态构建简称映射（仅用于抖音）
    agency_name_mapping = build_abbreviation_mapping_case()

    # 业务模式推断逻辑
    # customer_source 包含"引流" → 直播
    # customer_source 有值但不包含"引流" → 信息流
    # 其他 → 空字符串
    business_model_mapping = case(
        (BackendConversions.customer_source.like('%引流%'), '直播'),
        (and_(
            BackendConversions.customer_source.isnot(None),
            BackendConversions.customer_source != ''
        ), '信息流'),
        else_=''
    )

    # ===== 1. 查询腾讯转化数据（需要通过广告账号表关联） =====
    print("   2.1 计算腾讯转化数据（通过广告账号关联）...")
    tencent_conversions = db.session.query(
        BackendConversions.lead_date.label('date'),
        func.coalesce(AccountAgencyMapping.agency, '').label('agency'),
        func.coalesce(business_model_mapping, '').label('business_model'),
        # 直接使用 id 计数（每条记录代表一个独立的线索）
        func.count(BackendConversions.id).label('lead_users'),
        # 带条件的计数（使用 CASE WHEN + id）
        func.count(
            case(
                (BackendConversions.is_existing_customer == False, BackendConversions.id),
                else_=None
            )
        ).label('potential_customers'),
        func.count(
            case(
                (BackendConversions.is_customer_mouth == True, BackendConversions.id),
                else_=None
            )
        ).label('customer_mouth_users'),
        func.count(
            case(
                (BackendConversions.is_valid_lead == True, BackendConversions.id),
                else_=None
            )
        ).label('valid_lead_users'),
        func.count(
            case(
                (BackendConversions.is_opened_account == True, BackendConversions.id),
                else_=None
            )
        ).label('opened_account_users'),
        func.count(
            case(
                (BackendConversions.is_valid_customer == True, BackendConversions.id),
                else_=None
            )
        ).label('valid_customer_users')
    ).outerjoin(
        RawAdDataTencent,
        and_(
            RawAdDataTencent.account_id == BackendConversions.ad_account,
            RawAdDataTencent.date == BackendConversions.lead_date
        )
    ).outerjoin(
        AccountAgencyMapping,
        and_(
            AccountAgencyMapping.platform == '腾讯',
            AccountAgencyMapping.account_id == RawAdDataTencent.account_id
        )
    ).filter(
        and_(
            BackendConversions.platform_source == '腾讯',
            BackendConversions.lead_date >= start_date,
            BackendConversions.lead_date <= end_date
        )
    ).group_by(
        BackendConversions.lead_date,
        AccountAgencyMapping.agency,
        business_model_mapping
    ).all()

    print(f"      找到 {len(tencent_conversions)} 条腾讯转化聚合记录")

    # ===== 2. 查询抖音和小红书转化数据（使用简称映射或直接JOIN） =====
    print("   2.2 计算抖音和小红书转化数据...")

    # 代理商映射CASE表达式（抖音、小红书、yj、高德）
    # 抖音：使用简称映射
    # 小红书：优先从 JOIN 获取，如果为空则使用简称映射（备用）
    # yj（云极）：独立平台，代理商为空
    # 高德：独立平台，代理商为空
    agency_mapping = case(
        (BackendConversions.platform_source == '抖音', agency_name_mapping),
        (BackendConversions.platform_source == '小红书', func.coalesce(AccountAgencyMapping.agency, agency_name_mapping)),
        (BackendConversions.platform_source == 'yj', ''),
        (BackendConversions.platform_source == '高德', ''),
        else_=''
    )

    other_conversions = db.session.query(
        BackendConversions.lead_date.label('date'),
        BackendConversions.platform_source.label('platform'),
        func.coalesce(agency_mapping, '').label('agency'),
        func.coalesce(business_model_mapping, '').label('business_model'),
        # 直接使用 id 计数（每条记录代表一个独立的线索）
        func.count(BackendConversions.id).label('lead_users'),
        # 带条件的计数（使用 CASE WHEN + id）
        func.count(
            case(
                (BackendConversions.is_existing_customer == False, BackendConversions.id),
                else_=None
            )
        ).label('potential_customers'),
        func.count(
            case(
                (BackendConversions.is_customer_mouth == True, BackendConversions.id),
                else_=None
            )
        ).label('customer_mouth_users'),
        func.count(
            case(
                (BackendConversions.is_valid_lead == True, BackendConversions.id),
                else_=None
            )
        ).label('valid_lead_users'),
        func.count(
            case(
                (BackendConversions.is_opened_account == True, BackendConversions.id),
                else_=None
            )
        ).label('opened_account_users'),
        func.count(
            case(
                (BackendConversions.is_valid_customer == True, BackendConversions.id),
                else_=None
            )
        ).label('valid_customer_users')
    ).outerjoin(
        AccountAgencyMapping,
        and_(
            AccountAgencyMapping.platform == BackendConversions.platform_source,
            # 小红书：通过 ad_account 关联 account_name
            # 抖音：不使用 JOIN（通过 agency 字段映射）
            or_(
                and_(
                    BackendConversions.platform_source == '小红书',
                    AccountAgencyMapping.account_name == BackendConversions.ad_account
                ),
                and_(
                    BackendConversions.platform_source == '抖音',
                    # 抖音不关联，agency_mapping CASE 会处理
                    text('1=0')
                )
            )
        )
    ).filter(
        and_(
            BackendConversions.platform_source.in_(['抖音', '小红书', 'yj', '高德']),
            BackendConversions.lead_date >= start_date,
            BackendConversions.lead_date <= end_date
        )
    ).group_by(
        BackendConversions.lead_date,
        BackendConversions.platform_source,
        agency_mapping,
        business_model_mapping
    ).all()

    print(f"      找到 {len(other_conversions)} 条抖音/小红书转化聚合记录")

    # ===== 3. 合并结果 =====
    results = []

    # 处理腾讯数据
    print(f"      处理腾讯转化数据: {len(tencent_conversions)} 条")
    for row in tencent_conversions:
        results.append({
            'date': row.date,
            'platform': '腾讯',
            'agency': row.agency or '',
            'business_model': row.business_model or '',
            'lead_users': int(row.lead_users) if row.lead_users else 0,
            'potential_customers': int(row.potential_customers) if row.potential_customers else 0,
            'customer_mouth_users': int(row.customer_mouth_users) if row.customer_mouth_users else 0,
            'valid_lead_users': int(row.valid_lead_users) if row.valid_lead_users else 0,
            'opened_account_users': int(row.opened_account_users) if row.opened_account_users else 0,
            'valid_customer_users': int(row.valid_customer_users) if row.valid_customer_users else 0
        })

    # 处理抖音、小红书、yj、高德数据
    print(f"      处理其他平台转化数据: {len(other_conversions)} 条")
    platform_sample_count = {}
    for row in other_conversions:
        # 平台映射：yj→云极，高德→高德（作为独立平台）
        platform_mapping = {
            '抖音': '抖音',
            '小红书': '小红书',
            'yj': '云极',
            '高德': '高德'
        }
        platform = platform_mapping.get(row.platform, row.platform)

        # 统计各平台记录数（用于调试）
        platform_sample_count[row.platform] = platform_sample_count.get(row.platform, 0) + 1

        results.append({
            'date': row.date,
            'platform': platform,
            'agency': row.agency or '',
            'business_model': row.business_model or '',
            'lead_users': int(row.lead_users) if row.lead_users else 0,
            'potential_customers': int(row.potential_customers) if row.potential_customers else 0,
            'customer_mouth_users': int(row.customer_mouth_users) if row.customer_mouth_users else 0,
            'valid_lead_users': int(row.valid_lead_users) if row.valid_lead_users else 0,
            'opened_account_users': int(row.opened_account_users) if row.opened_account_users else 0,
            'valid_customer_users': int(row.valid_customer_users) if row.valid_customer_users else 0
        })

    print(f"      其他平台源数据分布: {platform_sample_count}")

    print(f"      转化数据聚合完成，共 {len(results)} 条记录")

    return results


def _save_conversion_metric(conv_data):
    """保存转化数据到聚合表"""
    # 应用业务模式映射规则
    agency = conv_data['agency']
    platform = conv_data['platform']
    business_model = apply_business_model_mapping(agency, conv_data['business_model'], platform)

    # 查找或创建记录（可能已由广告数据创建）
    metric = DailyMetricsUnified.query.filter_by(
        date=conv_data['date'],
        platform=conv_data['platform'],
        agency=agency,
        business_model=business_model
    ).first()

    if not metric:
        # 如果没有找到，创建新记录（纯转化数据，无广告数据）
        metric = DailyMetricsUnified(
            date=conv_data['date'],
            platform=conv_data['platform'],
            agency=agency,
            business_model=business_model,
            account_id='',
            account_name='',
            cost=0,
            impressions=0,
            click_users=0  # 无广告数据时，点击人数为0
        )

    # 更新转化指标
    metric.lead_users = conv_data['lead_users']
    metric.potential_customers = conv_data['potential_customers']
    metric.customer_mouth_users = conv_data['customer_mouth_users']
    metric.valid_lead_users = conv_data['valid_lead_users']
    metric.opened_account_users = conv_data['opened_account_users']
    metric.valid_customer_users = conv_data['valid_customer_users']

    db.session.add(metric)


def _calculate_click_users(start_date, end_date):
    """
    计算点击人数

    点击人数从 backend_conversions 表聚合
    维度：date + platform + agency + business_model

    代理商映射逻辑：
    - 抖音：使用 backend_conversions.agency 字段（拼音简称），通过 AgencyAbbreviationMapping 表映射为全称
    - 腾讯：通过 backend_conversions.ad_account JOIN raw_ad_data_tencent.account_id，再 JOIN account_agency_mapping
    - 小红书：通过 backend_conversions.ad_account JOIN AccountAgencyMapping.account_name
    """
    print("    计算点击人数...")

    # 构建用户标识
    user_identifier = func.concat(
        BackendConversions.platform_source, '|',
        func.coalesce(BackendConversions.wechat_nickname, ''), '|',
        func.coalesce(BackendConversions.capital_account, ''), '|',
        func.coalesce(BackendConversions.platform_user_id, '')
    )

    # 业务模式推断逻辑
    business_model_mapping = case(
        (BackendConversions.customer_source.like('%引流%'), '直播'),
        (and_(
            BackendConversions.customer_source.isnot(None),
            BackendConversions.customer_source != ''
        ), '信息流'),
        else_=''
    )

    # ===== 1. 腾讯转化数据：通过 ad_account JOIN raw_ad_data_tencent =====
    print("      处理腾讯点击人数（通过 ad_account → raw_ad_data_tencent → account_agency_mapping）...")
    tencent_clicks = db.session.query(
        BackendConversions.lead_date.label('date'),
        AccountAgencyMapping.agency.label('agency'),
        AccountAgencyMapping.business_model.label('business_model'),
        func.count(func.distinct(user_identifier)).label('click_users')
    ).outerjoin(
        RawAdDataTencent,
        and_(
            RawAdDataTencent.account_id == BackendConversions.ad_account,
            RawAdDataTencent.date == BackendConversions.lead_date
        )
    ).outerjoin(
        AccountAgencyMapping,
        and_(
            AccountAgencyMapping.platform == '腾讯',
            AccountAgencyMapping.account_id == RawAdDataTencent.account_id
        )
    ).filter(
        and_(
            BackendConversions.lead_date >= start_date,
            BackendConversions.lead_date <= end_date,
            BackendConversions.platform_source == '腾讯'
        )
    ).group_by(
        BackendConversions.lead_date,
        AccountAgencyMapping.agency,
        AccountAgencyMapping.business_model
    ).all()

    print(f"      找到 {len(tencent_clicks)} 条腾讯点击人数聚合记录")

    # ===== 2. 抖音和小红书转化数据：使用简称映射或直接 JOIN =====
    print("      处理抖音/小红书点击人数（抖音使用简称映射，小红书使用 ad_account JOIN）...")

    # 从 AgencyAbbreviationMapping 表动态构建简称映射（用于抖音）
    agency_name_mapping = build_abbreviation_mapping_case()

    # 代理商映射：抖音使用简称映射，小红书优先从 JOIN 获取，yj 和高德作为独立平台
    agency_mapping = case(
        (BackendConversions.platform_source == '抖音', agency_name_mapping),
        (BackendConversions.platform_source == '小红书', func.coalesce(AccountAgencyMapping.agency, agency_name_mapping)),
        (BackendConversions.platform_source == 'yj', ''),
        (BackendConversions.platform_source == '高德', ''),
        else_=''
    )

    other_clicks = db.session.query(
        BackendConversions.lead_date.label('date'),
        BackendConversions.platform_source.label('platform'),
        func.coalesce(agency_mapping, '').label('agency'),
        func.coalesce(business_model_mapping, '').label('business_model'),
        func.count(func.distinct(user_identifier)).label('click_users')
    ).outerjoin(
        AccountAgencyMapping,
        and_(
            AccountAgencyMapping.platform == BackendConversions.platform_source,
            BackendConversions.platform_source == '小红书',
            AccountAgencyMapping.account_name == BackendConversions.ad_account
        )
    ).filter(
        and_(
            BackendConversions.lead_date >= start_date,
            BackendConversions.lead_date <= end_date,
            BackendConversions.platform_source.in_(['抖音', '小红书', 'yj', '高德'])
        )
    ).group_by(
        BackendConversions.lead_date,
        BackendConversions.platform_source,
        agency_mapping,
        business_model_mapping
    ).all()

    print(f"      找到 {len(other_clicks)} 条抖音/小红书点击人数聚合记录")

    # ===== 3. 更新到聚合表 =====
    updated_count = 0

    # 处理腾讯数据
    for row in tencent_clicks:
        metric = DailyMetricsUnified.query.filter_by(
            date=row.date,
            platform='腾讯',
            agency=row.agency or '',
            business_model=row.business_model or ''
        ).first()

        if metric:
            metric.click_users = int(row.click_users) if row.click_users else 0
            db.session.add(metric)
            updated_count += 1

    # 处理抖音、小红书、yj、高德数据
    for row in other_clicks:
        # 平台映射：yj→云极，高德→高德（作为独立平台）
        platform_mapping = {
            '抖音': '抖音',
            '小红书': '小红书',
            'yj': '云极',
            '高德': '高德'
        }
        platform = platform_mapping.get(row.platform, row.platform)

        metric = DailyMetricsUnified.query.filter_by(
            date=row.date,
            platform=platform,
            agency=row.agency or '',
            business_model=row.business_model or ''
        ).first()

        if metric:
            metric.click_users = int(row.click_users) if row.click_users else 0
            db.session.add(metric)
            updated_count += 1

    print(f"      点击人数更新完成，共更新 {updated_count} 条记录")


if __name__ == '__main__':
    # 解析命令行参数
    start_date = sys.argv[1] if len(sys.argv) > 1 else None
    end_date = sys.argv[2] if len(sys.argv) > 2 else None

    # 执行更新
    update_daily_metrics(start_date, end_date)
