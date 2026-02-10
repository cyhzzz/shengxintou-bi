# -*- coding: utf-8 -*-
"""
初始化代理商简称映射表

用于将转化明细表（backend_conversions）中 agency 字段的拼音简称
映射为代理商全称

业务场景：
- 抖音/腾讯转化数据的 agency 字段使用拼音简称（如 lz, fs, zl）
- 小红书转化数据使用 ad_account JOIN 映射表获取全称
- 需要将简称映射为全称，以便统一聚合和分析
"""

import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from app import app
from backend.database import db
from backend.models import AgencyAbbreviationMapping


def init_agency_abbreviation_mapping():
    """初始化代理商简称映射表"""

    # 初始映射数据
    # 根据用户提供的信息：
    # - 平台简称：YJ = 云极（平台，不是代理商）
    # - 代理商简称：lz=量子, fs=风声, zl=众联, yp=优品, xz=信则, jn=绩牛, my=美洋
    # - 代理商（无简称）：申万宏源直投

    abbreviation_mappings = [
        # ===== 平台简称映射 =====
        {
            'abbreviation': 'YJ',
            'full_name': '云极',
            'mapping_type': 'platform',
            'platform': None,  # 通用，适用于所有平台
            'display_name': '云极',
            'description': '平台简称：云极（平台类型，非代理商）'
        },

        # ===== 代理商简称映射 =====
        {
            'abbreviation': 'lz',
            'full_name': '量子',
            'mapping_type': 'agency',
            'platform': None,  # 通用，适用于腾讯/抖音
            'display_name': '量子',
            'description': '代理商简称：量子'
        },
        {
            'abbreviation': 'fs',
            'full_name': '风声',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '风声',
            'description': '代理商简称：风声'
        },
        {
            'abbreviation': 'zl',
            'full_name': '众联',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '众联',
            'description': '代理商简称：众联'
        },
        {
            'abbreviation': 'yp',
            'full_name': '优品',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '优品',
            'description': '代理商简称：优品'
        },
        {
            'abbreviation': 'xz',
            'full_name': '信则',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '信则',
            'description': '代理商简称：信则'
        },
        {
            'abbreviation': 'jn',
            'full_name': '绩牛',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '绩牛',
            'description': '代理商简称：绩牛'
        },
        {
            'abbreviation': 'my',
            'full_name': '美洋',
            'mapping_type': 'agency',
            'platform': None,
            'display_name': '美洋',
            'description': '代理商简称：美洋'
        },
    ]

    with app.app_context():
        # 创建表
        db.create_all()
        print('[OK] 创建表 agency_abbreviation_mapping')

        # 插入初始数据
        for mapping in abbreviation_mappings:
            try:
                # 检查是否已存在
                existing = AgencyAbbreviationMapping.query.filter_by(
                    abbreviation=mapping['abbreviation']
                ).first()

                if existing:
                    print(f"  [已存在] {mapping['abbreviation']} → {mapping['full_name']}")
                else:
                    # 插入新记录
                    new_mapping = AgencyAbbreviationMapping(**mapping)
                    db.session.add(new_mapping)
                    db.session.commit()
                    print(f"  [插入] {mapping['abbreviation']} → {mapping['full_name']}")
            except Exception as e:
                print(f"  [错误] {mapping['abbreviation']}: {e}")
                db.session.rollback()

        # 查询验证
        print('\n[完成] 当前代理商简称映射（按类型分组）:')
        print('=' * 80)

        # 平台简称
        platform_mappings = AgencyAbbreviationMapping.query.filter_by(
            mapping_type='platform'
        ).all()
        if platform_mappings:
            print('\n【平台简称】')
            for m in platform_mappings:
                status = '启用' if m.is_active else '禁用'
                print(f"  {m.abbreviation} → {m.full_name} ({m.display_name}) [{status}]")

        # 代理商简称
        agency_mappings = AgencyAbbreviationMapping.query.filter_by(
            mapping_type='agency'
        ).order_by(AgencyAbbreviationMapping.abbreviation).all()
        if agency_mappings:
            print('\n【代理商简称】')
            for m in agency_mappings:
                status = '启用' if m.is_active else '禁用'
                platform_info = f' ({m.platform})' if m.platform else ' (通用)'
                print(f"  {m.abbreviation} → {m.full_name} ({m.display_name}){platform_info} [{status}]")

        print('\n' + '=' * 80)
        print(f'总计：{len(platform_mappings)} 个平台简称，{len(agency_mappings)} 个代理商简称')


if __name__ == '__main__':
    init_agency_abbreviation_mapping()
