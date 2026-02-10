# -*- coding: utf-8 -*-
"""
快速修复 daily_metrics_unified 表中 agency 为空的数据
直接添加缺失的映射关系并UPDATE聚合表
"""

import sys
import os

# 添加项目根目录到 Python 路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from backend.models import AccountAgencyMapping, DailyMetricsUnified


def fix_empty_agency():
    """快速修复agency为空的数据"""

    with app.app_context():
        print("=" * 80)
        print("快速修复 agency 为空的数据")
        print("=" * 80)

        # 1. 为抖音和腾讯账号创建映射（待确认）
        print("\n1. 为抖音和腾讯账号创建映射记录:\n")

        mappings_to_create = [
            # 腾讯
            {
                'platform': '腾讯',
                'account_id': '66250750',
                'account_name': '腾讯账号66250750',
                'agency': '[待确认]',
                'business_model': '[待确认]',
                'note': 'cost: 36,566 CNY'
            },
            # 抖音
            {
                'platform': '抖音',
                'account_id': '1839853210818695',
                'account_name': '抖音账号1839853210818695',
                'agency': '[待确认]',
                'business_model': '[待确认]',
                'note': 'cost: 137,020 CNY'
            },
            {
                'platform': '抖音',
                'account_id': '1850545311207424',
                'account_name': '抖音账号1850545311207424',
                'agency': '[待确认]',
                'business_model': '[待确认]',
                'note': 'cost: 42,684 CNY'
            },
            {
                'platform': '抖音',
                'account_id': '1850545312034892',
                'account_name': '抖音账号1850545312034892',
                'agency': '[待确认]',
                'business_model': '[待确认]',
                'note': 'cost: 37,376 CNY'
            },
            {
                'platform': '抖音',
                'account_id': '1850545310225548',
                'account_name': '抖音账号1850545310225548',
                'agency': '[待确认]',
                'business_model': '[待确认]',
                'note': 'cost: 20,982 CNY'
            }
        ]

        for m in mappings_to_create:
            # 检查是否已存在
            existing = db.session.query(AccountAgencyMapping).filter_by(
                platform=m['platform'],
                account_id=m['account_id']
            ).first()

            if not existing:
                mapping = AccountAgencyMapping(
                    platform=m['platform'],
                    account_id=m['account_id'],
                    account_name=m['account_name'],
                    agency=m['agency'],
                    business_model=m['business_model']
                )
                db.session.add(mapping)
                print(f"  创建映射: {m['platform']} - {m['account_id']} ({m['note']})")
            else:
                print(f"  已存在映射: {m['platform']} - {m['account_id']}")

        db.session.commit()
        print("\n  [OK] 映射记录创建完成")

        # 2. 小红书：直接UPDATE聚合表中agency为空的记录
        print("\n2. 修复小红书直投数据的agency字段:\n")

        # 小红书账号66b0686c000000001d020d1f的申万直投映射
        update_result = db.session.query(DailyMetricsUnified).filter(
            DailyMetricsUnified.platform == '小红书',
            DailyMetricsUnified.account_id == '66b0686c000000001d020d1f',
            db.or_(
                DailyMetricsUnified.agency == '',
                DailyMetricsUnified.agency.is_(None)
            )
        ).update({
            'agency': '申万',
            'business_model': '信息流'
        }, synchronize_session=False)

        print(f"  更新了 {update_result} 条小红书直投记录")

        # 3. 提交更改
        db.session.commit()
        print("\n  [OK] 小红书agency修复完成")

        # 4. 验证修复结果
        print("\n" + "=" * 80)
        print("验证修复结果:")
        print("=" * 80)

        empty_agency_data = db.session.query(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.account_id,
            db.func.sum(DailyMetricsUnified.cost).label('total_cost'),
            db.func.count(DailyMetricsUnified.id).label('record_count')
        ).filter(
            db.or_(
                DailyMetricsUnified.agency == '',
                DailyMetricsUnified.agency.is_(None)
            ),
            DailyMetricsUnified.cost > 0
        ).group_by(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.account_id
        ).order_by(
            db.desc('total_cost')
        ).all()

        print(f"\n剩余 {len(empty_agency_data)} 个账号的 agency 为空（抖音和腾讯，待用户确认）:\n")

        for row in empty_agency_data:
            print(f"Platform: {row.platform}")
            print(f"  Account ID: {row.account_id}")
            print(f"  Total Cost: {row.total_cost:,.2f} CNY, Records: {row.record_count}")
            print()

        print("\n注意：")
        print("1. 小红书数据已修复（agency='申万'）")
        print("2. 抖音和腾讯账号已添加到映射表，agency='[待确认]'")
        print("3. 请在账号管理页面为这些账号补充正确的代理商和业务模式")
        print("4. 补充完成后，重新运行聚合脚本:")
        print("   python backend/scripts/aggregations/update_daily_metrics_unified.py 2024-01-01 $(date +%Y-%m-%d)")


if __name__ == '__main__':
    fix_empty_agency()
