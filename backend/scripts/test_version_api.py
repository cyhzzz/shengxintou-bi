# -*- coding: utf-8 -*-
"""
测试版本管理 API
"""
import requests
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

def test_version_api():
    """测试版本 API"""
    base_url = 'http://127.0.0.1:5000'

    print("=" * 60)
    print("测试版本管理 API")
    print("=" * 60)

    # 测试 1: 获取本地版本
    print("\n[测试 1] GET /api/v1/version/local")
    try:
        response = requests.get(f'{base_url}/api/v1/version/local')
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.json()}")
    except Exception as e:
        print(f"   [ERROR] {str(e)}")
        return

    # 测试 2: 版本比较
    print("\n[测试 2] GET /api/v1/version/compare")
    try:
        response = requests.get(f'{base_url}/api/v1/version/compare')
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.json()}")
    except Exception as e:
        print(f"   [ERROR] {str(e)}")

    print("\n" + "=" * 60)
    print("[SUCCESS] API 测试完成")
    print("=" * 60)

if __name__ == '__main__':
    test_version_api()
