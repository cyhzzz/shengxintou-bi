# -*- coding: utf-8 -*-
"""
周报数据聚合脚本

功能：
1. 聚合指定日期区间的广告投放数据（从 daily_metrics_unified）
2. 计算累计数据
3. 填充到周报表中
"""

import sys
import os
from datetime import datetime, timedelta, date

# 设置标准输出为UTF-8编码（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)
os.chdir(project_root)

from app import app
from backend.database import db
from backend.models import WeeklyReport, DailyMetricsUnified


def aggregate_weekly_data(start_date, end_date):
    """
    聚合周报数据

    Args:
        start_date: 开始日期 (str: YYYY-MM-DD 或 date对象)
        end_date: 结束日期 (str: YYYY-MM-DD 或 date对象)

    Returns:
        dict: 聚合后的数据
    """
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

    # 检查是否已经在 app_context 中
    from flask import current_app
    try:
        current_app.name
        in_context = True
    except (RuntimeError, AttributeError):
        in_context = False

    if not in_context:
        # 如果不在 app_context 中，创建一个
        with app.app_context():
            return _do_aggregate(start_date, end_date)
    else:
        # 已经在 app_context 中，直接执行
        return _do_aggregate(start_date, end_date)


def _do_aggregate(start_date, end_date):
    """实际执行聚合的内部函数"""
    # ===== 1. 聚合广告投放数据 =====
    print(f"\n聚合数据: {start_date} 至 {end_date}")

    ad_data = db.session.query(
        DailyMetricsUnified.date,
        db.func.sum(DailyMetricsUnified.impressions).label('impressions'),
        db.func.sum(DailyMetricsUnified.click_users).label('click_users')
    ).filter(
        DailyMetricsUnified.date >= start_date,
        DailyMetricsUnified.date <= end_date
    ).group_by(
        DailyMetricsUnified.date
    ).all()

    # 汇总投放数据
    total_impressions = sum(row.impressions or 0 for row in ad_data)
    total_click_users = sum(row.click_users or 0 for row in ad_data)

    print(f"  广告展示量: {total_impressions:,}")
    print(f"  广告点击人数: {total_click_users:,}")

    # ===== 2. 聚合转化数据 =====
    conversion_data = db.session.query(
        DailyMetricsUnified.date,
        db.func.sum(DailyMetricsUnified.opened_account_users).label('new_accounts')
    ).filter(
        DailyMetricsUnified.date >= start_date,
        DailyMetricsUnified.date <= end_date
    ).group_by(
        DailyMetricsUnified.date
    ).all()

    total_new_accounts = sum(row.new_accounts or 0 for row in conversion_data)
    print(f"  新开户数: {total_new_accounts:,}")

    # ===== 3. 计算当年累计数据（从年初到报告期结束）=====
    # 跨年处理：累计数据只计算到当年最后一天
    if start_date.year == end_date.year:
        # 不跨年：年初到报告期结束
        year_start = date(end_date.year, 1, 1)
        year_end_cumulative = end_date
        report_year = end_date.year
    else:
        # 跨年：使用报告期开始年份的年初到年末
        year_start = date(start_date.year, 1, 1)
        year_end_cumulative = date(start_date.year, 12, 31)
        report_year = start_date.year

    print(f"  累计数据范围: {year_start} 至 {year_end_cumulative} (年份: {report_year})")

    # 查询年初到累计结束日期的所有数据
    cumulative_data = db.session.query(
        db.func.sum(DailyMetricsUnified.impressions).label('impressions'),
        db.func.sum(DailyMetricsUnified.click_users).label('click_users'),
        db.func.sum(DailyMetricsUnified.opened_account_users).label('new_accounts')
    ).filter(
        DailyMetricsUnified.date >= year_start,
        DailyMetricsUnified.date <= year_end_cumulative
    ).first()

    cumulative_impressions = cumulative_data.impressions or 0
    cumulative_click_users = cumulative_data.click_users or 0
    cumulative_new_accounts = cumulative_data.new_accounts or 0

    print(f"\n  当年累计展示量: {cumulative_impressions:,}")
    print(f"  当年累计点击人数: {cumulative_click_users:,}")
    print(f"  当年累计新开户: {cumulative_new_accounts:,}")

    # ===== 4. 返回聚合数据 =====
    return {
        'ad_impressions': total_impressions,
        'ad_impressions_cumulative': cumulative_impressions,
        'ad_clicks': total_click_users,
        'ad_clicks_cumulative': cumulative_click_users,
        'new_accounts': total_new_accounts,
        'new_accounts_cumulative': cumulative_new_accounts,

        # 其他字段暂时设为0（无法从 daily_metrics_unified 获取）
        'content_count': 0,
        'content_count_cumulative': 0,
        'content_views': 0,
        'content_views_cumulative': 0,
        'live_sessions': 0,
        'live_sessions_cumulative': 0,
        'live_viewers': 0,
        'live_viewers_cumulative': 0,
        'enterprise_wechat_add': 0,
        'enterprise_wechat_add_cumulative': 0,
        'subscription_count': 0,
        'subscription_count_cumulative': 0,
        'branch_new_accounts': 0,
        'branch_new_accounts_cumulative': 0,
    }


