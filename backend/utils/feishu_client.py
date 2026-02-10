# -*- coding: utf-8 -*-
"""
飞书客户端工具类
用于与飞书开放平台API交互
"""

import requests
from datetime import datetime, timedelta


class FeishuClient:
    """飞书客户端（简化版）"""

    def __init__(self, app_id, app_secret):
        """
        初始化飞书客户端

        参数:
            app_id: 飞书应用ID
            app_secret: 飞书应用密钥
        """
        self.app_id = app_id
        self.app_secret = app_secret
        self.tenant_access_token = None
        self.token_expires_at = None

    def get_tenant_access_token(self):
        """
        获取租户访问令牌（带缓存）

        返回:
            str: 租户访问令牌
        """
        # 如果token未过期，直接返回
        if self.tenant_access_token and self.token_expires_at > datetime.now():
            return self.tenant_access_token

        # 获取新的token
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        payload = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }

        try:
            response = requests.post(url, json=payload)
            data = response.json()

            if data.get('code') == 0:
                self.tenant_access_token = data.get('tenant_access_token')
                self.token_expires_at = datetime.now() + timedelta(seconds=7200)  # 2小时后过期
                return self.tenant_access_token
            else:
                raise Exception(f"获取飞书Token失败: {data.get('msg')}")
        except Exception as e:
            raise Exception(f"获取飞书Token时发生错误: {str(e)}")

    def push_records(self, bitable_id, table_id, records):
        """
        推送记录到飞书多维表格

        参数:
            bitable_id: 多维表格应用ID
            table_id: 数据表ID
            records: 要推送的记录列表

        返回:
            dict: API响应结果
        """
        token = self.get_tenant_access_token()
        url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{bitable_id}/tables/{table_id}/records/batch_create"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        payload = {"records": [{"fields": r} for r in records]}

        try:
            response = requests.post(url, json=payload, headers=headers)
            return response.json()
        except Exception as e:
            raise Exception(f"推送数据到飞书失败: {str(e)}")

    def pull_records(self, bitable_id, table_id):
        """
        从飞书多维表格拉取记录

        参数:
            bitable_id: 多维表格应用ID
            table_id: 数据表ID

        返回:
            list: 记录列表
        """
        token = self.get_tenant_access_token()
        url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{bitable_id}/tables/{table_id}/records"

        headers = {"Authorization": f"Bearer {token}"}

        all_records = []
        page_token = None

        try:
            while True:
                params = {"page_size": 100}
                if page_token:
                    params["page_token"] = page_token

                response = requests.get(url, params=params, headers=headers)
                data = response.json()

                if data.get('code') != 0:
                    raise Exception(f"获取飞书数据失败: {data.get('msg')}")

                items = data.get('data', {}).get('items', [])
                all_records.extend(items)

                page_token = data.get('data', {}).get('page_token')
                if not page_token:
                    break

            return all_records
        except Exception as e:
            raise Exception(f"从飞书拉取数据失败: {str(e)}")
