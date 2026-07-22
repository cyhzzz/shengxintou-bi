# -*- coding: utf-8 -*-
"""鉴权蓝图：/api/v1/auth/*（feat-local-auth 方案 A）。

端点：
    POST /auth/login            email+password 查 app_users，签发 JWT
    POST /auth/register          admin 创建新用户（需 admin 角色）
    POST /auth/change-password   修改自己的密码
    POST /auth/logout            前端清 token 即可
    GET  /auth/me                返回当前用户信息
    GET  /auth/users             admin 列出所有用户
    PATCH /auth/users/:id        admin 修改用户（role/is_active/display_name）
    POST /auth/reset-password    admin 重置用户密码

设计：
- 不依赖 Supabase Auth API，完全本地鉴权
- 密码用 werkzeug.security PBKDF2-SHA256
- JWT 用 PyJWT 签发/验证
- 中间件用 jwt.decode 验证，零网络调用
"""

import logging
from datetime import datetime

from flask import Blueprint, request, jsonify, g

from .middleware import _unauthorized, require_auth, current_user
from .jwt_utils import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

bp = Blueprint('auth', __name__)

# 白名单：这些路径即使没 token 也放行
AUTH_WHITELIST = (
    '/api/health',
    '/api/v1/auth/login',
    '/api/v1/auth/logout',
    '/apidocs',
    '/apispec_1.json',
    '/flasgger',
    '/static',
    '/assets',
    '/icons',
)


def _is_whitelisted(path: str) -> bool:
    for p in AUTH_WHITELIST:
        if p.endswith('/') and path.startswith(p):
            return True
        if path == p or path.startswith(p + '/'):
            return True
    return False


def init_auth(app):
    """注册全局中间件（仅当 AUTH_ENABLED）。"""

    @app.before_request
    def _auth_before():
        # 全局关闭开关（调试期用）
        if not getattr(app, 'config', {}).get('AUTH_ENABLED', True):
            return None

        path = request.path or '/'
        # 白名单放行
        if _is_whitelisted(path):
            return None

        # 仅 /api/v1/* 受保护
        if not path.startswith('/api/v1/'):
            return None

        # 解析 Authorization
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return _unauthorized('AUTH_REQUIRED', '缺失 Bearer token')

        token = auth_header[len('Bearer '):].strip()
        if not token:
            return _unauthorized('AUTH_REQUIRED', 'Bearer token 为空')

        # feat-local-auth 方案 A：用 jwt.decode 验证，零网络调用
        try:
            payload = decode_access_token(token)
            user_id_str = payload.get('sub')
            user_email = payload.get('email')
            user_role = payload.get('role')
            if not user_id_str:
                return _unauthorized('AUTH_REQUIRED', 'token 无效')
            user_id = int(user_id_str)
        except Exception as e:
            logger.warning(f"jwt.decode 失败：{e}")
            return _unauthorized('AUTH_REQUIRED', 'token 无效或已过期')

        g._auth_ok = True
        g._auth_supabase_user = {'id': user_id, 'email': user_email}
        g._auth_token_role = user_role  # 从 token 拿 role（避免每次查库）

        # 查 app_users 拿最新 profile（is_active 可能被 admin 改过）
        try:
            from backend.models_v2 import AppUser
            row = AppUser.query.filter_by(id=user_id).first()
            if row is not None:
                profile = {
                    'id': str(row.id),
                    'email': row.email,
                    'display_name': row.display_name,
                    'department': row.department,
                    'role': row.role,
                    'is_active': bool(row.is_active),
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                }
                g._auth_user_profile = profile
                # 禁用账号拒绝
                if not profile['is_active']:
                    return _unauthorized('ACCOUNT_DISABLED', '账号已禁用，请联系管理员')
            else:
                # token 有效但用户已被删除
                return _unauthorized('ACCOUNT_REMOVED', '账号已删除')
        except Exception as e:
            logger.debug(f"查询 AppUser 异常（忽略）：{e}")
            g._auth_user_profile = None


# ============================================================================
# 登录 / 登出 / 当前用户
# ============================================================================

