# -*- coding: utf-8 -*-
"""
省心投 BI - 元数据API接口
提供平台、代理商、业务模式等元数据
"""

from flask import Blueprint, jsonify
from backend.models import AccountAgencyMapping
from config import PLATFORMS, BUSINESS_MODELS
from sqlalchemy import distinct, or_, func
from datetime import datetime, date
import logging

bp = Blueprint('metadata', __name__)
logger = logging.getLogger(__name__)

@bp.route('/metadata', methods=['GET'])
def get_metadata():
    """
    获取系统元数据
    返回平台列表、代理商列表、业务模式、日期范围等

    数据来源:
    - platforms: 从 backend_conversions.platform_source 获取
    - agencies: 从 account_agency_mapping 表获取，并结合 agency_abbreviation_mapping 转换简称为全称
    - business_models: 从 account_agency_mapping 表获取
    - date_range: 从 backend_conversions 表获取
    """
    from backend.database import db  # 避免循环导入
    from backend.models import BackendConversions, AgencyAbbreviationMapping
    from sqlalchemy import func

    # ===== 1. 获取平台列表（从 backend_conversions.platform_source） =====
    try:
        platforms_query = db.session.query(
            distinct(BackendConversions.platform_source)
        ).filter(
            BackendConversions.platform_source.isnot(None),
            BackendConversions.platform_source != ''
        ).order_by(BackendConversions.platform_source)

        platforms = [row[0] for row in platforms_query.all()]
    except Exception as e:
        print(f"获取平台列表失败: {str(e)}")
        platforms = PLATFORMS

    # ===== 2. 获取代理商列表（从 agency_abbreviation_mapping 表直接获取） =====
    try:
        # 2.1 从 agency_abbreviation_mapping 表获取所有启用的代理商
        abbreviation_mappings = db.session.query(
            AgencyAbbreviationMapping.full_name,
            AgencyAbbreviationMapping.display_name
        ).filter(
            AgencyAbbreviationMapping.is_active == True,
            AgencyAbbreviationMapping.mapping_type == 'agency'
        ).all()

        # 2.2 构建代理商列表
        agencies_set = set()
        for mapping in abbreviation_mappings:
            # 优先使用 display_name，否则使用 full_name
            agency_name = mapping.display_name or mapping.full_name
            if agency_name:
                agencies_set.add(agency_name)

        # 2.3 添加"申万宏源直投"（无简称，手动添加）
        agencies_set.add('申万宏源直投')

        # 2.4 添加"未归因"（用于筛选无法归因到代理商的数据）
        agencies_set.add('未归因')

        agencies = sorted(list(agencies_set))

    except Exception as e:
        print(f"获取代理商列表失败: {str(e)}")
        agencies = ['量子', '众联', '绩牛', '风声', '优品', '信则', '美洋', '申万宏源直投', '未归因']

    # ===== 3. 获取业务模式列表（从 account_agency_mapping） =====
    try:
        business_models_query = db.session.query(
            distinct(AccountAgencyMapping.business_model)
        ).filter(
            AccountAgencyMapping.business_model.isnot(None),
            AccountAgencyMapping.business_model != ''
        ).order_by(AccountAgencyMapping.business_model)

        business_models_set = set(row[0] for row in business_models_query.all())

        # 添加"未归因"（用于筛选无法归因到业务模式的数据）
        business_models_set.add('未归因')

        business_models = sorted(list(business_models_set))
    except Exception as e:
        print(f"获取业务模式列表失败: {str(e)}")
        business_models = BUSINESS_MODELS + ['未归因']

    # ===== 4. 获取日期范围（从 backend_conversions） =====
    try:
        date_range_query = db.session.query(
            func.min(BackendConversions.lead_date).label('min_date'),
            func.max(BackendConversions.lead_date).label('max_date')
        ).first()

        date_range = {
            'start': date_range_query.min_date.strftime('%Y-%m-%d') if date_range_query.min_date else None,
            'end': date_range_query.max_date.strftime('%Y-%m-%d') if date_range_query.max_date else None
        }
    except Exception:
        # 如果没有数据，返回None
        date_range = {
            'start': None,
            'end': None
        }

    # 获取所有账号映射（从 account_agency_mapping 表）
    try:
        accounts_query = db.session.query(
            AccountAgencyMapping.account_id,
            AccountAgencyMapping.account_name,
            AccountAgencyMapping.platform,
            AccountAgencyMapping.agency
        ).order_by(AccountAgencyMapping.platform, AccountAgencyMapping.agency)

        accounts = [
            {
                'account_id': row.account_id,
                'account_name': row.account_name,
                'platform': row.platform,
                'agency': row.agency
            }
            for row in accounts_query.all()
        ]
    except Exception:
        accounts = []

    metadata = {
        'platforms': platforms,
        'business_models': business_models,
        'agencies': agencies,
        'date_range': date_range,
        'accounts': accounts
    }

    return jsonify({
        'success': True,
        'data': metadata
    })


@bp.route('/platforms', methods=['GET'])
def get_platforms():
    """获取平台列表（从 daily_metrics_unified 动态获取）"""
    from backend.database import db
    from backend.models import DailyMetricsUnified

    try:
        platforms_query = db.session.query(
            distinct(DailyMetricsUnified.platform)
        ).order_by(DailyMetricsUnified.platform)

        platforms = [row[0] for row in platforms_query.all() if row[0]]
    except Exception:
        platforms = PLATFORMS

    return jsonify({
        'platforms': platforms
    })


