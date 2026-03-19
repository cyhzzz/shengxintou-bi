# -*- coding: utf-8 -*-
"""
员工转化数据查询辅助函数

提供员工转化效果分析的数据查询功能，支持：
- 多平台筛选（小红书、腾讯、抖音）
- 服务人员筛选
- 存量/新增线索区分
- 周度趋势分析
"""
from backend.database import db
from backend.models import BackendConversions
from sqlalchemy import func, case, and_, or_
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


def get_qualified_employees(min_leads=30):
    """
    获取符合条件的员工列表（全量线索数 >= min_leads）

    用途：过滤掉全量线索数过少的员工，避免样本量不足导致转化率失真

    Args:
        min_leads: 最小线索数阈值，默认为30

    Returns:
        list: 符合条件的员工姓名列表
    """
    try:
        # 计算每个员工在全量表中的总线索数
        query = db.session.query(
            BackendConversions.add_employee_name,
            func.count(BackendConversions.id).label('total_leads')
        ).filter(
            and_(
                BackendConversions.add_employee_name.isnot(None),
                BackendConversions.add_employee_name != ''
            )
        ).group_by(BackendConversions.add_employee_name)

        results = query.all()

        # 筛选线索数 >= min_leads 的员工
        qualified = [row.add_employee_name for row in results
                     if row.total_leads >= min_leads]

        logger.info(f"[Filter] 符合条件的员工: {len(qualified)}/{len(results)} (阈值={min_leads})")
        return qualified

    except Exception as e:
        logger.error(f"获取符合条件的员工列表失败: {e}")
        return []


def get_platform_filter(platform):
    """
    获取平台筛选条件

    Args:
        platform: 平台名称 (小红书/腾讯/抖音)

    Returns:
        筛选条件
    """
    if platform == '腾讯':
        # 腾讯平台包含多个来源标识
        return BackendConversions.platform_source.in_(['腾讯', 'yj', '高德'])
    else:
        return BackendConversions.platform_source == platform


