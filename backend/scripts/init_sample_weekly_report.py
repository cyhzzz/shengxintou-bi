# -*- coding: utf-8 -*-
"""
初始化示例周报数据

为2026年1月第4周（1月23日-1月29日）创建示例周报数据
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app
from backend.database import db
from backend.models import WeeklyReport
from backend.templates.weekly_report_template import generate_weekly_report_html
from datetime import date


def init_sample_report():
    """初始化示例周报"""
    with app.app_context():
        # 检查是否已存在该周的报告
        existing = db.session.query(WeeklyReport).filter_by(
            report_year=2026,
            report_week=4
        ).first()

        if existing:
            print(f"[INFO] 2026年第4周周报已存在，ID={existing.id}")
            return existing

        # 创建示例周报数据
        sample_data = {
            'week_info': {
                'report_year': 2026,
                'report_month': 1,
                'report_week': 4,
                'report_month_week': 4,
                'start_date': '2026-01-23',
                'end_date': '2026-01-29',
                'report_name': '2026年1月第4周',
                'date_range': '01/23-01/29',
                'report_sequence': 4
            },
            'traffic': {
                'content_count': 61,
                'content_count_cumulative': 125,
                'content_views': 21300,
                'content_views_cumulative': 130200,
                'live_sessions': 22,
                'live_sessions_cumulative': 68,
                'live_viewers': 89300,
                'live_viewers_cumulative': 306100
            },
            'ad': {
                'impressions': 305000,
                'impressions_cumulative': 1524000,
                'clicks': 61000,
                'clicks_cumulative': 235800
            },
            'conversion': {
                'new_accounts': 191,
                'new_accounts_cumulative': 760,
                'enterprise_wechat_add': 1207,
                'enterprise_wechat_add_cumulative': 4786,
                'subscription_count': 5,
                'subscription_count_cumulative': 41,
                'branch_new_accounts': 16,
                'branch_new_accounts_cumulative': 42
            },
            'key_works': [
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
        }

        # 生成HTML内容
        report_html = generate_weekly_report_html(sample_data)

        # 创建数据库记录
        new_report = WeeklyReport(
            report_year=2026,
            report_week=4,
            report_month=1,
            report_month_week=4,
            start_date=date(2026, 1, 23),
            end_date=date(2026, 1, 29),
            report_name='2026年1月第4周',
            report_sequence=4,

            # 流量入口数据
            content_count=61,
            content_count_cumulative=125,
            content_views=21300,
            content_views_cumulative=130200,
            live_sessions=22,
            live_sessions_cumulative=68,
            live_viewers=89300,
            live_viewers_cumulative=306100,

            # 广告投放数据
            ad_impressions=305000,
            ad_impressions_cumulative=1524000,
            ad_clicks=61000,
            ad_clicks_cumulative=235800,

            # 转化数据
            new_accounts=191,
            new_accounts_cumulative=760,
            enterprise_wechat_add=1207,
            enterprise_wechat_add_cumulative=4786,
            subscription_count=5,
            subscription_count_cumulative=41,
            branch_new_accounts=16,
            branch_new_accounts_cumulative=42,

            # 重点工作（JSON格式）
            key_works='''[{"work_num":"01","work_category":"渠道拓展","work_description":"预沟通2026年度广告投放代理招标采购，财经媒体直播供应商征集完成，应用商城优化方案已提交。"},
            {"work_num":"02","work_category":"投放管理","work_description":"代理公司探索阶段顺利完成，进入精细化运营阶段，启动投放额度与策略机制优化。"},
            {"work_num":"03","work_category":"直播优化","work_description":"启动研究所直播话术培训，优化投顾后端策略产品运营方案，直播制度修订稿进入OA核稿阶段。"},
            {"work_num":"04","work_category":"金融科技","work_description":"小红书运营报表持续开发，应用市场归因功能开发联调中，腾讯元宝落地页面完成测试验收。"},
            {"work_num":"05","work_category":"业务赋能","work_description":"分支机构认证账号审批通过，抖音小红书号陆续开通，拟协调研究所分析师开展赋能培训。"}]''',

            # 报告内容
            report_html=report_html,
            status='draft'
        )

        db.session.add(new_report)
        db.session.commit()

        print(f"[OK] 示例周报创建成功！")
        print(f"     报告期: 2026年1月第4周 (01/23-01/29)")
        print(f"     报告ID: {new_report.id}")
        print(f"     状态: {new_report.status}")

        return new_report


if __name__ == '__main__':
    print("=" * 60)
    print("初始化示例周报数据")
    print("=" * 60)
    print()

    report = init_sample_report()

    print()
    print("=" * 60)
    print("[OK] 初始化完成")
    print("=" * 60)
