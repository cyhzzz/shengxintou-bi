# -*- coding: utf-8 -*-
"""Supabase Python 客户端懒加载。

本期使用 supabase-py（supabase==2.x）。首次按需创建，后续复用。

设计要点：
    - anon client: 调 signInWithPassword 等需要"用户级"权限的端点
    - service_role client: 调 admin API（创建/查询 user_profiles 等）
    - 客户端本身不抛异常；调用方（如 signInWithPassword）出错时再判断
    - URL 或 key 缺失时返回 None，方便调用方判断"未配置"

凭据读取：仅从 config 模块读取（已从环境变量注入）。
"""

import logging

logger = logging.getLogger(__name__)

_anon_client = None
_service_client = None
_client_imported = False
_import_error = None


def _try_import_client():
    """尝试 import supabase。失败时记 ERROR，不抛异常。

    失败原因可能是：
        - 运行环境没安装 supabase（pip install supabase）
        - 或 Supabase 项目 URL/Key 未配置
    """
    global _client_imported, _import_error
    if _client_imported:
        return _import_error is None
    try:
        # 兼容 supabase 2.x 用 create_client；2.0 之前是 supabase.Client
        from supabase import create_client  # noqa: F401
        _client_imported = True
        _import_error = None
        return True
    except Exception as e:  # ImportError 或其它
        _import_error = repr(e)
        # 这条 ERROR 是开发期排查最有用的线索；不要降级为 WARNING
        logger.error(f"supabase 包未安装或导入失败：{_import_error}；请在 requirements.txt 加入 supabase")
        return False


def get_supabase_anon():
    """获取 anon 客户端（登录、读自己资料）。首次调用时创建。"""
    global _anon_client
    if _anon_client is not None:
        return _anon_client
    if not _try_import_client():
        return None
    from config import SUPABASE_URL, SUPABASE_ANON_KEY
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.error("SUPABASE_URL 或 SUPABASE_ANON_KEY 未配置；anon 客户端不可用")
        return None
    try:
        from supabase import create_client
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return _anon_client
    except Exception as e:
        logger.error(f"创建 Supabase anon 客户端失败：{e}")
        return None


def get_supabase_service():
    """获取 service_role 客户端（admin 权限，可读 user_profiles、查 auth.users）。"""
    global _service_client
    if _service_client is not None:
        return _service_client
    if not _try_import_client():
        return None
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置；service 客户端不可用")
        return None
    try:
        from supabase import create_client
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        return _service_client
    except Exception as e:
        logger.error(f"创建 Supabase service_role 客户端失败：{e}")
        return None