def get_employee_conversion_ranking(platforms, start_date=None, end_date=None, lead_type='all', employees=None):
    """
    获取员工转化排行榜

    Args:
        platforms: 平台列表 ['小红书', '腾讯', '抖音']
        start_date: 开始日期 (YYYY-MM-DD)，可选，为空时查询全部
        end_date: 结束日期 (YYYY-MM-DD)，可选，为空时查询全部
        lead_type: 线索类型 (all/existing/new)
        employees: 服务人员列表（可选，用于筛选特定人员）

    Returns:
        list: 排行榜数据列表，按开户率降序排列
    """
    try:
        # 构建基础查询
        query = db.session.query(
            BackendConversions.add_employee_name,
            BackendConversions.platform_source,
            func.count(BackendConversions.id).label('total_leads'),
            func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('mouth_count'),
            func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('valid_lead_count'),
            func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('opened_count'),
            func.sum(case((BackendConversions.is_valid_customer == True, 1), else_=0)).label('valid_customer_count'),
            func.sum(BackendConversions.assets).label('total_assets')
        ).filter(
            and_(
                BackendConversions.add_employee_name.isnot(None),
                BackendConversions.add_employee_name != ''
            )
        )

        # 日期筛选（可选）
        if start_date and end_date:
            query = query.filter(
                and_(
                    BackendConversions.lead_date >= start_date,
                    BackendConversions.lead_date <= end_date
                )
            )

        # 【新增】获取符合条件的员工列表（全量线索数 >= 5）
        qualified_employees = get_qualified_employees(min_leads=5)

        # 【新增】员工预过滤：只查询符合条件的员工
        query = query.filter(
            BackendConversions.add_employee_name.in_(qualified_employees)
        )

        # 平台筛选（支持多选）
        platform_filters = []
        for platform in platforms:
            if platform == '腾讯':
                platform_filters.append(BackendConversions.platform_source.in_(['腾讯', 'yj', '高德']))
            else:
                platform_filters.append(BackendConversions.platform_source == platform)

        if platform_filters:
            query = query.filter(or_(*platform_filters))

        # 线索类型筛选
        if lead_type == 'existing':
            query = query.filter(BackendConversions.is_existing_customer == True)
        elif lead_type == 'new':
            query = query.filter(
                or_(
                    BackendConversions.is_existing_customer == False,
                    BackendConversions.is_existing_customer.is_(None)
                )
            )

        # 服务人员筛选（用户指定的员工，也必须是符合条件的员工）
        if employees and len(employees) > 0:
            # 取交集：用户指定的员工 ∩ 符合条件的员工
            valid_employees = [emp for emp in employees if emp in qualified_employees]
            if valid_employees:
                query = query.filter(BackendConversions.add_employee_name.in_(valid_employees))

        # 分组
        query = query.group_by(BackendConversions.add_employee_name, BackendConversions.platform_source)

        # 执行查询
        results = query.all()

        # 按服务人员聚合（跨平台）
        employee_data = defaultdict(lambda: {
            'total_leads': 0, 'mouth_count': 0, 'valid_lead_count': 0,
            'opened_count': 0, 'valid_customer_count': 0, 'total_assets': 0
        })

        for row in results:
            employee_data[row.add_employee_name]['total_leads'] += row.total_leads or 0
            employee_data[row.add_employee_name]['mouth_count'] += row.mouth_count or 0
            employee_data[row.add_employee_name]['valid_lead_count'] += row.valid_lead_count or 0
            employee_data[row.add_employee_name]['opened_count'] += row.opened_count or 0
            employee_data[row.add_employee_name]['valid_customer_count'] += row.valid_customer_count or 0
            employee_data[row.add_employee_name]['total_assets'] += float(row.total_assets or 0)

        # 计算开户率并排序
        ranking_data = []
        for employee_name, data in employee_data.items():
            total_leads = data['total_leads']
            opened_count = data['opened_count']
            valid_customer_count = data['valid_customer_count']

            opening_rate = round(opened_count * 100.0 / total_leads, 2) if total_leads > 0 else 0
            valid_customer_rate = round(valid_customer_count * 100.0 / opened_count, 2) if opened_count > 0 else 0

            ranking_data.append({
                'employee_name': employee_name,
                'total_leads': total_leads,
                'mouth_count': data['mouth_count'],
                'valid_lead_count': data['valid_lead_count'],
                'opened_count': opened_count,
                'valid_customer_count': valid_customer_count,
                'opening_rate': opening_rate,
                'valid_customer_rate': valid_customer_rate,
                'total_assets': data['total_assets']
            })

        # 按开户率降序排序
        ranking_data.sort(key=lambda x: x['opening_rate'], reverse=True)

        # 添加排名
        for idx, item in enumerate(ranking_data):
            item['rank'] = idx + 1

        return ranking_data

    except Exception as e:
        logger.error(f"获取员工转化排行榜失败: {e}")
        return []


