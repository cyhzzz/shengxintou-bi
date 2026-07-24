# -*- coding: utf-8 -*-
"""
省心投 BI - 配置文件
"""

import os
import sys
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

# 获取应用基础目录（兼容开发环境和PyInstaller打包环境）
if getattr(sys, 'frozen', False):
    # PyInstaller 打包后的环境
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 开发环境
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# 数据库配置
# feat-cloud-supabase：DATABASE_URL 优先于 DATABASE_PATH。
#   - 设置 DATABASE_URL（postgresql+psycopg://...）→ 走 Postgres（默认连 Supabase）
#   - 未设置 → 走 SQLite，路径由 DATABASE_PATH 控制
DATABASE_PATH = os.path.join(BASE_DIR, os.getenv('DATABASE_PATH', 'database/shengxintou.db'))
# feat-desktop-supabase：归一化 DATABASE_URL 前缀。
# Supabase Dashboard 复制的连接串默认是 postgres://，SQLAlchemy 不认（只认 postgresql）。
# 统一改为 postgresql+psycopg://，确保用 psycopg 驱动。
_raw_db_url = os.getenv('DATABASE_URL', '').strip()
if _raw_db_url.startswith('postgres://'):
    _raw_db_url = 'postgresql+psycopg://' + _raw_db_url[len('postgres://'):]
elif _raw_db_url.startswith('postgresql://') and '+' not in _raw_db_url.split('://', 1)[0]:
    _raw_db_url = 'postgresql+psycopg://' + _raw_db_url[len('postgresql://'):]
DATABASE_URL = _raw_db_url or None
SQLALCHEMY_DATABASE_URI = DATABASE_URL or f'sqlite:///{DATABASE_PATH}'
SQLALCHEMY_TRACK_MODIFICATIONS = False

# v3.4.3：云端数据库 URL（用于「数据同步」页面的 SQLite ↔ PG 双向同步功能）
#   - 本地开发版：主库 SQLite，CLOUD_DATABASE_URL 指向 Supabase PG（同步功能可用）
#   - 桌面版：主库已走 PG，CLOUD_DATABASE_URL 不设（同步功能自动隐藏）
CLOUD_DATABASE_URL = os.getenv('CLOUD_DATABASE_URL', '').strip() or None
# 记录当前 dialect 字符串（不含 URL 中的凭据），启动日志用。
# 用 SQLAlchemy 的 make_url 解析；解析失败记 'unknown'。
def _resolve_dialect():
    try:
        from sqlalchemy.engine.url import make_url
        url = make_url(SQLALCHEMY_DATABASE_URI)
        # sqlalchemy.make_url 会把 password 替换成 *** 暴露，这里只取 drivername
        return (url.drivername or '').split('+')[0] or 'sqlite'
    except Exception:
        return 'unknown'
DATABASE_DIALECT = _resolve_dialect()
# feat-desktop-supabase：PG（Supabase）需要连接池保活配置，避免空闲超时被踢。
# SQLite 不支持这些参数，按 dialect 条件设置。
if DATABASE_DIALECT == 'postgresql':
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,       # 每次借连接前 ping，避免用已断开的连接
        'pool_recycle': 300,         # 5 分钟回收（小于 Supabase 默认空闲超时）
        'pool_size': 5,
        'max_overflow': 5,
        # feat-desktop：Supabase 用 PgBouncer transit 时多会话会复用一个 connection 的 prepared statement 名字，
        # 触发 `DuplicatePreparedStatement: prepared statement "_pg3_0" already exists`。
        # 关掉 psycopg 自动 prepared statement（每个 query 不缓存执行计划），
        # 改由 Supabase PgBouncer / PG 自有 plan cache 优化，避开 prepared statement 命名冲突。
        'connect_args': {'prepare_threshold': None},
    }
else:
    SQLALCHEMY_ENGINE_OPTIONS = {}

# Supabase / 云端 DB 配置（feat-cloud-supabase）
# SUPABASE_URL 与 SUPABASE_*_KEY 不会进日志或异常体，所有后续模块通过本模块取。
# 凭据缺失仅启动期打 ERROR，不抛异常（兼容本地开发继续用 SQLite）。
SUPABASE_URL = os.getenv('SUPABASE_URL', '').strip() or None
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '').strip() or None
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip() or None
# v3.5.8：Supabase / 鉴权 / 双向同步 全部封存为默认关闭。
#   - AUTH_ENABLED：true 时全局中间件强制 /api/v1/* 鉴权；false 时回退无鉴权模式
#   - CLOUD_SYNC_ENABLED：true 时注册 SQLite ↔ PG 双向同步蓝图（/api/v1/data-sync/*）
#   - 两者默认 false，对应 .env 不设置；需要启用时在 .env 中显式设为 true
AUTH_ENABLED = os.getenv('AUTH_ENABLED', 'false').lower() in ('1', 'true', 'yes', 'on')
CLOUD_SYNC_ENABLED = os.getenv('CLOUD_SYNC_ENABLED', 'false').lower() in ('1', 'true', 'yes', 'on')

