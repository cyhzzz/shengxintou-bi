# -*- coding: utf-8 -*-
"""
对比 backend_conversions.ad_account 和 AccountAgencyMapping.account_name
诊断为什么小红书转化数据的代理商映射失败
"""

import sys
import os

# 获取项目根目录（当前文件的祖父目录）
# 脚本位置: backend/scripts/diagnostic/compare_xiaohongshu_account_names.py
# 项目根目录应该是 D:\project\省心投-cc
current_dir = os.path.dirname(os.path.abspath(__file__))
# 从 backend/scripts/diagnostic 向上三级到项目根目录
project_root = os.path.abspath(os.path.join(current_dir, '../../..'))

print(f"调试信息:")
print(f"  当前脚本目录: {current_dir}")
print(f"  计算的项目根目录: {project_root}")
print(f"  项目根目录是否存在: {os.path.exists(project_root)}")
print(f"  app.py 是否存在: {os.path.exists(os.path.join(project_root, 'app.py'))}")

# 添加到 Python 路径
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    print(f"  已添加到 sys.path")

# 现在导入模块
try:
    from app import app
    from backend.database import db
    from backend.models import BackendConversions, AccountAgencyMapping
    from sqlalchemy import func, and_
except ImportError as e:
    print(f"导入错误: {e}")
    print(f"项目根目录: {project_root}")
    print(f"Python 路径: {sys.path[:3]}")
    sys.exit(1)


def compare_account_names():
    """对比小红书转化数据和映射表中的账号名称"""

    with app.app_context():
        print("=" * 80)
        print("小红书账号名称对比诊断")
        print("=" * 80)

        # 1. 获取 backend_conversions 中的申万相关 ad_account 值
        print("\n1. backend_conversions 中的申万相关 ad_account 值（按频率排序，前20个）:")
        print("-" * 80)

        conversion_ad_accounts = db.session.query(
            BackendConversions.ad_account,
            func.count(BackendConversions.id).label('count'),
            func.count(
                func.distinct(
                    func.concat(
                        BackendConversions.wechat_nickname, '|',
                        BackendConversions.capital_account, '|',
                        BackendConversions.platform_user_id
                    )
                )
            ).label('unique_users')
        ).filter(
            BackendConversions.platform_source == '小红书',
            BackendConversions.ad_account.like('%申万%')
        ).group_by(
            BackendConversions.ad_account
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).limit(20).all()

        print(f"{'ad_account值':<60} {'记录数':<10} {'去重用户数':<10}")
        print("-" * 80)
        for row in conversion_ad_accounts:
            ad_account_val = row.ad_account or '(NULL)'
            print(f"{ad_account_val:<60} {row.count:<10} {row.unique_users:<10}")

        # 2. 获取 AccountAgencyMapping 中的申万相关 account_name 值
        print("\n2. AccountAgencyMapping 中的申万相关 account_name 值:")
        print("-" * 80)

        mapping_names = db.session.query(
            AccountAgencyMapping.account_name,
            AccountAgencyMapping.agency,
            AccountAgencyMapping.account_id
        ).filter(
            AccountAgencyMapping.platform == '小红书',
            AccountAgencyMapping.account_name.like('%申万%')
        ).all()

        print(f"{'account_name':<60} {'agency':<20} {'account_id':<15}")
        print("-" * 80)
        for row in mapping_names:
            account_name_val = row.account_name or '(NULL)'
            agency_val = row.agency or '(NULL)'
            account_id_val = row.account_id or '(NULL)'
            print(f"{account_name_val:<60} {agency_val:<20} {account_id_val:<15}")

        # 3. 检查哪些 backend_conversions.ad_account 值无法匹配
        print("\n3. 无法匹配的 ad_account 值（在 backend_conversions 中存在但在 AccountAgencyMapping 中不存在）:")
        print("-" * 80)

        # 获取所有小红书 ad_account 值
        all_conversion_accounts = db.session.query(
            BackendConversions.ad_account
        ).filter(
            BackendConversions.platform_source == '小红书',
            BackendConversions.ad_account.isnot(None),
            BackendConversions.ad_account != ''
        ).distinct().all()

        # 获取映射表中的 account_name 值
        all_mapping_names = db.session.query(
            AccountAgencyMapping.account_name
        ).filter(
            AccountAgencyMapping.platform == '小红书',
            AccountAgencyMapping.account_name.isnot(None),
            AccountAgencyMapping.account_name != ''
        ).distinct().all()

        conversion_account_set = {acc[0] for acc in all_conversion_accounts}
        mapping_name_set = {name[0] for name in all_mapping_names}

        # 找出无法匹配的值
        unmatched_accounts = conversion_account_set - mapping_name_set

        if unmatched_accounts:
            print(f"发现 {len(unmatched_accounts)} 个无法匹配的 ad_account 值:")
            for account in sorted(list(unmatched_accounts))[:30]:  # 只显示前30个
                # 统计每个未匹配值的记录数
                count = db.session.query(
                    func.count(BackendConversions.id)
                ).filter(
                    BackendConversions.platform_source == '小红书',
                    BackendConversions.ad_account == account
                ).scalar()
                print(f"  - {account} ({count} 条记录)")

            if len(unmatched_accounts) > 30:
                print(f"  ... 还有 {len(unmatched_accounts) - 30} 个")
        else:
            print("✓ 所有 ad_account 值都能匹配到映射表")

        # 4. 检查完全匹配的情况
        print("\n4. 成功匹配的 ad_account 值（在两个表中都存在）:")
        print("-" * 80)

        matched_accounts = conversion_account_set & mapping_name_set

        if matched_accounts:
            print(f"发现 {len(matched_accounts)} 个成功匹配的 ad_account 值:")
            for account in sorted(list(matched_accounts))[:30]:
                count = db.session.query(
                    func.count(BackendConversions.id)
                ).filter(
                    BackendConversions.platform_source == '小红书',
                    BackendConversions.ad_account == account
                ).scalar()
                print(f"  - {account} ({count} 条记录)")

            if len(matched_accounts) > 30:
                print(f"  ... 还有 {len(matched_accounts) - 30} 个")
        else:
            print("✗ 没有发现完全匹配的 ad_account 值")

        # 5. 测试一个具体的 JOIN 查询
        print("\n5. 测试 JOIN 查询（小红书转化数据 JOIN 账号映射表）:")
        print("-" * 80)

        join_test = db.session.query(
            BackendConversions.ad_account,
            AccountAgencyMapping.agency,
            func.count(BackendConversions.id).label('count')
        ).outerjoin(
            AccountAgencyMapping,
            and_(
                AccountAgencyMapping.platform == BackendConversions.platform_source,
                AccountAgencyMapping.account_name == BackendConversions.ad_account
            )
        ).filter(
            BackendConversions.platform_source == '小红书',
            BackendConversions.ad_account.like('%申万%')
        ).group_by(
            BackendConversions.ad_account,
            AccountAgencyMapping.agency
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).limit(10).all()

        print(f"{'ad_account':<60} {'匹配的agency':<20} {'记录数':<10}")
        print("-" * 80)
        for row in join_test:
            ad_account_val = row.ad_account or '(NULL)'
            agency_val = row.agency or '(NULL/未匹配)'
            print(f"{ad_account_val:<60} {agency_val:<20} {row.count:<10}")

        print("\n" + "=" * 80)
        print("诊断完成")
        print("=" * 80)


if __name__ == '__main__':
    compare_account_names()
