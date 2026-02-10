# -*- coding: utf-8 -*-
"""
分析 daily_metrics_unified 表中 agency 为空的数据
生成账号代理商映射修复建议
"""

import sys
import os

# 添加项目根目录到 Python 路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from backend.database import db
from backend.models import (
    DailyMetricsUnified,
    RawAdDataTencent,
    RawAdDataDouyin,
    RawAdDataXiaohongshu,
    AccountAgencyMapping
)
import sqlalchemy as sa


def analyze_empty_agency_data():
    """分析agency为空的数据"""

    print("=" * 80)
    print("分析 daily_metrics_unified 表中 agency 为空的数据")
    print("=" * 80)

    # 1. 查询 agency 为空但 cost > 0 的数据
    empty_agency_data = db.session.query(
        DailyMetricsUnified.platform,
        DailyMetricsUnified.account_id,
        DailyMetricsUnified.account_name,
        sa.func.sum(DailyMetricsUnified.cost).label('total_cost'),
        sa.func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
        sa.func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
        sa.func.count(DailyMetricsUnified.id).label('record_count')
    ).filter(
        sa.or_(
            DailyMetricsUnified.agency == '',
            DailyMetricsUnified.agency.is_(None)
        ),
        DailyMetricsUnified.cost > 0
    ).group_by(
        DailyMetricsUnified.platform,
        DailyMetricsUnified.account_id,
        DailyMetricsUnified.account_name
    ).order_by(
        DailyMetricsUnified.platform,
        sa.desc('total_cost')
    ).all()

    print(f"\n找到 {len(empty_agency_data)} 个账号的 agency 为空但 cost > 0:\n")

    # 2. 按平台分类并生成修复建议
    suggestions = []

    for row in empty_agency_data:
        platform = row.platform
        account_id = row.account_id or ''
        account_name = row.account_name or ''
        total_cost = float(row.total_cost or 0)
        total_impressions = int(row.total_impressions or 0)
        total_click_users = int(row.total_click_users or 0)
        record_count = row.record_count

        print(f"Platform: {platform}")
        print(f"  Account ID: {account_id}")
        print(f"  Account Name: {account_name}")
        print(f"  Total Cost: {total_cost:,.2f} CNY")
        print(f"  Total Impressions: {total_impressions:,}")
        print(f"  Click Users: {total_click_users:,}")
        print(f"  Record Count: {record_count}")
        print()

        # 生成修复建议
        if platform == '小红书':
            # 小红书：检查是否是申万宏源直投
            if '申万' in account_name or '直投' in account_name:
                suggested_agency = '申万宏源直投'
                suggested_business_model = '信息流'
                suggestion_type = '小红书直投'
            else:
                # 需要用户提供代理商名称
                suggested_agency = '[需确认]'
                suggested_business_model = '[需确认]'
                suggestion_type = '小红书代理商'

        elif platform == '腾讯':
            # 腾讯：根据账号ID判断
            if not account_id:
                suggested_agency = '[需从广告后台获取账号ID]'
                suggested_business_model = '[需确认]'
                suggestion_type = '腾讯缺少账号ID'
            else:
                # 检查映射表中是否已存在
                existing = db.session.query(AccountAgencyMapping).filter_by(
                    platform=platform,
                    account_id=account_id
                ).first()

                if existing:
                    suggested_agency = existing.agency
                    suggested_business_model = existing.business_model or '[需确认]'
                    suggestion_type = '腾讯已有映射'
                else:
                    suggested_agency = '[需确认]'
                    suggested_business_model = '[需确认]'
                    suggestion_type = '腾讯需新增映射'

        elif platform == '抖音':
            # 抖音：根据账号ID判断
            if not account_id:
                suggested_agency = '[需从广告后台获取账号ID]'
                suggested_business_model = '[需确认]'
                suggestion_type = '抖音缺少账号ID'
            else:
                # 检查映射表中是否已存在
                existing = db.session.query(AccountAgencyMapping).filter_by(
                    platform=platform,
                    account_id=account_id
                ).first()

                if existing:
                    suggested_agency = existing.agency
                    suggested_business_model = existing.business_model or '[需确认]'
                    suggestion_type = '抖音已有映射'
                else:
                    suggested_agency = '[需确认]'
                    suggested_business_model = '[需确认]'
                    suggestion_type = '抖音需新增映射'
        else:
            suggested_agency = '[需确认]'
            suggested_business_model = '[需确认]'
            suggestion_type = '其他平台'

        suggestions.append({
            'platform': platform,
            'account_id': account_id,
            'account_name': account_name,
            'suggested_agency': suggested_agency,
            'suggested_business_model': suggested_business_model,
            'suggestion_type': suggestion_type,
            'total_cost': total_cost,
            'record_count': record_count
        })

    print("\n" + "=" * 80)
    print("Suggested Account Agency Mapping Fix SQL:")
    print("=" * 80)
    print("\nPlease manually confirm the following mappings before executing:\n")

    for s in suggestions:
        if '[需确认]' in s['suggested_agency'] or '[需从广告后台获取账号ID]' in s['suggested_agency']:
            print(f"-- Need manual confirmation: {s['platform']} - {s['account_name']}")
            print(f"-- Account ID: {s['account_id']}")
            print(f"-- Cost: {s['total_cost']:,.2f} CNY, Records: {s['record_count']}")
            print(f"-- Please fill in the correct agency and business model:")
            print(f"-- INSERT INTO account_agency_mapping (platform, account_id, account_name, agency, business_model)")
            print(f"-- VALUES ('{s['platform']}', '{s['account_id']}', '{s['account_name']}', '[TO_FILL]', '[TO_FILL]');")
            print()
        else:
            # Auto-generated suggestion
            print(f"-- {s['suggestion_type']}: {s['platform']} - {s['account_name']}")

            # Small red book direct investment using main_account_id
            if s['platform'] == '小红书' and s['suggested_agency'] == '申万宏源直投':
                # Small red book direct investment: account_id is NULL, use main_account_id
                print(f"-- INSERT INTO account_agency_mapping (platform, account_id, account_name, main_account_id, agency, business_model)")
                print(f"-- VALUES ('{s['platform']}', NULL, '{s['account_name']}', '{s['account_id']}', '{s['suggested_agency']}', '{s['suggested_business_model']}');")
            else:
                print(f"-- INSERT INTO account_agency_mapping (platform, account_id, account_name, agency, business_model)")
                print(f"-- VALUES ('{s['platform']}', '{s['account_id']}', '{s['account_name']}', '{s['suggested_agency']}', '{s['suggested_business_model']}');")
            print()

    # 4. Summary statistics
    print("\n" + "=" * 80)
    print("Summary Statistics:")
    print("=" * 80)

    by_platform = {}
    for s in suggestions:
        platform = s['platform']
        if platform not in by_platform:
            by_platform[platform] = {
                'count': 0,
                'total_cost': 0
            }
        by_platform[platform]['count'] += 1
        by_platform[platform]['total_cost'] += s['total_cost']

    for platform, stats in sorted(by_platform.items()):
        print(f"{platform}: {stats['count']} accounts, Total Cost: {stats['total_cost']:,.2f} CNY")

    print(f"\nTotal: {len(suggestions)} accounts need agency mapping fix")
    print("\nNote: After fixing mappings, re-run aggregation script:")
    print("  python backend/scripts/aggregations/update_daily_metrics_unified.py 2024-01-01 $(date +%Y-%m-%d)")

    return suggestions


if __name__ == '__main__':
    from app import app
    with app.app_context():
        analyze_empty_agency_data()
