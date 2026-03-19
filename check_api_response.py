"""直接调用API检查返回的overview数据"""
import sys
import os
import json

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
sys.path.insert(0, os.path.join(base_dir, 'lib'))
os.environ['PYTHONHOME'] = os.path.join(base_dir, 'python-3.9-embed')

from app import app
from backend.routes.employee_conversion import get_weekly_data

with app.app_context():
    print("=" * 60)
    print("直接调用API检查overview数据")
    print("=" * 60)

    # 模拟API请求
    request_data = {
        'start_date': '2026-02-17',
        'end_date': '2026-02-23'
    }

    result = get_weekly_data(request_data)

    print("\nAPI返回结构:")
    if result.get('success'):
        data = result.get('data', {})
        overview = data.get('overview', {})

        print(f"  success: {result.get('success')}")
        print(f"  overview keys: {list(overview.keys())}")

        print("\n各平台 overview 数据:")
        for platform, info in overview.items():
            print(f"  {platform}:")
            print(f"    leads: {info.get('leads', 0)}")
            print(f"    opened_count: {info.get('opened_count', 0)}")
            print(f"    valid_customer_count: {info.get('valid_customer_count', 0)}")

        # 检查rankings
        rankings = data.get('rankings', {})
        print("\n各平台 rankings 数据:")
        for platform, ranking_data in rankings.items():
            total_count = len(ranking_data.get('total', []))
            existing_count = len(ranking_data.get('existing', []))
            new_count = len(ranking_data.get('new', []))
            print(f"  {platform}: total={total_count}, existing={existing_count}, new={new_count}")

            # 打印总榜明细
            if total_count > 0:
                print(f"    总榜员工:")
                for item in ranking_data.get('total', [])[:5]:
                    print(f"      - {item.get('employee_name')}: leads={item.get('total_leads')}")

        # 结论
        print("\n" + "=" * 60)
        print("结论:")
        has_data = any(info.get('leads', 0) > 0 for info in overview.values())
        if has_data:
            print("  [OK] overview中有数据，海报按钮应该显示")
        else:
            print("  [X] overview中没有数据，海报按钮不会显示")
            print("  需要检查 overview 计算逻辑")
    else:
        print(f"  API调用失败: {result.get('message')}")

    print("=" * 60)