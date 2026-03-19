# -*- coding: utf-8 -*-
"""
线索详情接口 - 线索明细、筛选选项
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import func, and_, or_, Integer, case, literal
from backend.models import (
    DailyMetricsUnified,
    AccountAgencyMapping,
    AgencyAbbreviationMapping,
    DailyNotesMetricsUnified,
    XhsNoteInfo,
    BackendConversions
)
from backend.database import db
from backend.utils.decorators import handle_exceptions
from datetime import datetime, date, timedelta

# 创建Blueprint
bp = Blueprint('leads', __name__)

@bp.route('/leads-detail', methods=['GET'])
@handle_exceptions
def get_leads_detail():
    """
    获取线索明细数据
    返回backend_conversions表的线索数据，支持分页和多维度筛选
    ---
    tags:
      - Leads
    description: |
      获取线索明细数据，返回backend_conversions表的完整线索数据。

      **支持筛选**：
      - page: 页码（默认1）
      - page_size: 每页数量（默认50）
      - start_date: 开始日期（可选）
      - end_date: 结束日期（可选）
      - platforms: 平台列表（逗号分隔）
      - agencies: 代理商列表（逗号分隔）

      **返回字段**（40个字段）：
      - 基本信息: wechat_nickname, capital_account, opening_branch, customer_gender
      - 平台信息: platform_source, traffic_type, customer_source
      - 布尔字段: is_customer_mouth, is_valid_lead, is_opened_account等
      - 时间字段: lead_date, first_contact_time, last_contact_time等
      - 数值字段: interaction_count, assets, customer_contribution
      - 人员信息: add_employee_no, add_employee_name
      - 广告信息: ad_account, agency, ad_id, creative_id
      - 笔记信息: note_id, note_title
      - 用户信息: platform_user_id, platform_user_nickname
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
        description: 页码
      - name: page_size
        in: query
        type: integer
        default: 50
        description: 每页数量
      - name: start_date
        in: query
        type: string
        format: date
        description: 开始日期 (YYYY-MM-DD)
        example: "2025-01-01"
      - name: end_date
        in: query
        type: string
        format: date
        description: 结束日期 (YYYY-MM-DD)
        example: "2025-01-31"
      - name: platforms
        in: query
        type: string
        description: 平台列表（逗号分隔）
        example: "腾讯,抖音"
      - name: agencies
        in: query
        type: string
        description: 代理商列表（逗号分隔，使用全称）
        example: "量子,众联"
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: array
              items:
                type: object
                properties:
                  wechat_nickname:
                    type: string
                  capital_account:
                    type: string
                  platform_source:
                    type: string
                  agency:
                    type: string
                    description: 代理商全称（已从简称转换）
                  lead_date:
                    type: string
                    format: date
                  is_opened_account:
                    type: boolean
                  assets:
                    type: number
                  customer_contribution:
                    type: number
            total:
              type: integer
              description: 总记录数
            page:
              type: integer
            page_size:
              type: integer
            total_pages:
              type: integer
      500:
        description: 服务器错误
    """
    from backend.database import db
    from backend.models import BackendConversions

    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        platforms = request.args.get('platforms', '').split(',') if request.args.get('platforms') else []
        agencies = request.args.get('agencies', '').split(',') if request.args.get('agencies') else []
        employee_name = request.args.get('employee_name', '')  # 服务员工筛选
        is_opened_account = request.args.get('is_opened_account', type=str)  # 是否开户

        # 获取代理商简称映射（全称 -> 简称）
        # 前端传递的是全称（如"量子"），数据库存储的是简称（如"lz"）
        abbreviation_mappings = db.session.query(AgencyAbbreviationMapping).filter(
            AgencyAbbreviationMapping.is_active == True,
            AgencyAbbreviationMapping.mapping_type == 'agency'
        ).all()

        # 创建全称 -> 简称的反向映射
        full_name_to_abbreviation = {}
        for mapping in abbreviation_mappings:
            display_name = mapping.display_name or mapping.full_name
            if display_name:
                full_name_to_abbreviation[display_name] = mapping.abbreviation
            if mapping.full_name and mapping.full_name != display_name:
                full_name_to_abbreviation[mapping.full_name] = mapping.abbreviation

        # 转换代理商全称为简称（用于查询数据库）
        agency_abbreviations = []
        for agency in agencies:
            if agency == '申万宏源直投':
                # 特殊处理：申万宏源直投
                agency_abbreviations.append(agency)
            elif agency in full_name_to_abbreviation:
                # 转换为简称
                agency_abbreviations.append(full_name_to_abbreviation[agency])
            else:
                # 没有找到映射，保持原样
                agency_abbreviations.append(agency)

        # 构建基础查询
        query = db.session.query(BackendConversions)

        # 应用筛选条件
        if start_date:
            query = query.filter(BackendConversions.lead_date >= start_date)
        if end_date:
            query = query.filter(BackendConversions.lead_date <= end_date)

        if platforms and platforms[0]:
            query = query.filter(BackendConversions.platform_source.in_(platforms))

        # 服务员工筛选
        if employee_name:
            query = query.filter(BackendConversions.add_employee_name == employee_name)

        # 是否开户筛选
        if is_opened_account:
            if is_opened_account.lower() == 'true':
                query = query.filter(BackendConversions.is_opened_account == True)
            elif is_opened_account.lower() == 'false':
                query = query.filter(BackendConversions.is_opened_account == False)

        if agency_abbreviations and agency_abbreviations[0]:
            # 处理"申万宏源直投"（空值）的筛选
            if '申万宏源直投' in agency_abbreviations:
                # 如果包含"申万宏源直投"，需要特殊处理空值
                other_agencies = [a for a in agency_abbreviations if a != '申万宏源直投']
                if other_agencies:
                    # 有其他代理商，使用OR条件：(agency IN (other_agencies) OR agency IS NULL)
                    query = query.filter(
                        or_(
                            BackendConversions.agency.in_(other_agencies),
                            BackendConversions.agency == '',
                            BackendConversions.agency.is_(None)
                        )
                    )
                else:
                    # 只选择了"申万宏源直投"，查询空值
                    query = query.filter(
                        or_(
                            BackendConversions.agency == '',
                            BackendConversions.agency.is_(None)
                        )
                    )
            else:
                # 正常代理商筛选（使用简称）
                query = query.filter(BackendConversions.agency.in_(agency_abbreviations))

        # 获取总数
        total = query.count()

        # 分页查询
        results = query.order_by(
            BackendConversions.lead_date.desc(),
            BackendConversions.platform_source,
            BackendConversions.agency
        ).limit(page_size).offset((page - 1) * page_size).all()

        # 创建简称 -> 全称的映射（用于显示）
        # 复用前面查询到的 abbreviation_mappings，避免重复查询
        agency_map = {}  # 简称 -> 全称
        for mapping in abbreviation_mappings:
            agency_map[mapping.abbreviation.lower()] = mapping.display_name or mapping.full_name or mapping.abbreviation

        # 转换结果（返回所有40个字段，与Excel 0119.xlsx格式保持一致）
        def format_datetime(dt):
            """格式化日期时间"""
            if dt is None:
                return None
            if isinstance(dt, datetime):
                return dt.strftime('%Y-%m-%d %H:%M:%S')
            return str(dt)

        def format_date(d):
            """格式化日期"""
            if d is None:
                return None
            if isinstance(d, date):
                return d.strftime('%Y-%m-%d')
            return str(d)

        def format_agency(agency_code):
            """格式化代理商：将简称转换为全称"""
            if not agency_code or agency_code == '-':
                return '-'
            agency_lower = agency_code.lower()
            return agency_map.get(agency_lower, agency_code)

        data = []
        for row in results:
            data.append({
                # 基本信息 (1-4)
                'wechat_nickname': row.wechat_nickname or '-',
                'capital_account': row.capital_account or '-',
                'opening_branch': row.opening_branch or '-',
                'customer_gender': row.customer_gender or '-',

                # 平台和流量信息 (5-7)
                'platform_source': row.platform_source or '-',
                'traffic_type': row.traffic_type or '-',
                'customer_source': row.customer_source or '-',

                # 布尔字段 (8-16)
                'is_customer_mouth': row.is_customer_mouth or False,
                'is_valid_lead': row.is_valid_lead or False,
                'is_open_account_interrupted': row.is_open_account_interrupted or False,
                'open_account_interrupted_date': format_date(row.open_account_interrupted_date),
                'is_opened_account': row.is_opened_account or False,
                'is_valid_customer': row.is_valid_customer or False,
                'is_existing_customer': row.is_existing_customer or False,
                'is_existing_valid_customer': row.is_existing_valid_customer or False,
                'is_delete_enterprise_wechat': row.is_delete_enterprise_wechat or False,

                # 时间字段 (17-27)
                'lead_date': format_date(row.lead_date),
                'first_contact_time': format_datetime(row.first_contact_time),
                'last_contact_time': format_datetime(row.last_contact_time),
                'account_opening_time': format_datetime(row.account_opening_time),
                'wechat_verify_status': row.wechat_verify_status or '-',
                'wechat_verify_time': format_datetime(row.wechat_verify_time),
                'valid_customer_time': format_datetime(row.valid_customer_time),
                'ad_click_date': format_date(row.ad_click_date),

                # 数值字段 (28-29)
                'interaction_count': row.interaction_count or 0,
                'sales_interaction_count': row.sales_interaction_count or 0,
                'assets': float(row.assets) if row.assets else 0,
                'customer_contribution': float(row.customer_contribution) if row.customer_contribution else 0,

                # 人员信息 (30-31)
                'add_employee_no': row.add_employee_no or '-',
                'add_employee_name': row.add_employee_name or '-',

                # 广告投放信息 (32-35)
                'ad_account': row.ad_account or '-',
                'agency': format_agency(row.agency),  # 转换为全称
                'ad_id': row.ad_id or '-',
                'creative_id': row.creative_id or '-',

                # 小红书笔记信息 (36-37)
                'note_id': row.note_id or '-',
                'note_title': row.note_title or '-',

                # 平台用户信息 (38-39)
                'platform_user_id': row.platform_user_id or '-',
                'platform_user_nickname': row.platform_user_nickname or '-',

                # 其他信息 (40)
                'producer': row.producer or '-',
                'enterprise_wechat_tags': row.enterprise_wechat_tags or '-'
            })

        return jsonify({
            'success': True,
            'data': {
                'items': data,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size if total > 0 else 1
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



@bp.route('/leads-detail/filter-options', methods=['GET'])
@handle_exceptions
def get_leads_detail_filter_options():
    """
    获取线索明细筛选器选项
    返回平台和代理商的简称与全称映射关系
    ---
    tags:
      - Leads
    description: |
      获取线索明细报表筛选器的所有选项数据，包括：
      - platforms: 平台选项列表（value + label）
      - agencies: 代理商选项列表（value + label），包含特殊选项"申万宏源直投"

      **平台选项示例**：
      - {"value": "腾讯", "label": "腾讯"}
      - {"value": "抖音", "label": "抖音"}
      - {"value": "小红书", "label": "小红书"}

      **代理商选项示例**：
      - {"value": "lz", "label": "量子"}
      - {"value": "zl", "label": "众联"}
      - {"value": "申万宏源直投", "label": "申万宏源直投"}
    responses:
      200:
        description: 成功响应
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            data:
              type: object
              properties:
                platforms:
                  type: array
                  items:
                    type: object
                    properties:
                      value:
                        type: string
                        example: "腾讯"
                      label:
                        type: string
                        example: "腾讯"
                agencies:
                  type: array
                  items:
                    type: object
                    properties:
                      value:
                        type: string
                        example: "lz"
                      label:
                        type: string
                        example: "量子"
      500:
        description: 服务器错误
    """
    from backend.database import db
    from backend.models import BackendConversions, AgencyAbbreviationMapping

    try:
        # 获取所有平台来源
        platforms = db.session.query(
            BackendConversions.platform_source
        ).distinct().filter(
            BackendConversions.platform_source.isnot(None)
        ).order_by(BackendConversions.platform_source).all()

        # 获取所有代理商
        agencies = db.session.query(
            BackendConversions.agency
        ).distinct().filter(
            BackendConversions.agency.isnot(None),
            BackendConversions.agency != ''
        ).order_by(BackendConversions.agency).all()

        # 获取简称映射
        abbreviation_mappings = db.session.query(AgencyAbbreviationMapping).filter(
            AgencyAbbreviationMapping.is_active == True
        ).all()

        # 创建映射字典
        platform_map = {}  # 简称 -> 全称
        agency_map = {}     # 简称 -> 全称

        for mapping in abbreviation_mappings:
            if mapping.mapping_type == 'platform':
                platform_map[mapping.abbreviation.lower()] = {
                    'full_name': mapping.full_name,
                    'display_name': mapping.display_name or mapping.full_name
                }
            elif mapping.mapping_type == 'agency':
                agency_map[mapping.abbreviation.lower()] = {
                    'full_name': mapping.full_name,
                    'display_name': mapping.display_name or mapping.full_name
                }

        # 构建平台选项
        platform_options = []
        for p in platforms:
            code = p[0]
            code_lower = code.lower()

            # 尝试从映射表获取全称
            if code_lower in platform_map:
                display_name = platform_map[code_lower]['display_name']
            else:
                display_name = code

            platform_options.append({
                'value': code,
                'label': display_name
            })

        # 构建代理商选项
        agency_options = []
        for a in agencies:
            code = a[0]
            code_lower = code.lower()

            # 尝试从映射表获取全称
            if code_lower in agency_map:
                display_name = agency_map[code_lower]['display_name']
            else:
                display_name = code

            agency_options.append({
                'value': code,
                'label': display_name
            })

        # 添加"申万宏源直投"选项（用于筛选空值）
        agency_options.append({
            'value': '申万宏源直投',
            'label': '申万宏源直投'
        })

        # 获取所有服务员工（从 backend_conversions.add_employee_name）
        employees = db.session.query(
            BackendConversions.add_employee_name
        ).distinct().filter(
            BackendConversions.add_employee_name.isnot(None),
            BackendConversions.add_employee_name != ''
        ).order_by(BackendConversions.add_employee_name).all()

        employee_options = [{'value': emp[0], 'label': emp[0]} for emp in employees]

        return jsonify({
            'success': True,
            'data': {
                'platforms': platform_options,
                'agencies': agency_options,
                'employees': employee_options
            }
        })

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': f'查询失败: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500