def get_weekly_trend_data(platforms, start_date=None, end_date=None, employees=None):
    """
    获取周度趋势数据（与小红书报表格式一致）

    数据口径：
    - 加微数（lead_users）= 所有行数（每行1个加微）
    - 开口客户数（customer_mouth_users）= is_customer_mouth = 1 的行数
    - 有效线索数（valid_lead_users）= is_valid_lead = 1 的行数
    - 开户数（opened_account_users）= is_opened_account = 1 的行数

    Args:
        platforms: 平台列表
        start_date: 开始日期，可选，为空时查询全部
        end_date: 结束日期，可选，为空时查询全部
        employees: 服务人员列表（可选）

    Returns:
        dict: 周度趋势数据，格式与小红书报表一致
        {
            'weeks': ['2025-01', '2025-02', ...],  # YYYY-WW格式
            'dateRanges': ['0106-0112', ...],      # MMDD-MMDD格式
            'lead_users': [100, 120, ...],          # 加微数
            'customer_mouth_users': [50, 60, ...],  # 开口客户数
            'valid_lead_users': [40, 50, ...],      # 有效线索数
            'opened_account_users': [10, 12, ...]   # 开户数
        }
    """
    try:
        # 将日期字符串转换为日期对象（如果有）
        if start_date and isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if end_date and isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        # 构建基础查询 - 按周聚合（与小红书报表一致的数据口径）
        query = db.session.query(
            func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
            func.count(BackendConversions.id).label('total_wechat_adds'),  # 加微数（所有行数）
            func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('total_customer_mouths'),  # 开口客户数
            func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('total_valid_leads'),  # 有效线索数
            func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('total_opened_accounts')  # 开户数
        ).filter(
            and_(
                BackendConversions.add_employee_name.isnot(None),
                BackendConversions.add_employee_name != ''
            )
        )

        # 日期筛选（可选）
        if start_date and end_date:
            query = query.filter(
                and_(
                    BackendConversions.lead_date >= start_date,
                    BackendConversions.lead_date <= end_date
                )
            )

        # 平台筛选
        platform_filters = []
        for platform in platforms:
            if platform == '腾讯':
                platform_filters.append(BackendConversions.platform_source.in_(['腾讯', 'yj', '高德']))
            else:
                platform_filters.append(BackendConversions.platform_source == platform)

        if platform_filters:
            query = query.filter(or_(*platform_filters))

        # 服务人员筛选
        if employees and len(employees) > 0:
            query = query.filter(BackendConversions.add_employee_name.in_(employees))

        # 按周分组并排序
        query = query.group_by('week').order_by('week')

        # 执行查询
        results = query.all()

        # 构建趋势数据（与小红书报表格式一致）
        trend_data = {
            'weeks': [],
            'dateRanges': [],
            'lead_users': [],
            'customer_mouth_users': [],
            'valid_lead_users': [],
            'opened_account_users': []
        }

        for row in results:
            week_str = row.week  # 格式: YYYY-周数
            year, week_num = week_str.split('-')

            # 计算该周的日期范围（周一到周日）
            week_start = datetime.strptime(f"{year}-{week_num}-0", "%Y-%W-%w")
            week_end = week_start + timedelta(days=6)
            date_range_str = f"{week_start.strftime('%m%d')}-{week_end.strftime('%m%d')}"

            trend_data['weeks'].append(week_str)
            trend_data['dateRanges'].append(date_range_str)
            trend_data['lead_users'].append(int(row.total_wechat_adds or 0))
            trend_data['customer_mouth_users'].append(int(row.total_customer_mouths or 0))
            trend_data['valid_lead_users'].append(int(row.total_valid_leads or 0))
            trend_data['opened_account_users'].append(int(row.total_opened_accounts or 0))

        logger.info(f"[EmployeeConversion] get_weekly_trend_data: {len(trend_data['weeks'])} weeks")
        return trend_data

    except Exception as e:
        logger.error(f"获取周度趋势数据失败: {e}")
        return {
            'weeks': [],
            'dateRanges': [],
            'lead_users': [],
            'customer_mouth_users': [],
            'valid_lead_users': [],
            'opened_account_users': []
        }


