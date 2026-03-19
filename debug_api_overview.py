# -*- coding: utf-8 -*-
"""
调试API返回的overview数据
"""
import sys
import os
import json

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
sys.path.insert(0, os.path.join(base_dir, 'lib'))
os.environ['PYTHONHOME'] = os.path.join(base_dir, 'python-3.9-embed')

from app import app
from backend.routes.data.employee_conversion_helpers import (
    get_weekly_report_data,
    get_qualified_employees
)

with app.app_context():
    print("=" * 60)
    print("API Overview Debug")
    print("=" * 60)

    # 1. Check qualified employees
    print("\n1. Qualified employees (min_leads=5):")
    qualified = get_qualified_employees(min_leads=5)
    print(f"   Count: {len(qualified)}")
    print(f"   Names: {qualified[:10]}...")

    # 2. Call get_weekly_report_data
    print("\n2. get_weekly_report_data(2026-02-17, 2026-02-23):")
    platforms = ['xiaohongshu', 'tencent', 'douyin']  # Try lowercase first

    result = get_weekly_report_data('2026-02-17', '2026-02-23', platforms, top_count=10)

    print(f"   Platforms requested: {platforms}")
    print(f"   Overview keys: {list(result.get('overview', {}).keys())}")
    print(f"   Rankings keys: {list(result.get('rankings', {}).keys())}")

    for platform, info in result.get('overview', {}).items():
        print(f"\n   {platform}:")
        print(f"     leads: {info.get('leads', 0)}")
        print(f"     opened: {info.get('opened', 0)}")

    for platform, ranking_data in result.get('rankings', {}).items():
        total = ranking_data.get('total', [])
        print(f"\n   {platform} rankings: {len(total)} employees in total list")
        if total:
            for item in total[:3]:
                print(f"     - {item.get('employee_name')}: {item.get('total_leads')} leads")

    # 3. Try with Chinese platform names
    print("\n3. Try with Chinese platform names:")
    platforms_cn = ['小红书', '腾讯', '抖音']

    result_cn = get_weekly_report_data('2026-02-17', '2026-02-23', platforms_cn, top_count=10)

    print(f"   Platforms requested: {platforms_cn}")
    print(f"   Overview keys: {list(result_cn.get('overview', {}).keys())}")
    print(f"   Rankings keys: {list(result_cn.get('rankings', {}).keys())}")

    for platform, info in result_cn.get('overview', {}).items():
        print(f"\n   {platform}:")
        print(f"     leads: {info.get('leads', 0)}")
        print(f"     opened: {info.get('opened', 0)}")

    for platform, ranking_data in result_cn.get('rankings', {}).items():
        total = ranking_data.get('total', [])
        print(f"\n   {platform} rankings: {len(total)} employees in total list")
        if total:
            for item in total[:3]:
                print(f"     - {item.get('employee_name')}: {item.get('total_leads')} leads")

    print("\n" + "=" * 60)