# -*- coding: utf-8 -*-
"""
v2.1 周报数据聚合脚本（走新表 agg_vendor_daily）

字段映射（旧表 daily_metrics_unified → 新表 agg_vendor_daily）：
  date                    → 日期
  impressions             → 展示量
  clicks                  → 点击量
  opened_account_users    → 开户人数

其他字段（content / live / enterprise_wechat / subscription）原版就为 0，
保留以兼容 weekly_reports.py 端点契约。
"""
import sys
import os
from datetime import datetime, date

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, project_root)
os.chdir(project_root)

from app import app
from backend.database import db
from backend.models import WeeklyReport
from backend.models_v2 import AggVendorDaily


def aggregate_weekly_data(start_date, end_date):
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    from flask import current_app
    try:
        current_app.name
        in_context = True
    except (RuntimeError, AttributeError):
        in_context = False

    if not in_context:
        with app.app_context():
            return _do_aggregate(start_date, end_date)
    return _do_aggregate(start_date, end_date)


def _do_aggregate(start_date, end_date):
    print(f"\n[v2.1 聚合] {start_date} 至 {end_date}")

    # ===== 1. 当期：日期维度聚合（agg_vendor_daily）=====
    ad_data = db.session.query(
        AggVendorDaily.日期.label("d"),
        db.func.sum(AggVendorDaily.展示量).label("impressions"),
        db.func.sum(AggVendorDaily.点击量).label("clicks"),
        db.func.sum(AggVendorDaily.开户人数).label("new_accounts"),
    ).filter(
        AggVendorDaily.日期 >= start_date.isoformat(),
        AggVendorDaily.日期 <= end_date.isoformat(),
    ).group_by(AggVendorDaily.日期).all()

    total_impressions = sum(r.impressions or 0 for r in ad_data)
    total_clicks = sum(r.clicks or 0 for r in ad_data)
    total_new_accounts = sum(r.new_accounts or 0 for r in ad_data)

    print(f"  展示量: {total_impressions:,}")
    print(f"  点击量: {total_clicks:,}")
    print(f"  开户数: {total_new_accounts:,}")

    # ===== 2. 累计：年初到 end_date =====
    if start_date.year == end_date.year:
        year_start = date(end_date.year, 1, 1)
        year_end_cumulative = end_date
    else:
        year_start = date(start_date.year, 1, 1)
        year_end_cumulative = date(start_date.year, 12, 31)

    cumulative = db.session.query(
        db.func.sum(AggVendorDaily.展示量).label("impressions"),
        db.func.sum(AggVendorDaily.点击量).label("clicks"),
        db.func.sum(AggVendorDaily.开户人数).label("new_accounts"),
    ).filter(
        AggVendorDaily.日期 >= year_start.isoformat(),
        AggVendorDaily.日期 <= year_end_cumulative.isoformat(),
    ).first()

    cumulative_impressions = cumulative.impressions or 0
    cumulative_clicks = cumulative.clicks or 0
    cumulative_new_accounts = cumulative.new_accounts or 0

    print(f"  累计范围: {year_start} ~ {year_end_cumulative}")
    print(f"  累计展示量: {cumulative_impressions:,}")
    print(f"  累计点击量: {cumulative_clicks:,}")
    print(f"  累计开户: {cumulative_new_accounts:,}")

    return {
        "ad_impressions": total_impressions,
        "ad_impressions_cumulative": cumulative_impressions,
        "ad_clicks": total_clicks,
        "ad_clicks_cumulative": cumulative_clicks,
        "new_accounts": total_new_accounts,
        "new_accounts_cumulative": cumulative_new_accounts,
        "content_count": 0,
        "content_count_cumulative": 0,
        "content_views": 0,
        "content_views_cumulative": 0,
        "live_sessions": 0,
        "live_sessions_cumulative": 0,
        "live_viewers": 0,
        "live_viewers_cumulative": 0,
        "enterprise_wechat_add": 0,
        "enterprise_wechat_add_cumulative": 0,
        "subscription_count": 0,
        "subscription_count_cumulative": 0,
        "branch_new_accounts": 0,
        "branch_new_accounts_cumulative": 0,
    }


def copy_previous_key_works(report_year, report_week):
    from flask import current_app
    try:
        current_app.name
        in_context = True
    except (RuntimeError, AttributeError):
        in_context = False
    if not in_context:
        with app.app_context():
            return _do_copy_previous_key_works(report_year, report_week)
    return _do_copy_previous_key_works(report_year, report_week)


def _do_copy_previous_key_works(report_year, report_week):
    current_report = db.session.query(WeeklyReport).filter_by(
        report_year=report_year, report_week=report_week,
    ).first()
    if not current_report or not current_report.start_date:
        return _get_default_key_works()
    previous_report = db.session.query(WeeklyReport).filter(
        WeeklyReport.end_date < current_report.start_date
    ).order_by(WeeklyReport.end_date.desc()).first()
    if previous_report and previous_report.key_works:
        import json
        try:
            key_works = json.loads(previous_report.key_works)
            if key_works:
                return key_works
        except Exception as e:
            print(f"解析上一周重点工作失败: {e}")
    return _get_default_key_works()


def _get_default_key_works():
    return [
        {"work_num": "01", "work_category": "渠道拓展",
         "work_description": "预沟通2026年度广告投放代理招标采购，财经媒体直播供应商征集完成，应用商城优化方案已提交。"},
        {"work_num": "02", "work_category": "投放管理",
         "work_description": "代理公司探索阶段顺利完成，进入精细化运营阶段，启动投放额度与策略机制优化。"},
        {"work_num": "03", "work_category": "直播优化",
         "work_description": "启动研究所直播话术培训，优化投顾后端策略产品运营方案，直播制度修订稿进入OA核稿阶段。"},
        {"work_num": "04", "work_category": "金融科技",
         "work_description": "小红书运营报表持续开发，应用市场归因功能开发联调中，腾讯元宝落地页面完成测试验收。"},
        {"work_num": "05", "work_category": "业务赋能",
         "work_description": "分支机构认证账号审批通过，抖音小红书号陆续开通，拟协调研究所分析师开展赋能培训。"},
    ]


if __name__ == "__main__":
    print("=" * 60)
    print("v2.1 周报数据聚合测试")
    print("=" * 60)
    data = aggregate_weekly_data("2026-01-24", "2026-01-30")
    print("\n聚合结果:")
    for key, value in data.items():
        print(f"  {key}: {value}")