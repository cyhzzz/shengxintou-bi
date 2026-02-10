# -*- coding: utf-8 -*-
"""
周报生成问题诊断脚本

用于诊断周报生成失败的原因
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

# 导入应用
import sys
sys.path.insert(0, os.path.join(project_root, '开发代码'))

# 初始化Flask应用
import logging
logging.basicConfig(level=logging.INFO)

from 开发代码.app import app
from 开发代码.backend.database import db
from 开发代码.backend.models import DailyMetricsUnified, WeeklyReport


def test_database_connection():
    """测试数据库连接"""
    print("\n[1/5] 测试数据库连接...")
    try:
        with app.app_context():
            # 测试查询
            count = db.session.query(DailyMetricsUnified).count()
            print(f"  ✓ 数据库连接正常")
            print(f"  ✓ daily_metrics_unified 表记录数: {count:,}")
            return True
    except Exception as e:
        print(f"  ✗ 数据库连接失败: {e}")
        return False


def test_data_range():
    """测试数据日期范围"""
    print("\n[2/5] 检查数据日期范围...")
    try:
        with app.app_context():
            # 查询最小和最大日期
            result = db.session.query(
                db.func.min(DailyMetricsUnified.date),
                db.func.max(DailyMetricsUnified.date)
            ).first()

            if result and result[0]:
                print(f"  ✓ 数据日期范围: {result[0]} 至 {result[1]}")
            else:
                print(f"  ✗ 没有数据")

            return result
    except Exception as e:
        print(f"  ✗ 查询失败: {e}")
        return None


def test_weekly_report_table():
    """测试周报表是否存在"""
    print("\n[3/5] 检查周报表...")
    try:
        with app.app_context():
            # 检查表是否存在
            count = db.session.query(WeeklyReport).count()
            print(f"  ✓ weekly_reports 表记录数: {count}")

            # 查看最近的几条记录
            recent_reports = db.session.query(WeeklyReport).order_by(
                WeeklyReport.report_year.desc(),
                WeeklyReport.report_week.desc()
            ).limit(5).all()

            if recent_reports:
                print(f"  ✓ 最近的周报:")
                for report in recent_reports:
                    print(f"    - {report.report_name} ({report.report_id})")
            else:
                print(f"  ℹ 周报表为空（这是正常的，第一次生成时会有此情况）")

            return True
    except Exception as e:
        print(f"  ✗ 查询失败: {e}")
        return False


def test_aggregation():
    """测试数据聚合功能"""
    print("\n[4/5] 测试数据聚合...")
    try:
        with app.app_context():
            # 测试聚合查询（最近一周的数据）
            today = date.today()
            week_ago = today - timedelta(days=7)

            result = db.session.query(
                db.func.sum(DailyMetricsUnified.impressions).label('impressions'),
                db.func.sum(DailyMetricsUnified.click_users).label('click_users'),
                db.func.sum(DailyMetricsUnified.opened_account_users).label('new_accounts')
            ).filter(
                DailyMetricsUnified.date >= week_ago,
                DailyMetricsUnified.date <= today
            ).first()

            if result:
                print(f"  ✓ 最近7天数据聚合结果:")
                print(f"    - 广告展示量: {result.impressions or 0:,}")
                print(f"    - 广告点击人数: {result.click_users or 0:,}")
                print(f"    - 新开户数: {result.new_accounts or 0:,}")
            else:
                print(f"  ✗ 聚合查询返回空结果")

            return True
    except Exception as e:
        print(f"  ✗ 聚合失败: {e}")
        import traceback
        print(f"  错误堆栈:\n{traceback.format_exc()}")
        return False


def test_specific_week(report_year, report_week):
    """测试指定周次的数据"""
    print(f"\n[5/5] 测试指定周次 ({report_year}年第{report_week}周)...")
    try:
        from backend.utils.weekly_utils import get_all_fridays_in_year, get_week_info, validate_week_period

        # 验证周次
        if not validate_week_period(report_year, report_week):
            print(f"  ✗ 无效的周次: {report_year}年第{report_week}周")
            return False

        print(f"  ✓ 周次验证通过")

        # 获取周五日期
        fridays = get_all_fridays_in_year(report_year)
        if report_week - 1 >= len(fridays):
            print(f"  ✗ 周次超出范围: {report_year}年只有{len(fridays)}周")
            return False

        friday = fridays[report_week - 1]
        print(f"  ✓ 周五日期: {friday}")

        # 计算周信息
        week_info = get_week_info(friday)
        print(f"  ✓ 周信息:")
        print(f"    - 周期: {week_info['start_date']} 至 {week_info['end_date']}")
        print(f"    - 周名: {week_info['report_name']}")

        # 检查该周是否有数据
        start_date = datetime.strptime(week_info['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(week_info['end_date'], '%Y-%m-%d').date()

        result = db.session.query(
            db.func.count(DailyMetricsUnified.date).label('days')
        ).filter(
            DailyMetricsUnified.date >= start_date,
            DailyMetricsUnified.date <= end_date
        ).first()

        if result:
            print(f"  ✓ 该周数据天数: {result.days or 0} 天")
            if result.days == 0:
                print(f"  ⚠ 警告: 该周没有数据，聚合结果可能为空")
        else:
            print(f"  ✗ 查询失败")

        return True
    except Exception as e:
        print(f"  ✗ 测试失败: {e}")
        import traceback
        print(f"  错误堆栈:\n{traceback.format_exc()}")
        return False


if __name__ == '__main__':
    print("=" * 60)
    print("省心投 BI - 周报生成问题诊断")
    print("=" * 60)

    # 执行诊断
    if test_database_connection():
        data_range = test_data_range()
        test_weekly_report_table()
        test_aggregation()

        # 如果有命令行参数，测试指定周次
        if len(sys.argv) >= 3:
            report_year = int(sys.argv[1])
            report_week = int(sys.argv[2])
            test_specific_week(report_year, report_week)

    print("\n" + "=" * 60)
    print("诊断完成")
    print("=" * 60)