def get_employee_rate_trend(platforms, start_date=None, end_date=None, employees=None):
    """
    获取员工开户转化率走势（与小红书报表格式一致）

    数据口径：
    - 加微数 = 所有行数（每行1个加微）
    - 开户数 = is_opened_account = 1 的行数
    - 转化率 = 开户数 / 加微数 × 100%

    ⚠️ 已优化：自动过滤全量线索数 < 5 的员工

    Args:
        platforms: 平台列表
        start_date: 开始日期，可选，为空时查询全部
        end_date: 结束日期，可选，为空时查询全部
        employees: 服务人员列表（可选，为空则返回所有符合条件的员工）

    Returns:
        dict: 员工转化率走势数据，格式与小红书报表一致
        {
            'weeks': ['2025-01', '2025-02', ...],  # YYYY-WW格式
            'employees': ['张三', '李四', ...],     # 员工列表
            'series': [[15.5, 20.3, ...], ...]      # 每个员工的周度转化率数据
        }
    """
    try:
        # 【新增】获取符合条件的员工列表（全量线索数 >= 5）
        qualified_employees = get_qualified_employees(min_leads=5)

        # 如果没有指定员工，获取所有符合条件的员工
        if not employees or len(employees) == 0:
            ranking = get_employee_conversion_ranking(platforms, start_date, end_date, 'all', None)
            employees = [item['employee_name'] for item in ranking]

        # 【新增】取交集：确保只处理符合条件的员工
        employees = [emp for emp in employees if emp in qualified_employees]

        if not employees:
            return {'weeks': [], 'employees': [], 'series': []}

        # 将日期字符串转换为日期对象（如果有）
        if start_date and isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if end_date and isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        # 构建查询 - 按员工和周聚合
        query = db.session.query(
            BackendConversions.add_employee_name,
            func.strftime('%Y-%W', BackendConversions.lead_date).label('week'),
            func.count(BackendConversions.id).label('total_wechat_adds'),  # 加微数（所有行数）
            func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('opened_accounts')  # 开户数
        ).filter(
            BackendConversions.add_employee_name.in_(employees)
        )

        # 日期筛选（可选）
        if start_date and end_date:
            query = query.filter(
                and_(
                    BackendConversions.lead_date >= start_date,
                    BackendConversions.lead_date <= end_date
                )
            )

        # 平台筛选
        platform_filters = []
        for platform in platforms:
            if platform == '腾讯':
                platform_filters.append(BackendConversions.platform_source.in_(['腾讯', 'yj', '高德']))
            else:
                platform_filters.append(BackendConversions.platform_source == platform)

        if platform_filters:
            query = query.filter(or_(*platform_filters))

        # 按员工和周分组
        query = query.group_by(BackendConversions.add_employee_name, 'week').order_by('week')

        # 执行查询
        results = query.all()

        # 构建周度数据结构
        weekly_data = {
            'weeks': set(),
            'employees': set(),
            'rates': {}
        }

        for row in results:
            if not row.add_employee_name:
                continue

            week = row.week  # 格式: YYYY-WW
            wechat_adds = row.total_wechat_adds or 0  # 加微数
            opened_accounts = row.opened_accounts or 0  # 开户数

            # 计算开户转化率 = 开户数 / 加微数
            rate = (opened_accounts / wechat_adds * 100) if wechat_adds > 0 else 0

            weekly_data['weeks'].add(week)
            weekly_data['employees'].add(row.add_employee_name)

            if row.add_employee_name not in weekly_data['rates']:
                weekly_data['rates'][row.add_employee_name] = {}

            weekly_data['rates'][row.add_employee_name][week] = round(rate, 2)

        # 排序并去重周
        sorted_weeks = sorted(list(weekly_data['weeks']))

        # 保持员工顺序与输入一致（TOP5顺序）
        sorted_employees = [emp for emp in employees if emp in weekly_data['employees']]

        # 构建图表数据（与小红书报表格式一致）
        employee_weekly_conversion = {
            'weeks': sorted_weeks,
            'employees': sorted_employees,
            'series': []
        }

        # 为每个员工生成周度数据
        for emp_name in sorted_employees:
            series_data = []
            for week in sorted_weeks:
                rate = weekly_data['rates'].get(emp_name, {}).get(week, 0)
                series_data.append(rate)
            employee_weekly_conversion['series'].append(series_data)

        logger.info(f"[EmployeeRateTrend] weeks={len(sorted_weeks)}, employees={len(sorted_employees)}, series={len(employee_weekly_conversion['series'])}")
        return employee_weekly_conversion

    except Exception as e:
        logger.error(f"获取员工转化率走势失败: {e}")
        return {'weeks': [], 'employees': [], 'series': []}