@bp.route('/auth/login', methods=['POST'])
def login():
    """email + password 查 app_users，签发 JWT。"""
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '请求体不是合法 JSON'}), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': 'email 与 password 必填'}), 400

    try:
        from backend.models_v2 import AppUser
        from backend.database import db
        row = AppUser.query.filter_by(email=email).first()
        if row is None:
            logger.warning(f"login failed (user not found): email={email!r}")
            return jsonify({'success': False, 'error': 'INVALID_CREDENTIALS',
                            'message': '邮箱或密码不正确'}), 401

        if not row.is_active:
            return jsonify({'success': False, 'error': 'ACCOUNT_DISABLED',
                            'message': '账号已禁用，请联系管理员'}), 403

        if not verify_password(password, row.password_hash):
            logger.warning(f"login failed (password mismatch): email={email!r}")
            return jsonify({'success': False, 'error': 'INVALID_CREDENTIALS',
                            'message': '邮箱或密码不正确'}), 401

        # 签发 JWT
        access_token, expires_in = create_access_token(
            user_id=row.id, email=row.email, role=row.role
        )
        logger.info(f"login OK: email={email!r} id={row.id} role={row.role}")

        return jsonify({
            'success': True,
            'data': {
                'access_token': access_token,
                'refresh_token': None,  # 方案 A 不用 refresh token
                'token_type': 'bearer',
                'expires_in': expires_in,
                'user': {
                    'id': row.id,
                    'email': row.email,
                    'display_name': row.display_name,
                    'role': row.role,
                },
            }
        })
    except Exception as e:
        logger.exception(f"login 内部异常：{e}")
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '登录服务异常'}), 500


@bp.route('/auth/logout', methods=['POST'])
def logout():
    """前端清 token 即可。后端无服务端 session。"""
    return jsonify({'success': True, 'data': {'message': '已退出'}})


@bp.route('/auth/me', methods=['GET'])
@require_auth
def me():
    """返回当前用户信息。"""
    user = getattr(g, '_auth_supabase_user', None) or {}
    profile = getattr(g, '_auth_user_profile', None)
    return jsonify({
        'success': True,
        'data': {
            'id': user.get('id'),
            'email': user.get('email'),
            'profile': profile,
        }
    })


# ============================================================================
# 用户管理（admin only）
# ============================================================================

def _require_admin():
    """校验当前用户是否为 admin，否则返回 403 响应。成功返回 None。"""
    profile = getattr(g, '_auth_user_profile', None)
    role = (profile or {}).get('role') if profile else None
    if role != 'admin':
        return jsonify({'success': False, 'error': 'FORBIDDEN',
                        'message': '需要管理员权限'}), 403
    return None


@bp.route('/auth/register', methods=['POST'])
@require_auth
def register():
    """admin 创建新用户。"""
    deny = _require_admin()
    if deny:
        return deny

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '请求体不是合法 JSON'}), 400

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    display_name = (data.get('display_name') or '').strip()
    department = (data.get('department') or '').strip()
    role = (data.get('role') or 'viewer').strip().lower()
    is_active = 1 if data.get('is_active', True) else 0

    if not email or not password:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': 'email 与 password 必填'}), 400
    if role not in ('viewer', 'admin'):
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': 'role 只能是 viewer 或 admin'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '密码至少 6 位'}), 400

    try:
        from backend.models_v2 import AppUser
        from backend.database import db
        existing = AppUser.query.filter_by(email=email).first()
        if existing is not None:
            return jsonify({'success': False, 'error': 'DUPLICATE_EMAIL',
                            'message': f'邮箱已存在：{email}'}), 409

        row = AppUser(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name or email.split('@')[0],
            department=department,
            role=role,
            is_active=is_active,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.session.add(row)
        db.session.commit()
        logger.info(f"register OK: email={email!r} role={role} by admin={current_user.email}")

        return jsonify({
            'success': True,
            'data': {
                'id': row.id,
                'email': row.email,
                'display_name': row.display_name,
                'department': row.department,
                'role': row.role,
                'is_active': bool(row.is_active),
            }
        }), 201
    except Exception as e:
        logger.exception(f"register 内部异常：{e}")
        try:
            from backend.database import db
            db.session.rollback()
        except Exception:
            pass
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '创建用户失败'}), 500


@bp.route('/auth/users', methods=['GET'])
@require_auth
def list_users():
    """admin 列出所有用户。"""
    deny = _require_admin()
    if deny:
        return deny

    try:
        from backend.models_v2 import AppUser
        rows = AppUser.query.order_by(AppUser.id.asc()).all()
        items = [{
            'id': r.id,
            'email': r.email,
            'display_name': r.display_name,
            'department': r.department,
            'role': r.role,
            'is_active': bool(r.is_active),
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'updated_at': r.updated_at.isoformat() if r.updated_at else None,
        } for r in rows]
        return jsonify({'success': True, 'data': {'items': items, 'total': len(items)}})
    except Exception as e:
        logger.exception(f"list_users 内部异常：{e}")
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '查询用户列表失败'}), 500