# feat-local-auth 方案 A：JWT 本地鉴权配置
# - 不依赖 Supabase Auth API，完全本地签发/验证
# - JWT_SECRET 用于签名 JWT（必须配置，建议生产用强随机值）
# - JWT_EXPIRES_HOURS：JWT 过期时间（小时），默认 24
SECRET_KEY = os.getenv('SECRET_KEY', os.urandom(32))
JWT_SECRET = os.getenv('JWT_SECRET', '').strip() or SECRET_KEY
JWT_EXPIRES_HOURS = float(os.getenv('JWT_EXPIRES_HOURS', '24'))

# feat-local-auth 方案 A：默认 admin 账号
# 首次启动时，如果 app_users 表为空，自动创建此账号
DEFAULT_ADMIN_EMAIL = os.getenv('DEFAULT_ADMIN_EMAIL', 'admin@shengxintou.local')
DEFAULT_ADMIN_PASSWORD = os.getenv('DEFAULT_ADMIN_PASSWORD', 'shengxintou2026')

# 文件上传配置
UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv('UPLOAD_FOLDER', 'uploads'))
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', '50')) * 1024 * 1024  # MB -> bytes
ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'csv,xlsx,xls').split(','))

# API配置
API_VERSION = 'v1'
API_PREFIX = f'/api/{API_VERSION}'

# 日志配置
LOG_FOLDER = os.path.join(BASE_DIR, os.getenv('LOG_FOLDER', 'logs'))
LOG_FILE = os.path.join(LOG_FOLDER, 'app.log')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# 服务器配置
HOST = os.getenv('HOST', 'localhost')
PORT = int(os.getenv('PORT', '5000'))
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

# 支持的文件编码
FILE_ENCODINGS = ['utf-8', 'gb2312', 'gbk', 'gb18030', 'latin1']

# 平台配置
PLATFORMS = ['腾讯', '抖音', '小红书']

# 业务模式
BUSINESS_MODELS = ['直播', '信息流']

# 飞书配置
FEISHU_ENABLED = os.getenv('FEISHU_ENABLED', 'true').lower() == 'true'
FEISHU_APP_ID = os.getenv('FEISHU_APP_ID', '')
FEISHU_APP_SECRET = os.getenv('FEISHU_APP_SECRET', '')
FEISHU_BITABLE_ID = os.getenv('FEISHU_BITABLE_ID', '')

# 飞书表格ID映射（数据库表名 -> 飞书表格ID）
FEISHU_TABLE_IDS = {
    'daily_metrics_unified': 'tblTqwIacpXIHETD',  # 日报数据汇总
    'backend_conversions': 'tblzxKjQ1SRuTIdH',  # 后端转化明细
    'xhs_notes_daily': 'tblCj1gQUiVRBbg7',  # 小红书笔记日报
    'daily_notes_metrics_unified': 'tblwHdlZHHoY8JXM',  # 笔记日报汇总
}

# WebDAV 备份配置（坚果云）
WEBDAV_ENABLED = os.getenv('WEBDAV_ENABLED', 'true').lower() == 'true'
WEBDAV_URL = os.getenv('WEBDAV_URL', '')
WEBDAV_USERNAME = os.getenv('WEBDAV_USERNAME', '')
WEBDAV_PASSWORD = os.getenv('WEBDAV_PASSWORD', '')
# 支持 WEBDAV_BASE_PATH 和 WEBDAV_BACKUP_DIR 两种配置项名称
WEBDAV_BACKUP_DIR = os.getenv('WEBDAV_BASE_PATH') or os.getenv('WEBDAV_BACKUP_DIR', '/shengxintou-backup')
WEBDAV_MAX_BACKUPS = int(os.getenv('WEBDAV_MAX_BACKUPS', '3'))
WEBDAV_USE_COMPRESSION = os.getenv('WEBDAV_USE_COMPRESSION', 'true').lower() == 'true'
# 是否校验 SSL 证书（企业内网自签证书/证书缺失导致 SSL 错误时可临时关闭）
WEBDAV_VERIFY_SSL = os.getenv('WEBDAV_VERIFY_SSL', 'true').lower() == 'true'
# 可选：为 WebDAV 请求单独指定代理（如 http://127.0.0.1:7890）；留空则使用 requests 默认行为（读取系统/环境变量）
WEBDAV_PROXY = os.getenv('WEBDAV_PROXY', '') or None
