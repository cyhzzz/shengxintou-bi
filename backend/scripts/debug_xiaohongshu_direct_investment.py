# -*- coding: utf-8 -*-
"""
排查小红书广告数据中代理商账号被误判为申万直投的问题

问题：
- 小红书原始表中申万宏源直投数据最晚是8月23日
- 但前端报表显示2026年1月5日仍然有小红书-申万直投的消耗
- 怀疑某些代理商账号（绩牛或量子）被误认为是直投
"""

import sys
import os

# 添加项目根目录到 Python 路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from backend.models import (
    RawAdDataXiaohongshu,
    AccountAgencyMapping,
    DailyMetricsUnified
)
from sqlalchemy import func, and_
from datetime import datetime


def check_xiaohongshu_direct_investment():
    """检查小红书直投数据的分布情况"""

    with app.app_context():
        print("=" * 80)
        print("排查小红书代理商账号被误判为直投的问题")
        print("=" * 80)

        # ===== 1. 查看小红书原始数据中的账号分布 =====
        print("\n1. 小红书原始数据 - 账号分布:\n")

        # 按广告主账户ID和子账户ID分组
        account_distribution = db.session.query(
            RawAdDataXiaohongshu.advertiser_account_id,
            RawAdDataXiaohongshu.sub_account_id,
            func.count(RawAdDataXiaohongshu.id).label('record_count'),
            func.min(RawAdDataXiaohongshu.date).label('min_date'),
            func.max(RawAdDataXiaohongshu.date).label('max_date'),
            func.sum(RawAdDataXiaohongshu.cost).label('total_cost')
        ).group_by(
            RawAdDataXiaohongshu.advertiser_account_id,
            RawAdDataXiaohongshu.sub_account_id
        ).order_by(
            RawAdDataXiaohongshu.advertiser_account_id,
            RawAdDataXiaohongshu.sub_account_id
        ).all()

        print(f"   找到 {len(account_distribution)} 个账号组合:\n")

        for idx, row in enumerate(account_distribution, 1):
            main_id = row.advertiser_account_id or 'NULL'
            sub_id = row.sub_account_id or 'NULL'
            is_direct = (row.sub_account_id is None)

            print(f"   [{idx}] 主账户ID: {main_id}, 子账户ID: {sub_id}")
            print(f"       类型: {'[疑似直投]' if is_direct else '[代理商投放]'}")
            print(f"       记录数: {row.record_count}, 花费: {float(row.total_cost or 0):,.2f} 元")
            print(f"       日期范围: {row.min_date} 到 {row.max_date}")
            print()

        # ===== 2. 查看账号代理商映射表中的小红书账号 =====
        print("\n2. 账号代理商映射表 - 小红书账号:\n")

        mappings = db.session.query(
            AccountAgencyMapping
        ).filter(
            AccountAgencyMapping.platform == '小红书'
        ).order_by(
            AccountAgencyMapping.account_id,
            AccountAgencyMapping.main_account_id
        ).all()

        print(f"   找到 {len(mappings)} 条映射记录:\n")

        for idx, m in enumerate(mappings, 1):
            acc_id = m.account_id or 'NULL'
            main_id = m.main_account_id or 'NULL'
            acc_name = m.account_name or '未命名'

            print(f"   [{idx}] account_id: {acc_id}, main_account_id: {main_id}")
            print(f"       账号名称: {acc_name}")
            print(f"       代理商: {m.agency}, 业务模式: {m.business_model or '未设置'}")

            # 判断映射类型
            if m.account_id is None and m.main_account_id:
                print(f"       类型: [直投映射] account_id为空, 使用main_account_id")
            elif m.account_id and m.main_account_id:
                print(f"       类型: [代理商映射] 两个字段都有值")
            else:
                print(f"       类型: [其他映射]")
            print()

        # ===== 3. 检查小红书数据中sub_account_id为NULL的情况 =====
        print("\n3. 小红书原始数据 - sub_account_id为NULL的记录:\n")

        null_sub_account_data = db.session.query(
            RawAdDataXiaohongshu.advertiser_account_id,
            func.count(RawAdDataXiaohongshu.id).label('record_count'),
            func.sum(RawAdDataXiaohongshu.cost).label('total_cost'),
            func.min(RawAdDataXiaohongshu.date).label('min_date'),
            func.max(RawAdDataXiaohongshu.date).label('max_date')
        ).filter(
            RawAdDataXiaohongshu.sub_account_id == None
        ).group_by(
            RawAdDataXiaohongshu.advertiser_account_id
        ).all()

        print(f"   找到 {len(null_sub_account_data)} 个sub_account_id为NULL的账号:\n")

        for idx, row in enumerate(null_sub_account_data, 1):
            print(f"   [{idx}] advertiser_account_id: {row.advertiser_account_id}")
            print(f"       记录数: {row.record_count}, 花费: {float(row.total_cost or 0):,.2f} 元")
            print(f"       日期范围: {row.min_date} 到 {row.max_date}")

            # 检查映射表中是否有这个主账户的映射
            mapping = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == '小红书',
                AccountAgencyMapping.main_account_id == row.advertiser_account_id
            ).first()

            if mapping:
                print(f"       映射表: 找到映射 (main_account_id匹配)")
                print(f"       映射结果: agency={mapping.agency}, business_model={mapping.business_model}")
            else:
                print(f"       映射表: [未找到映射] 可能导致聚合时agency为空")
            print()

        # ===== 4. 检查聚合表中被标记为"申万"的小红书数据 =====
        print("\n4. 聚合表 - 小红书标记为'申万'的数据:\n")

        shenwan_data = db.session.query(
            DailyMetricsUnified.date,
            DailyMetricsUnified.platform,
            DailyMetricsUnified.agency,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.cost,
            DailyMetricsUnified.impressions,
            DailyMetricsUnified.click_users,
            DailyMetricsUnified.lead_users
        ).filter(
            DailyMetricsUnified.platform == '小红书',
            DailyMetricsUnified.agency.like('%申万%'),
            DailyMetricsUnified.cost > 0
        ).order_by(
            DailyMetricsUnified.date.desc()
        ).limit(20).all()

        print(f"   找到 {len(shenwan_data)} 条记录 (最近20条):\n")

        for idx, row in enumerate(shenwan_data, 1):
            print(f"   [{idx}] 日期: {row.date}")
            print(f"       平台: {row.platform}, 代理商: {row.agency}, 业务模式: {row.business_model}")
            print(f"       花费: {float(row.cost or 0):,.2f}, 曝光: {int(row.impressions or 0):,}")
            print(f"       点击: {int(row.click_users or 0)}, 线索: {int(row.lead_users or 0)}")
            print()

        # ===== 5. 关键检查：哪些advertiser_account_id既有sub_account_id为NULL又有不为NULL的数据 =====
        print("\n5. 检查是否存在同一advertiser_account_id既有直投又有代理商投放的情况:\n")

        # 找出所有advertiser_account_id
        all_main_accounts = db.session.query(
            RawAdDataXiaohongshu.advertiser_account_id
        ).distinct().all()

        mixed_accounts = []
        for (main_acc,) in all_main_accounts:
            # 检查这个主账户是否同时有NULL和非NULL的sub_account_id
            has_null = db.session.query(RawAdDataXiaohongshu).filter(
                RawAdDataXiaohongshu.advertiser_account_id == main_acc,
                RawAdDataXiaohongshu.sub_account_id == None
            ).first() is not None

            has_value = db.session.query(RawAdDataXiaohongshu).filter(
                RawAdDataXiaohongshu.advertiser_account_id == main_acc,
                RawAdDataXiaohongshu.sub_account_id != None
            ).first() is not None

            if has_null and has_value:
                mixed_accounts.append(main_acc)

        if mixed_accounts:
            print(f"   发现 {len(mixed_accounts)} 个混合账户:\n")

            for idx, main_acc in enumerate(mixed_accounts, 1):
                print(f"   [{idx}] advertiser_account_id: {main_acc}")

                # 查看这个主账户下的所有子账户
                sub_accounts = db.session.query(
                    RawAdDataXiaohongshu.sub_account_id,
                    func.count(RawAdDataXiaohongshu.id).label('count'),
                    func.sum(RawAdDataXiaohongshu.cost).label('cost'),
                    func.min(RawAdDataXiaohongshu.date).label('min_date'),
                    func.max(RawAdDataXiaohongshu.date).label('max_date')
                ).filter(
                    RawAdDataXiaohongshu.advertiser_account_id == main_acc
                ).group_by(
                    RawAdDataXiaohongshu.sub_account_id
                ).all()

                for sub in sub_accounts:
                    sub_id = sub.sub_account_id or 'NULL'
                    print(f"       - sub_account_id: {sub_id}")
                    print(f"         记录数: {sub.count}, 花费: {float(sub.cost or 0):,.2f}")
                    print(f"         日期: {sub.min_date} 到 {sub.max_date}")
                print()
        else:
            print("   [OK] 未发现混合账户，所有账户的数据类型一致\n")

        # ===== 6. 检查聚合脚本中的小红书JOIN逻辑 =====
        print("\n6. 检查聚合脚本中的JOIN逻辑问题:\n")
        print("   当前聚合逻辑:")
        print("   - 小红书原始表有 advertiser_account_id (主账户) 和 sub_account_id (子账户)")
        print("   - 聚合时使用 CASE 表达式选择 account_id:")
        print("     * 如果 sub_account_id 不为NULL: 使用 sub_account_id")
        print("     * 如果 sub_account_id 为NULL: 使用 advertiser_account_id")
        print("   - 然后用这个 account_id 去 JOIN account_agency_mapping 表")
        print()
        print("   问题分析:")
        print("   - 如果某个 advertiser_account_id 的部分数据 sub_account_id 为NULL")
        print("   - 而映射表中 main_account_id 对应的映射是 '申万直投'")
        print("   - 那么这些数据就会被错误地标记为 '申万'")
        print()

        print("\n" + "=" * 80)
        print("排查完成")
        print("=" * 80)


if __name__ == '__main__':
    check_xiaohongshu_direct_investment()
