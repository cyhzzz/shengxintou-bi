# -*- coding: utf-8 -*-
"""backend.auth - 用户鉴权层。

feat-local-auth 方案 A：
- 不依赖 Supabase Auth API（避免网络层 TLS 重置问题）
- 密码用 werkzeug.security PBKDF2-SHA256
- JWT 用 PyJWT 签发/验证，中间件用 jwt.decode，零网络调用
- 用户数据存 app_users 表（与业务数据同在 Supabase PG / SQLite）

导出：
    bp                  — 蓝图，包含 /api/v1/auth/*
    init_auth           — 注册全局中间件（需传入 app）
    require_auth        — 装饰器，给需要登录的端点用
    current_user        — g object 的便捷代理
"""

from .middleware import require_auth, current_user
from .routes import bp, init_auth
from .jwt_utils import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

__all__ = [
    'bp',
    'init_auth',
    'require_auth',
    'current_user',
    'create_access_token',
    'decode_access_token',
    'hash_password',
    'verify_password',
]
