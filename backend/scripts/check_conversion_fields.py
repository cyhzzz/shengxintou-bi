# -*- coding: utf-8 -*-
"""
检查 backend_conversions 表中可用于关联代理商的字段
"""

import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from backend.models import BackendConversions, AccountAgencyMapping
from sqlalchemy import func, and_, or_


def check_conversion_fields():
    """检查转化数据中的关键字段"""

    with app.app_context():
        print("=" * 80)
        print("检查 backend_conversions 表字段分布")
        print("=" * 80)

        # 1. 小红书转化数据的 ad_account 字段分布
        print("\n1. 小红书转化数据 - ad_account 字段分布:\n")

        total_count = db.session.query(func.count(BackendConversions.id)).filter(
            BackendConversions.platform_source == '小红书'
        ).scalar()

        has_account = db.session.query(func.count(BackendConversions.id)).filter(
            BackendConversions.platform_source == '小红书',
            BackendConversions.ad_account != None,
            BackendConversions.ad_account != ''
        ).scalar()

        null_account = total_count - has_account

        print(f"  总记录数: {total_count}")
        print(f"  ad_account 不为空: {has_account} ({has_account/total_count*100:.1f}%)")
        print(f"  ad_account 为空: {null_account} ({null_account/total_count*100:.1f}%)")

        # 查看 ad_account 的值分布
        print("\n  ad_account 值分布（前20个）:")
        account_dist = db.session.query(
            BackendConversions.ad_account,
            func.count(BackendConversions.id).label('count')
        ).filter(
            BackendConversions.platform_source == '小红书',
            BackendConversions.ad_account != None,
            BackendConversions.ad_account != ''
        ).group_by(
            BackendConversions.ad_account
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).limit(20).all()

        for acc, count in account_dist:
            print(f"    {acc}: {count} 条")

        # 2. 检查这些 ad_account 在映射表中的对应关系
        print("\n2. ad_account 在 account_agency_mapping 表中的映射:\n")

        for acc, count in account_dist[:10]:  # 只检查前10个
            mappings = db.session.query(AccountAgencyMapping).filter(
                AccountAgencyMapping.platform == '小红书',
                or_(
                    AccountAgencyMapping.account_id == acc,
                    AccountAgencyMapping.account_name == acc,
                    AccountAgencyMapping.main_account_id == acc
                )
            ).all()

            print(f"  ad_account: {acc} ({count} 条转化)")
            if mappings:
                for m in mappings:
                    print(f"    映射: account_id={m.account_id}, main_account_id={m.main_account_id}")
                    print(f"          agency={m.agency}, business_model={m.business_model}")
            else:
                print(f"    [未找到映射]")
            print()

        # 3. 检查 agency 字段分布
        print("\n3. 小红书转化数据 - agency 字段分布:\n")

        agency_dist = db.session.query(
            func.coalesce(BackendConversions.agency, '[空]').label('agency'),
            func.count(BackendConversions.id).label('count')
        ).filter(
            BackendConversions.platform_source == '小红书'
        ).group_by(
            func.coalesce(BackendConversions.agency, '[空]')
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).all()

        for agency, count in agency_dist:
            print(f"  {agency}: {count} 条")

        # 4. 检查 customer_source 字段（可以推断业务模式）
        print("\n4. 小红书转化数据 - customer_source 字段分布:\n")

        source_dist = db.session.query(
            func.coalesce(BackendConversions.customer_source, '[空]').label('customer_source'),
            func.count(BackendConversions.id).label('count')
        ).filter(
            BackendConversions.platform_source == '小红书'
        ).group_by(
            func.coalesce(BackendConversions.customer_source, '[空]')
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).limit(20).all()

        for source, count in source_dist:
            print(f"  {source}: {count} 条")

        # 5. 关键测试：尝试通过 ad_account JOIN AccountAgencyMapping
        print("\n5. 测试：通过 ad_account JOIN AccountAgencyMapping:\n")

        from sqlalchemy import case

        # 构建用户标识（去重）
        user_identifier = func.concat(
            BackendConversions.platform_source, '|',
            func.coalesce(BackendConversions.wechat_nickname, ''), '|',
            func.coalesce(BackendConversions.capital_account, ''), '|',
            func.coalesce(BackendConversions.platform_user_id, '')
        )

        # 业务模式推断
        business_model_mapping = case(
            (BackendConversions.customer_source.like('%引流%'), '直播'),
            (and_(
                BackendConversions.customer_source.isnot(None),
                BackendConversions.customer_source != ''
            ), '信息流'),
            else_=''
        )

        # 测试 JOIN
        test_query = db.session.query(
            BackendConversions.lead_date.label('date'),
            BackendConversions.platform_source.label('platform'),
            func.coalesce(AccountAgencyMapping.agency, '[未映射]').label('agency'),
            func.coalesce(business_model_mapping, '').label('business_model'),
            func.count(func.distinct(user_identifier)).label('lead_users')
        ).outerjoin(
            AccountAgencyMapping,
            and_(
                AccountAgencyMapping.platform == '小红书',
                or_(
                    # 方法1: 通过 account_id 匹配
                    AccountAgencyMapping.account_id == BackendConversions.ad_account,
                    # 方法2: 通过 account_name 模糊匹配
                    AccountAgencyMapping.account_name == BackendConversions.ad_account
                )
            )
        ).filter(
            and_(
                BackendConversions.platform_source == '小红书',
                BackendConversions.lead_date >= '2026-01-01',
                BackendConversions.lead_date <= '2026-01-06'
            )
        ).group_by(
            BackendConversions.lead_date,
            BackendConversions.platform_source,
            AccountAgencyMapping.agency,
            business_model_mapping
        ).all()

        print(f"  查询结果（小红书2026-01-01至2026-01-06）:\n")
        for row in test_query:
            print(f"    日期: {row.date}")
            print(f"    代理商: {row.agency}, 业务模式: {row.business_model}")
            print(f"    线索: {row.lead_users}")
            print()

        print("\n" + "=" * 80)
        print("检查完成")
        print("=" * 80)


if __name__ == '__main__':
    check_conversion_fields()
