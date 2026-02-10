# -*- coding: utf-8 -*-
"""
检查小红书sub_account_id为NULL的数据在backend_conversions中的ad_account信息
"""

import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from backend.models import (
    RawAdDataXiaohongshu,
    BackendConversions,
    AccountAgencyMapping
)
from sqlalchemy import func, and_, or_

def check_conversion_ad_account():
    """检查转化数据中的ad_account字段"""

    with app.app_context():
        print("=" * 80)
        print("检查小红书sub_account_id=NULL的数据对应的ad_account")
        print("=" * 80)

        # 1. 查看小红书原始数据中sub_account_id为NULL的日期分布
        print("\n1. 小红书原始数据 - sub_account_id=NULL的日期分布:\n")

        null_sub_dates = db.session.query(
            RawAdDataXiaohongshu.date,
            func.sum(RawAdDataXiaohongshu.cost).label('cost'),
            func.sum(RawAdDataXiaohongshu.impressions).label('impressions')
        ).filter(
            and_(
                RawAdDataXiaohongshu.advertiser_account_id == '66b0686c000000001d020d1f',
                RawAdDataXiaohongshu.sub_account_id == None
            )
        ).group_by(
            RawAdDataXiaohongshu.date
        ).order_by(
            RawAdDataXiaohongshu.date.desc()
        ).limit(20).all()

        print(f"   日期分布 (最近20天):\n")
        for row in null_sub_dates:
            print(f"   日期: {row.date}, 花费: {float(row.cost or 0):,.2f}, 曝光: {int(row.impressions or 0):,}")

        # 2. 查看backend_conversions中小红书数据的ad_account分布
        print("\n\n2. backend_conversions表 - 小红书数据的ad_account分布:\n")

        conv_ad_accounts = db.session.query(
            BackendConversions.ad_account,
            func.count(BackendConversions.id).label('count'),
            func.min(BackendConversions.lead_date).label('min_date'),
            func.max(BackendConversions.lead_date).label('max_date')
        ).filter(
            BackendConversions.platform_source == '小红书'
        ).group_by(
            BackendConversions.ad_account
        ).order_by(
            func.count(BackendConversions.id).desc()
        ).all()

        print(f"   找到 {len(conv_ad_accounts)} 个不同的ad_account:\n")

        for idx, row in enumerate(conv_ad_accounts, 1):
            ad_account = row.ad_account or 'NULL'
            print(f"   [{idx}] ad_account: {ad_account}")
            print(f"       记录数: {row.count}")
            print(f"       日期范围: {row.min_date} 到 {row.max_date}")

            # 检查这个ad_account在映射表中对应什么代理商
            if ad_account != 'NULL':
                mapping = db.session.query(AccountAgencyMapping).filter(
                    AccountAgencyMapping.platform == '小红书',
                    AccountAgencyMapping.account_name == ad_account
                ).first()

                if mapping:
                    print(f"       映射结果: agency={mapping.agency}, business_model={mapping.business_model}")
                else:
                    print(f"       映射结果: [未找到映射]")
            print()

        # 3. 查看backend_conversions表中agency字段为"申万宏源直投"或"申万"的记录
        print("\n3. backend_conversions表 - agency字段包含'申万'的记录:\n")

        shenwan_conversions = db.session.query(
            BackendConversions.lead_date,
            BackendConversions.ad_account,
            BackendConversions.agency,
            func.count(BackendConversions.id).label('count')
        ).filter(
            and_(
                BackendConversions.platform_source == '小红书',
                BackendConversions.agency.like('%申万%')
            )
        ).group_by(
            BackendConversions.lead_date,
            BackendConversions.ad_account,
            BackendConversions.agency
        ).order_by(
            BackendConversions.lead_date.desc()
        ).limit(20).all()

        if shenwan_conversions:
            print(f"   找到 {len(shenwan_conversions)} 组记录:\n")
            for row in shenwan_conversions:
                print(f"   日期: {row.lead_date}")
                print(f"   ad_account: {row.ad_account or 'NULL'}")
                print(f"   agency: {row.agency}")
                print(f"   记录数: {row.count}")
                print()
        else:
            print("   [未找到] agency字段中不包含'申万'\n")

        print("\n" + "=" * 80)
        print("检查完成")
        print("=" * 80)


if __name__ == '__main__':
    check_conversion_ad_account()
