# -*- coding: utf-8 -*-
"""
周次计算工具函数 v2.0

使用更简单直接的方法计算周次（周五到次周四）
"""

from datetime import date, datetime, timedelta
from typing import Dict, List


def get_week_info(friday: date) -> Dict:
    """
    根据周五日期计算周信息

    Args:
        friday: 周五的日期

    Returns:
        周信息字典
    """
    # 计算次周四
    thursday = friday + timedelta(days=6)

    year = friday.year
    month = friday.month

    # 计算全年第几周 - 找该年第一个周五
    jan_1 = date(year, 1, 1)
    weekday_jan1 = jan_1.weekday()  # 0=周一, 4=周五, 6=周日

    if weekday_jan1 <= 4:
        # 1月1日是周一到周五，第一个周五在1月内
        days_to_first_friday = 4 - weekday_jan1
        first_friday = jan_1 + timedelta(days=days_to_first_friday)
    else:
        # 1月1日是周六或周日，第一个周五在下周
        days_to_first_friday = 4 + (7 - weekday_jan1)
        first_friday = jan_1 + timedelta(days=days_to_first_friday)

    # 计算周次
    days_diff = (friday - first_friday).days
    report_week = (days_diff // 7) + 1

    # 计算月内第几周 - 找该月第一个周五
    month_1 = date(year, month, 1)
    weekday_month_1 = month_1.weekday()

    if weekday_month_1 <= 4:
        days_to_first_friday_month = 4 - weekday_month_1
        first_friday_month = month_1 + timedelta(days=days_to_first_friday_month)
    else:
        days_to_first_friday_month = 4 + (7 - weekday_month_1)
        first_friday_month = month_1 + timedelta(days=days_to_first_friday_month)

    days_diff_month = (friday - first_friday_month).days
    report_month_week = (days_diff_month // 7) + 1

    # 格式化日期
    start_date_str = friday.strftime('%Y-%m-%d')
    end_date_str = thursday.strftime('%Y-%m-%d')
    date_range_short = f"{friday.strftime('%m/%d')}-{thursday.strftime('%m/%d')}"

    # 统一格式：YYYY年MM月第X周(MM/DD-MM/DD)
    report_name_full = f'{year}年{month:02d}月第{report_month_week}周({date_range_short})'

    return {
        'report_year': year,
        'report_month': month,
        'report_week': report_week,
        'report_month_week': report_month_week,
        'start_date': start_date_str,
        'end_date': end_date_str,
        'report_name': report_name_full,  # 使用完整格式
        'date_range': date_range_short,
        'report_sequence': report_week
    }


def get_all_fridays_in_year(year: int) -> List[date]:
    """
    获取指定年份的所有周五日期

    Args:
        year: 年份

    Returns:
        周五日期列表
    """
    fridays = []
    jan_1 = date(year, 1, 1)

    # 找到第一个周五
    weekday_jan1 = jan_1.weekday()
    if weekday_jan1 <= 4:
        days_to_first_friday = 4 - weekday_jan1
    else:
        days_to_first_friday = 4 + (7 - weekday_jan1)

    current_friday = jan_1 + timedelta(days=days_to_first_friday)

    # 添加该年的所有周五
    while current_friday.year == year:
        fridays.append(current_friday)
        current_friday += timedelta(days=7)

    return fridays


def generate_week_options(weeks_count: int = 12) -> List[Dict]:
    """
    生成可选周次列表

    生成过去N周的选项，确保包含完整的周次

    Args:
        weeks_count: 生成多少周的选项（默认12周）

    Returns:
        周次选项列表
    """
    options = []
    today = date.today()
    current_year = today.year

    # 获取今年和去年的所有周五
    fridays_this_year = get_all_fridays_in_year(current_year)
    fridays_last_year = get_all_fridays_in_year(current_year - 1)

    all_fridays = fridays_last_year + fridays_this_year

    # 找到当前周五在列表中的位置
    current_friday_index = -1
    for i, friday in enumerate(all_fridays):
        # 如果这个周五包含今天
        thursday = friday + timedelta(days=6)
        if friday <= today <= thursday:
            current_friday_index = i
            break

    # 如果今天还没到任何周五的周期，使用今天之前的最后一个周五
    if current_friday_index == -1:
        # 找到今天之前的最后一个周五
        for i in range(len(all_fridays) - 1, -1, -1):
            if all_fridays[i] < today:
                current_friday_index = i
                break

    # 确保至少有一个周五
    if current_friday_index == -1:
        current_friday_index = len(all_fridays) - 1

    # 从当前周五往前生成指定数量的周次（包含本周）
    # 生成 weeks_count 个周次，包括本周
    start_index = max(0, current_friday_index - weeks_count + 1)
    end_index = current_friday_index + 1  # +1 确保包含本周

    for i in range(start_index, end_index):
        if i >= len(all_fridays):
            break

        friday = all_fridays[i]
        week_info = get_week_info(friday)

        # 判断本周是否已结束（检查今天是否已经过了本周的周四）
        thursday = friday + timedelta(days=6)
        is_week_ended = today > thursday

        # 添加 disabled 和 disabled_reason 字段
        option = {
            'value': f"{week_info['report_year']}-{week_info['report_week']:02d}",
            'label': week_info['report_name'],
            'date_range': week_info['date_range'],
            'sequence': week_info['report_sequence'],
            'disabled': not is_week_ended,
            **week_info
        }

        # 如果本周未结束，添加禁用原因
        if not is_week_ended:
            option['disabled_reason'] = '本周报告（未结束，不可选）'

        options.append(option)

    # 按周次降序排列（最近的在前）
    options.reverse()

    return options


def format_date_cn(date_str: str, format_type: str = 'full') -> str:
    """
    格式化日期为中文显示
    """
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()

        if format_type == 'full':
            return d.strftime('%Y年%m月%d日')
        elif format_type == 'short':
            return d.strftime('%m/%d')
        elif format_type == 'month':
            month_names = ['一月', '二月', '三月', '四月', '五月', '六月',
                          '七月', '八月', '九月', '十月', '十一月', '十二月']
            return month_names[d.month - 1]
        else:
            return date_str
    except:
        return date_str


def validate_week_period(year: int, week: int) -> bool:
    """
    验证周次是否有效
    """
    if week < 1 or week > 53:
        return False

    try:
        # 尝试获取该年的周五列表
        fridays = get_all_fridays_in_year(year)
        if week - 1 < len(fridays):
            return True
        return False
    except:
        return False


# 测试代码
if __name__ == '__main__':
    print("=" * 60)
    print("周次计算工具测试 v2.0")
    print("=" * 60)

    # 测试1: 2026年1月的所有周
    print("\n=== 2026年1月的所有周 ===")
    fridays_2026 = get_all_fridays_in_year(2026)
    for i, friday in enumerate(fridays_2026, 1):
        week_info = get_week_info(friday)
        print(f"第{i:2d}周: {week_info['report_name']} ({week_info['date_range']})")

    # 测试2: 生成周次选项
    print(f"\n=== 最近12周周次选项 ===")
    options = generate_week_options(12)
    for i, opt in enumerate(options, 1):
        print(f"{i:2d}. {opt['label']} ({opt['date_range']})")

    print("\n" + "=" * 60)
