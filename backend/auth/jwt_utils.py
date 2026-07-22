# -*- coding: utf-8 -*-
"""JWT 工具（feat-local-auth 方案 A）。

设计：
- 用 PyJWT 签发/验证 JWT，完全不依赖 Supabase Auth API
- 中间件用 jwt.decode 验证 token，零网络调用
- 密码用 werkzeug.security 生成/校验（PBKDF2-SHA256）

环境变量：
- JWT_SECRET：JWT 签名密钥（必须配置，否则启动期报错）
- JWT_EXPIRES_HOURS：JWT 过期时间（小时），默认 24
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from werkzeug.security import generate_password_hash, check_password_hash

logger = logging.getLogger(__name__)

# 默认算法
JWT_ALGORITHM = 'HS256'


def _get_secret() -> str:
    """从 config 读取 JWT_SECRET。"""
    try:
        import config
        secret = getattr(config, 'JWT_SECRET', None)
        if not secret:
            # 兜底：用 SECRET_KEY
            secret = getattr(config, 'SECRET_KEY', None)
        if not secret:
            raise RuntimeError('JWT_SECRET / SECRET_KEY 未配置')
        return str(secret)
    except ImportError as e:
        raise RuntimeError(f'config 模块不可用: {e}')


def _get_expires_hours() -> float:
    try:
        import config
        return float(getattr(config, 'JWT_EXPIRES_HOURS', 24))
    except Exception:
        return 24.0


def create_access_token(user_id: int, email: str, role: str = 'viewer') -> tuple:
    """签发 JWT。

    Args:
        user_id: AppUser.id
        email: 用户邮箱
        role: 用户角色

    Returns:
        (access_token, expires_in_seconds)
    """
    expires_hours = _get_expires_hours()
    expires_in = int(expires_hours * 3600)
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user_id),       # subject = user id
        'email': email,
        'role': role,
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, _get_secret(), algorithm=JWT_ALGORITHM)
    # PyJWT 2.x 返回 str，1.x 返回 bytes
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return token, expires_in


def decode_access_token(token: str) -> dict:
    """验证并解码 JWT。

    Args:
        token: Bearer token 字符串

    Returns:
        payload dict（含 sub/email/role/iat/exp）

    Raises:
        jwt.ExpiredSignatureError: token 过期
        jwt.InvalidTokenError: token 无效
    """
    payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    return payload


def hash_password(password: str) -> str:
    """生成密码 hash（PBKDF2-SHA256）。"""
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """校验密码。"""
    return check_password_hash(password_hash, password)
