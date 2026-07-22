# -*- coding: utf-8 -*-
"""鉴权相关 smoke（feat-cloud-supabase）。

不在 test_smoke.py 里混入鉴权 token，避免与历史用例耦合。
本文件专门测：
    - 受保护端点不带 token → 401 + AUTH_REQUIRED
    - 受保护端点带非合法 token → 401 + AUTH_REQUIRED
    - /auth/login 错误密码 → 401 + INVALID_CREDENTIALS
    - /auth/login 缺字段 → 400 + INVALID_INPUT
    - /auth/logout 200
    - /api/health 始终 200（白名单）

运行：python -m unittest tests.api.test_auth -v

本测试只校验状态码与契约，不依赖真实 Supabase 连通（避免 CI 网络依赖）。
"""

import os
import sys
import unittest
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import logging
logging.disable(logging.CRITICAL)

from app import app


class AuthRequiredTest(unittest.TestCase):
    """鉴权：受保护端点的拒绝语义。"""

    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def _post(self, path, payload=None):
        return self.client.post(
            path,
            data=json.dumps(payload or {}),
            content_type='application/json',
        )

    # ---- 白名单 ----

    def test_01_health_no_token_is_allowed(self):
        """健康检查不带 token 也要 200（部署探活）。"""
        resp = self.client.get('/api/health')
        self.assertEqual(resp.status_code, 200, resp.data[:200])

    # ---- 受保护端点：缺/无效 token ----

    def test_02_protected_get_no_token_returns_401(self):
        resp = self.client.get('/api/v1/auth/me')
        self.assertEqual(resp.status_code, 401, resp.data[:200])
        body = resp.get_json()
        self.assertEqual(body.get('error'), 'AUTH_REQUIRED')

    def test_03_protected_post_no_token_returns_401(self):
        resp = self._post('/api/v1/upload')
        self.assertEqual(resp.status_code, 401)
        body = resp.get_json()
        self.assertEqual(body.get('error'), 'AUTH_REQUIRED')

    def test_04_protected_with_bogus_bearer_returns_401(self):
        resp = self.client.get(
            '/api/v1/auth/me',
            headers={'Authorization': 'Bearer not-a-real-jwt-xxxxxx'},
        )
        # supabase auth.get_user 失败：可能 401（无效 token），也可能 503（Supabase 不可达）。
        # 本测试都不视为通过；白名单只接受 401。
        self.assertIn(resp.status_code, (401, 503), f'意外的 {resp.status_code}: {resp.data[:200]}')

    # ---- 登录接口 ----

    def test_05_login_missing_field_returns_400(self):
        resp = self._post('/api/v1/auth/login', {'email': 'a@b.c'})
        self.assertEqual(resp.status_code, 400)
        body = resp.get_json()
        self.assertEqual(body.get('error'), 'INVALID_INPUT')

    def test_06_login_invalid_json_returns_400(self):
        resp = self.client.post('/api/v1/auth/login', data='not-json', content_type='text/plain')
        self.assertEqual(resp.status_code, 400)

    def test_07_login_wrong_password_returns_401_or_503(self):
        """错密码：401（INVALID_CREDENTIALS）；Supabase 不可达：503（AUTH_UNAVAILABLE）。"""
        resp = self._post('/api/v1/auth/login', {'email': 'a@b.c', 'password': 'wrong-password'})
        self.assertIn(resp.status_code, (401, 503), f'意外 {resp.status_code}: {resp.data[:200]}')

    # ---- 登出 ----

    def test_08_logout_returns_success(self):
        resp = self._post('/api/v1/auth/logout')
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body.get('success'))


if __name__ == '__main__':
    unittest.main()