@bp.route('/auth/users/<int:user_id>', methods=['PATCH'])
@require_auth
def update_user(user_id: int):
    """admin 修改用户（role/is_active/display_name/department）。"""
    deny = _require_admin()
    if deny:
        return deny

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '请求体不是合法 JSON'}), 400

    try:
        from backend.models_v2 import AppUser
        from backend.database import db
        row = AppUser.query.filter_by(id=user_id).first()
        if row is None:
            return jsonify({'success': False, 'error': 'NOT_FOUND',
                            'message': f'用户不存在：{user_id}'}), 404

        if 'display_name' in data:
            row.display_name = (data['display_name'] or '').strip() or None
        if 'department' in data:
            row.department = (data['department'] or '').strip() or None
        if 'role' in data:
            new_role = (data['role'] or '').strip().lower()
            if new_role not in ('viewer', 'admin'):
                return jsonify({'success': False, 'error': 'INVALID_INPUT',
                                'message': 'role 只能是 viewer 或 admin'}), 400
            row.role = new_role
        if 'is_active' in data:
            row.is_active = 1 if data['is_active'] else 0
        row.updated_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"update_user OK: id={user_id} by admin={current_user.email}")

        return jsonify({
            'success': True,
            'data': {
                'id': row.id,
                'email': row.email,
                'display_name': row.display_name,
                'department': row.department,
                'role': row.role,
                'is_active': bool(row.is_active),
            }
        })
    except Exception as e:
        logger.exception(f"update_user 内部异常：{e}")
        try:
            from backend.database import db
            db.session.rollback()
        except Exception:
            pass
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '修改用户失败'}), 500


@bp.route('/auth/reset-password', methods=['POST'])
@require_auth
def reset_password():
    """admin 重置用户密码。"""
    deny = _require_admin()
    if deny:
        return deny

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '请求体不是合法 JSON'}), 400

    user_id = data.get('user_id')
    new_password = data.get('new_password') or ''
    if not user_id or not new_password:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': 'user_id 与 new_password 必填'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '新密码至少 6 位'}), 400

    try:
        from backend.models_v2 import AppUser
        from backend.database import db
        row = AppUser.query.filter_by(id=user_id).first()
        if row is None:
            return jsonify({'success': False, 'error': 'NOT_FOUND',
                            'message': f'用户不存在：{user_id}'}), 404
        row.password_hash = hash_password(new_password)
        row.updated_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"reset_password OK: id={user_id} by admin={current_user.email}")
        return jsonify({'success': True, 'data': {'message': '密码已重置'}})
    except Exception as e:
        logger.exception(f"reset_password 内部异常：{e}")
        try:
            from backend.database import db
            db.session.rollback()
        except Exception:
            pass
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '重置密码失败'}), 500


# ============================================================================
# 自己改密码
# ============================================================================

@bp.route('/auth/change-password', methods=['POST'])
@require_auth
def change_password():
    """用户修改自己的密码。"""
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '请求体不是合法 JSON'}), 400

    old_password = data.get('old_password') or ''
    new_password = data.get('new_password') or ''
    if not old_password or not new_password:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': 'old_password 与 new_password 必填'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'INVALID_INPUT',
                        'message': '新密码至少 6 位'}), 400

    try:
        from backend.models_v2 import AppUser
        from backend.database import db
        user_id = current_user.id
        row = AppUser.query.filter_by(id=user_id).first()
        if row is None:
            return jsonify({'success': False, 'error': 'NOT_FOUND',
                            'message': '账号不存在'}), 404
        if not verify_password(old_password, row.password_hash):
            return jsonify({'success': False, 'error': 'INVALID_CREDENTIALS',
                            'message': '原密码不正确'}), 401
        row.password_hash = hash_password(new_password)
        row.updated_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"change_password OK: id={user_id}")
        return jsonify({'success': True, 'data': {'message': '密码已修改'}})
    except Exception as e:
        logger.exception(f"change_password 内部异常：{e}")
        try:
            from backend.database import db
            db.session.rollback()
        except Exception:
            pass
        return jsonify({'success': False, 'error': 'INTERNAL_ERROR',
                        'message': '修改密码失败'}), 500
