# -*- coding: utf-8 -*-
"""鉴权装饰器与请求上下文代理。

设计：
    - require_auth：装饰器；用于单端点强化（即便中间件漏了也别漏）。
    - current_user：g object 上的便捷代理（id/email/role/profile）。

中间件本身在 routes.py 里以 before_request 形式注册；这里只放"轻量装饰器"
和上下文代理，便于单元测试和单端点保护。
"""

from functools import wraps
import logging

from flask import g, jsonify, request

logger = logging.getLogger(__name__)

# 401 响应辅助
def _unauthorized(code='AUTH_REQUIRED', message='未登录或登录已过期'):
    return jsonify({'success': False, 'error': code, 'message': message}), 401


class _CurrentUserProxy:
    """在请求处理函数内可用 `current_user.id / email / role / profile`。

    g._auth_supabase_user 与 g._auth_user_profile 由中间件填充。
    """
    @property
    def id(self):
        u = getattr(g, '_auth_supabase_user', None)
        return u.get('id') if u else None

    @property
    def email(self):
        u = getattr(g, '_auth_supabase_user', None)
        return u.get('email') if u else None

    @property
    def profile(self):
        return getattr(g, '_auth_user_profile', None)

    @property
    def role(self):
        p = self.profile
        return (p or {}).get('role') if p else None


current_user = _CurrentUserProxy()


def require_auth(view):
    """装饰器：给业务端点用。

    本期全局 before_request 已经覆盖 /api/v1/*；装饰器作为双重保险和文档化。
    """
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not getattr(g, '_auth_ok', False):
            return _unauthorized()
        return view(*args, **kwargs)
    return wrapped