@bp.route('/agencies', methods=['GET'])
def get_agencies():
    """获取代理商列表（从 daily_metrics_unified 动态获取）"""
    from backend.database import db
    from backend.models import DailyMetricsUnified

    try:
        agencies_query = db.session.query(
            distinct(DailyMetricsUnified.agency)
        ).filter(
            DailyMetricsUnified.agency != '',
            DailyMetricsUnified.agency != None
        ).order_by(DailyMetricsUnified.agency)

        agencies = [row[0] for row in agencies_query.all() if row[0]]
    except Exception:
        agencies = ['量子', '众联', '绩牛', '风声', '优品', '信则', '美洋', '申万宏源直投', '未归因']

    return jsonify({
        'agencies': agencies
    })


@bp.route('/business-models', methods=['GET'])
def get_business_models():
    """获取业务模式列表（从 daily_metrics_unified 动态获取）"""
    from backend.database import db
    from backend.models import DailyMetricsUnified

    try:
        business_models_query = db.session.query(
            distinct(DailyMetricsUnified.business_model)
        ).filter(
            DailyMetricsUnified.business_model != '',
            DailyMetricsUnified.business_model != None
        ).order_by(DailyMetricsUnified.business_model)

        business_models_set = set(row[0] for row in business_models_query.all() if row[0])

        # 添加"未归因"（用于筛选无法归因到业务模式的数据）
        business_models_set.add('未归因')

        business_models = sorted(list(business_models_set))
    except Exception:
        business_models = BUSINESS_MODELS + ['未归因']

    return jsonify({
        'business_models': business_models
    })


def get_data_status():
    """
    获取各数据源的最新日期和状态

    查询 6 个数据源的最新日期：
    1. raw_ad_data_tencent (date 字段)
    2. raw_ad_data_douyin (date 字段)
    3. raw_ad_data_xiaohongshu (date 字段)
    4. backend_conversions (lead_date 字段)
    5. xhs_notes_content_daily (data_date 字段)
    6. xhs_notes_daily (date 字段)

    状态规则：
    - normal (绿色): days_ago <= 5
    - warning (黄色): 6 <= days_ago <= 14
    - critical (红色): days_ago > 14

    Returns:
        dict: 包含 6 个数据源状态的字典
    """
    from backend.database import db
    from backend.models import (
        RawAdDataTencent, RawAdDataDouyin, RawAdDataXiaohongshu,
        BackendConversions, XhsNotesContentDaily, XhsNotesDaily
    )

    # 数据源配置（按业务分组）
    data_sources = {
        # 第一行：账号广告数据
        'douyin_ads': {
            'model': RawAdDataDouyin,
            'date_field': 'date',
            'name': '抖音广告',
            'group': 'account_ads',
            'order': 1
        },
        'xiaohongshu_ads': {
            'model': RawAdDataXiaohongshu,
            'date_field': 'date',
            'name': '小红书广告',
            'group': 'account_ads',
            'order': 2
        },
        'tencent_ads': {
            'model': RawAdDataTencent,
            'date_field': 'date',
            'name': '腾讯广告',
            'group': 'account_ads',
            'order': 3
        },
        # 第二行：小红书笔记数据
        'xhs_notes_daily': {
            'model': XhsNotesDaily,
            'date_field': 'date',
            'name': '小红书笔记投放',
            'group': 'xhs_notes',
            'order': 4
        },
        'xhs_notes_content_daily': {
            'model': XhsNotesContentDaily,
            'date_field': 'data_date',
            'name': '小红书笔记运营',
            'group': 'xhs_notes',
            'order': 5
        },
        # 第三行：后端转化数据
        'backend_conversions': {
            'model': BackendConversions,
            'date_field': 'lead_date',
            'name': '后端转化',
            'group': 'backend_conversions',
            'order': 6
        }
    }

    results = {}
    today = date.today()

    for source_key, source_config in data_sources.items():
        try:
            # 查询最新日期
            model = source_config['model']
            date_field = getattr(model, source_config['date_field'])

            latest_date = db.session.query(
                func.max(date_field)
            ).scalar()

            if latest_date:
                # 计算天数差
                days_ago = (today - latest_date).days
                latest_date_str = latest_date.strftime('%Y-%m-%d')

                # 确定状态
                if days_ago <= 5:
                    status = 'normal'
                elif days_ago <= 14:
                    status = 'warning'
                else:
                    status = 'critical'

                results[source_key] = {
                    'name': source_config['name'],
                    'latest_date': latest_date_str,
                    'days_ago': days_ago,
                    'status': status,
                    'group': source_config['group'],
                    'order': source_config['order']
                }
            else:
                # 没有数据
                results[source_key] = {
                    'name': source_config['name'],
                    'latest_date': None,
                    'days_ago': None,
                    'status': 'no_data',
                    'group': source_config['group'],
                    'order': source_config['order']
                }

        except Exception as e:
            # 查询失败（可能是表不存在）
            logger.error(f"查询 {source_key} 数据状态失败: {str(e)}")
            results[source_key] = {
                'name': source_config['name'],
                'latest_date': None,
                'days_ago': None,
                'status': 'error',
                'group': source_config['group'],
                'order': source_config['order'],
                'error': str(e)
            }

    return results


@bp.route('/data-freshness', methods=['GET'])
def get_data_freshness():
    """
    获取数据新鲜度状态

    GET /api/v1/data-freshness

    Returns:
        JSON response with success status and data freshness information
        {
            "success": true,
            "data": {
                "tencent_ads": { ... },
                "douyin_ads": { ... },
                ...
            }
        }
    """
    try:
        data_status = get_data_status()

        return jsonify({
            'success': True,
            'data': data_status
        })

    except Exception as e:
        logger.error(f"获取数据新鲜度失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