def copy_previous_key_works(report_year, report_week):
    """
    复制上一周的 key_works 作为默认值

    Args:
        report_year: 报告年份
        report_week: 报告周次

    Returns:
        list: 复制的 key_works 数组
    """
    # 检查是否已经在 app_context 中
    from flask import current_app
    try:
        current_app.name
        in_context = True
    except (RuntimeError, AttributeError):
        in_context = False

    if not in_context:
        # 如果不在 app_context 中，创建一个
        with app.app_context():
            return _do_copy_previous_key_works(report_year, report_week)
    else:
        # 已经在 app_context 中，直接执行
        return _do_copy_previous_key_works(report_year, report_week)


def _do_copy_previous_key_works(report_year, report_week):
    """实际执行复制上一周 key_works 的内部函数"""
    # 获取当前周的报告
    current_report = db.session.query(WeeklyReport).filter_by(
        report_year=report_year,
        report_week=report_week
    ).first()

    if not current_report or not current_report.start_date:
        print(f"\n当前周不存在，使用默认重点工作模板")
        return _get_default_key_works()

    # 查找结束日期早于当前周的所有报告，按结束日期降序排序
    previous_report = db.session.query(WeeklyReport).filter(
        WeeklyReport.end_date < current_report.start_date
    ).order_by(
        WeeklyReport.end_date.desc()
    ).first()

    if previous_report and previous_report.key_works:
        import json
        try:
            key_works = json.loads(previous_report.key_works)
            # 过滤掉空数组
            if key_works and len(key_works) > 0:
                print(f"\n复制上一周 ({previous_report.report_name}) 的重点工作: {len(key_works)} 条")
                return key_works
        except Exception as e:
            print(f"\n解析上一周重点工作失败: {e}")

    # 如果没有上一周或上一周没有内容，返回默认值
    print(f"\n使用默认重点工作模板")
    return _get_default_key_works()


def _get_default_key_works():
    """获取默认重点工作列表"""
    return [
        {
            'work_num': '01',
            'work_category': '渠道拓展',
            'work_description': '预沟通2026年度广告投放代理招标采购，财经媒体直播供应商征集完成，应用商城优化方案已提交。'
        },
        {
            'work_num': '02',
            'work_category': '投放管理',
            'work_description': '代理公司探索阶段顺利完成，进入精细化运营阶段，启动投放额度与策略机制优化。'
        },
        {
            'work_num': '03',
            'work_category': '直播优化',
            'work_description': '启动研究所直播话术培训，优化投顾后端策略产品运营方案，直播制度修订稿进入OA核稿阶段。'
        },
        {
            'work_num': '04',
            'work_category': '金融科技',
            'work_description': '小红书运营报表持续开发，应用市场归因功能开发联调中，腾讯元宝落地页面完成测试验收。'
        },
        {
            'work_num': '05',
            'work_category': '业务赋能',
            'work_description': '分支机构认证账号审批通过，抖音小红书号陆续开通，拟协调研究所分析师开展赋能培训。'
        }
    ]


if __name__ == '__main__':
    # 测试聚合功能
    print("=" * 60)
    print("测试周报数据聚合")
    print("=" * 60)

    # 测试2026年1月第4周的数据聚合
    data = aggregate_weekly_data('2026-01-24', '2026-01-30')
    print("\n聚合结果:")
    for key, value in data.items():
        print(f"  {key}: {value}")