def get_weekly_report_data(start_date, end_date, platforms, top_count=10):
    """
    获取周报数据

    Args:
        start_date: 周一日期
        end_date: 周日日期
        platforms: 平台列表
        top_count: 榜单人数

    Returns:
        dict: 周报数据，包含概览、各平台榜单、转化之星
    """
    result = {
        'period': {'start': start_date, 'end': end_date},
        'overview': {},
        'rankings': {},
        'stars': {}
    }

    for platform in platforms:
        # 获取各类型榜单
        result['rankings'][platform] = {
            'total': get_employee_conversion_ranking([platform], start_date, end_date, 'all')[:top_count],
            'existing': get_employee_conversion_ranking([platform], start_date, end_date, 'existing')[:top_count],
            'new': get_employee_conversion_ranking([platform], start_date, end_date, 'new')[:top_count]
        }

        # 计算概览数据
        total_data = result['rankings'][platform]['total']
        total_leads = sum(item['total_leads'] for item in total_data)
        total_opened = sum(item['opened_count'] for item in total_data)
        total_assets = sum(item['total_assets'] for item in total_data)

        result['overview'][platform] = {
            'leads': total_leads,
            'opened': total_opened,
            'rate': round(total_opened * 100.0 / total_leads, 2) if total_leads > 0 else 0,
            'assets': total_assets
        }

        # 获取转化之星
        if total_data:
            result['stars'][platform] = {
                'name': total_data[0]['employee_name'],
                'rate': total_data[0]['opening_rate'],
                'leads': total_data[0]['total_leads'],
                'opened': total_data[0]['opened_count']
            }

    return result


def get_employee_list():
    """
    获取服务人员列表（用于下拉筛选）

    ⚠️ 已优化：只返回全量线索数 >= 5 的员工

    Returns:
        list: 服务人员姓名列表（按拼音排序）
    """
    try:
        qualified = get_qualified_employees(min_leads=5)
        return sorted(qualified)
    except Exception as e:
        logger.error(f"获取服务人员列表失败: {e}")
        return []


def get_platform_overview(platforms, start_date=None, end_date=None):
    """
    获取平台维度概览数据

    Args:
        platforms: 平台列表
        start_date: 开始日期，可选，为空时查询全部
        end_date: 结束日期，可选，为空时查询全部

    Returns:
        dict: 各平台的概览数据
    """
    overview = {}

    for platform in platforms:
        try:
            # 构建查询
            query = db.session.query(
                func.count(BackendConversions.id).label('total_leads'),
                func.sum(case((BackendConversions.is_customer_mouth == True, 1), else_=0)).label('mouth_count'),
                func.sum(case((BackendConversions.is_valid_lead == True, 1), else_=0)).label('valid_lead_count'),
                func.sum(case((BackendConversions.is_opened_account == True, 1), else_=0)).label('opened_count'),
                func.sum(case((BackendConversions.is_valid_customer == True, 1), else_=0)).label('valid_customer_count'),
                func.sum(BackendConversions.assets).label('total_assets')
            )

            # 日期筛选（可选）
            if start_date and end_date:
                query = query.filter(
                    and_(
                        BackendConversions.lead_date >= start_date,
                        BackendConversions.lead_date <= end_date
                    )
                )

            # 平台筛选
            if platform == '腾讯':
                query = query.filter(BackendConversions.platform_source.in_(['腾讯', 'yj', '高德']))
            else:
                query = query.filter(BackendConversions.platform_source == platform)

            result = query.first()

            if result:
                total_leads = result.total_leads or 0
                opened_count = result.opened_count or 0

                overview[platform] = {
                    'total_leads': total_leads,
                    'mouth_count': result.mouth_count or 0,
                    'valid_lead_count': result.valid_lead_count or 0,
                    'opened_count': opened_count,
                    'valid_customer_count': result.valid_customer_count or 0,
                    'total_assets': float(result.total_assets or 0),
                    'opening_rate': round(opened_count * 100.0 / total_leads, 2) if total_leads > 0 else 0
                }
            else:
                overview[platform] = {
                    'total_leads': 0,
                    'mouth_count': 0,
                    'valid_lead_count': 0,
                    'opened_count': 0,
                    'valid_customer_count': 0,
                    'total_assets': 0,
                    'opening_rate': 0
                }

        except Exception as e:
            logger.error(f"获取{platform}平台概览数据失败: {e}")
            overview[platform] = {
                'total_leads': 0,
                'mouth_count': 0,
                'valid_lead_count': 0,
                'opened_count': 0,
                'valid_customer_count': 0,
                'total_assets': 0,
                'opening_rate': 0
            }

    return overview