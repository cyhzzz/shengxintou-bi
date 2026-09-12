# -*- coding: utf-8 -*-
"""
省心投 BI - 应用入口
"""

# Flask reload trigger - config routes added

import os
import sys
import logging
import threading
import time
from flask import Flask, render_template, jsonify
from flask_cors import CORS
import config as top_config  # 顶层 config 模块；后面 from backend.routes import config 会覆盖此名
from config import *
from backend.database import db
# v3.3.10: 把 DimAnchorLiveType 提到顶层 import，尽早把业务模型注册到 db.metadata
# （主播映射同步函数已搬至 backend/database_bootstrap.py）
from backend.models_v2 import DimAnchorLiveType

# 修复：在便携Python环境中，将lib目录添加到sys.path
# 这样即使PYTHONPATH环境变量不生效，也能正常导入第三方库
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # PyInstaller打包后，server_entry.py 已 chdir 到应用根目录（resources/），
    # 用 cwd 而不是 sys.executable 的目录（resources/server/），否则找不到 frontend-react/dist
    cwd = os.getcwd()
    if os.path.exists(os.path.join(cwd, 'app.py')):
        BASE_DIR = cwd
    else:
        BASE_DIR = os.path.dirname(sys.executable)

LIB_DIR = os.path.join(BASE_DIR, 'lib')
if os.path.exists(LIB_DIR):
    # 强制将lib目录放在sys.path的最前面
    # 先删除所有已有的lib相关路径
    sys.path = [p for p in sys.path if 'lib' not in p]
    # 然后将lib目录插入到第一个位置
    sys.path.insert(0, LIB_DIR)
    # 再次确保lib目录在第一位
    if LIB_DIR not in sys.path[0]:
        sys.path.insert(0, LIB_DIR)

# 强制清除numpy缓存，避免导入冲突
import importlib
if 'numpy' in sys.modules:
    del sys.modules['numpy']
if 'pandas' in sys.modules:
    del sys.modules['pandas']

# 配置日志
if not os.path.exists(LOG_FOLDER):
    os.makedirs(LOG_FOLDER)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 尝试导入 pywebview（打包时使用）
# 开发模式下可通过设置环境变量 DEV_MODE=1 禁用 pywebview
DEV_MODE = os.environ.get('DEV_MODE', '0') == '1'

try:
    import webview
    USE_WEBVIEW = True
    if DEV_MODE:
        logger.info("开发模式（DEV_MODE=1）：使用标准Flask服务器模式")
        USE_WEBVIEW = False
    else:
        logger.info("检测到 pywebview，将使用嵌入式浏览器模式")
except ImportError:
    USE_WEBVIEW = False
    logger.info("未检测到 pywebview，将使用标准Flask服务器模式")
    if not DEV_MODE:
        logger.warning("建议安装 pywebview 以获得更好的桌面应用体验")

# 创建Flask应用
# 使用config中的BASE_DIR，确保PyInstaller打包后路径正确
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # PyInstaller打包后，server_entry.py 已 chdir 到应用根目录（resources/），
    # 用 cwd 而不是 sys.executable 的目录（resources/server/），否则找不到 frontend-react/dist
    cwd = os.getcwd()
    if os.path.exists(os.path.join(cwd, 'app.py')):
        BASE_DIR = cwd
    else:
        BASE_DIR = os.path.dirname(sys.executable)

app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, 'frontend-react', 'dist'),
            static_folder=os.path.join(BASE_DIR, 'frontend-react', 'dist'),
            static_url_path='/static')  # 静态文件通过 /static/... 访问，释放根路径给 React Router

# WSGI中间件：处理 /api/api/... 错误路径（由缓存的旧版JS产生）
# 在Flask处理请求之前，将路径重写为正确格式
class DoubleApiRewriteMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        if path.startswith('/api/api/'):
            environ['PATH_INFO'] = path.replace('/api/api/', '/api/', 1)
            # 同时修正SCRIPT_NAME
            script_name = environ.get('SCRIPT_NAME', '')
            if script_name:
                environ['SCRIPT_NAME'] = script_name.replace('/api/api/', '/api/', 1)
        return self.app(environ, start_response)

app.wsgi_app = DoubleApiRewriteMiddleware(app.wsgi_app)

# 禁用模板和静态文件缓存
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True

# 限制上传文件大小，防止超大文件打爆磁盘
# MAX_CONTENT_LENGTH 在 config.py 中定义（默认 50MB），此前虽定义却从未应用到 app.config，
# 导致 Flask 实际不限制上传大小。此处显式启用。
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# CORS配置 - 使用Flask-CORS扩展（推荐）
# 本地开发环境使用白名单，支持通过 CORS_ORIGINS 环境变量扩展（逗号分隔）
_default_cors_origins = [
    "http://localhost:5173",   # Vite 开发服务器
    "http://127.0.0.1:5173",  # Vite 开发服务器（IP 形式）
    "http://localhost:5000",   # Flask 后端
    "http://127.0.0.1:5000",  # Flask 后端（IP 形式）
]
_extra_origins = os.getenv('CORS_ORIGINS', '').strip()
if _extra_origins:
    _default_cors_origins.extend([o.strip() for o in _extra_origins.split(',') if o.strip()])
CORS(app, resources={r"/api/*": {"origins": _default_cors_origins, "headers": "Content-Type,Authorization", "methods": "GET,PUT,POST,DELETE,OPTIONS", "supports_credentials": True}})

# ============================================================================
# Swagger/OpenAPI 文档配置
# 注意：Swagger 初始化必须在所有 Blueprint 注册之后
# ============================================================================

# 请求日志中间件 - DISABLED due to datetime import bug
# @app.before_request
# def log_request():
#     """记录所有请求"""
#     from flask import request
#     import logging
#     from datetime import datetime
#     logger = logging.getLogger(__name__)
#
#     # 只记录API请求
#     if request.path.startswith('/api/'):
#         with open('D:/project/省心投-cc/开发代码/logs/request_log.txt', 'a') as f:
#             f.write(f"{datetime.now()} | {request.method} {request.path} | endpoint: {request.endpoint} | view_args: {request.view_args}\n")
#             f.flush()

# 应用配置
app.config.from_object('config')

# feat-cloud-supabase：把 AUTH_ENABLED 显式传给 app.config；中间件读这里
app.config['AUTH_ENABLED'] = bool(getattr(top_config, 'AUTH_ENABLED', True))

# 初始化数据库
db.init_app(app)

# ============================================================================
# 数据库引导与迁移：五件套已搬至 backend/database_bootstrap.py（纯搬家，行为不变）
# 此处仅保留 import 与按原时序调用
# ============================================================================
from backend.database_bootstrap import (
    configure_sqlite_optimization,
    ensure_database_exists,
)

# 在数据库初始化后立即配置优化
with app.app_context():
    configure_sqlite_optimization()

# 确保必要的文件夹存在
for folder in [UPLOAD_FOLDER, LOG_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
        logger.info(f"创建文件夹: {folder}")

# 基础路由
@app.route('/')
def index():
    """主页 - 返回前端页面"""
    # 先打印HTML文件的路径，用于调试
    import os
    html_path = os.path.join(app.template_folder, 'index.html')
    logger.info(f"正在加载HTML文件: {html_path}")
    logger.info(f"HTML文件存在: {os.path.exists(html_path)}")

    response = render_template('index.html')
    # 禁用所有缓存，确保使用最新的HTML文件
    if hasattr(response, 'headers'):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/debug-html')
def debug_html():
    """调试：查看实际加载的HTML内容"""
    import os
    html_path = os.path.join(app.template_folder, 'index.html')
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 查找小红书报表部分
    lines = content.split('\n')
    result = []
    in_xhs_section = False
    for i, line in enumerate(lines):
        if '小红书报表' in line or 'xhs-notes' in line:
            in_xhs_section = True
        if in_xhs_section:
            result.append(f"{i+1}: {line}")
            if i > 100:  # 只显示前100行
                result.append("...")
                break

    return "<pre>" + "\n".join(result) + "</pre>"

@app.route('/favicon.ico')
def favicon():
    """Favicon - 浏览器标签图标"""
    response = app.send_static_file('favicon.ico')
    # 禁用缓存，确保图标更新后立即生效
    response.cache_control.max_age = 0
    response.cache_control.public = True
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/api/health')
def health_check():
    """健康检查接口"""
    version = '3.8.9'
    try:
        import json as _json
        _vf = os.path.join(BASE_DIR, 'version.json')
        with open(_vf, 'r', encoding='utf-8') as _f:
            version = _json.load(_f).get('version', version)
    except Exception:
        pass
    return jsonify({
        'status': 'ok',
        'message': '省心投 BI 系统运行正常',
        'version': version
    })

# 注册API路由
from backend.routes import metadata, upload, config, webdav_backup, version
from backend.routes.system import self_update as system
from backend.routes.system import data_sync
# v4.2.0: LLM Provider 配置（OpenAI 协议，USER_DATA_DIR 本机文件）
from backend.routes.system import llm_config

# feat-cloud-supabase：鉴权蓝图（必须在所有 app.register_blueprint 之前 import）
from backend.auth import bp as auth_bp, init_auth

# v3.5.8：鉴权与数据同步功能封存，通过 .env 开关控制
#   - AUTH_ENABLED=true：注册鉴权中间件（默认 false）
#   - CLOUD_SYNC_ENABLED=true：注册 SQLite ↔ PG 双向同步蓝图（默认 false）
#   开启时只需在 .env 中将对应项设为 true，无需改代码

# Import weekly_reports module
from backend.routes import weekly_reports
from backend.routes.reports import app_market as app_market_report_blueprint
from backend.routes.reports import app_market_cost as app_market_cost_blueprint
from backend.routes.reports import app_market_attribution as app_market_attribution_blueprint
from backend.routes.reports import app_market_ad_plan as app_market_ad_plan_blueprint
from backend.routes.reports import omni_channel as omni_channel_report_blueprint
# v3.3.10: 小红书计划分析（仿应用市场 /plan-analysis，数据源 fact_conv_content）
from backend.routes.reports import xhs_plan_analysis as xhs_plan_analysis_report_blueprint
# v4.1.9: 智能辅助诊断（数据健康度按月体检，规则引擎 backend/utils/diagnosis）
from backend.routes.reports import diagnosis as diagnosis_report_blueprint
# v4.2.0: LLM 智能分析（跨月诊断信号 + 内置 prompt → OpenAI 协议 LLM）
from backend.routes.reports import llm_analysis as llm_analysis_report_blueprint

# 导入拆分后的数据模块
from backend.routes.data import (
    query,
    dashboard,
    agency_analysis,
    xhs_notes,
    cost_analysis,
    leads,
    account_mapping,
    xhs_operation,
    employee_conversion,
    weekly_report_poster,
    data_reconciliation,
    investment_review,
    xhs_kos_weekly,
)

# 注意：已移除模块缓存清除和reload逻辑，避免"module not in sys.modules"错误
# 如需重新加载代码，请重启服务器

app.register_blueprint(metadata.bp, url_prefix=API_PREFIX)
# feat-cloud-supabase：注册鉴权蓝图，挂在 /api/v1 前缀下
# v3.5.8：蓝图始终注册（端点存在无害），中间件在 init_auth 内根据 AUTH_ENABLED 决定是否拦截
app.register_blueprint(auth_bp, url_prefix=API_PREFIX)

# 注册所有拆分后的数据模块Blueprint
app.register_blueprint(query.bp, url_prefix=API_PREFIX)
app.register_blueprint(dashboard.bp, url_prefix=API_PREFIX)
app.register_blueprint(agency_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_notes.bp, url_prefix=API_PREFIX)
app.register_blueprint(cost_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(leads.bp, url_prefix=API_PREFIX)
app.register_blueprint(account_mapping.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_operation.bp, url_prefix=API_PREFIX)
app.register_blueprint(employee_conversion.bp, url_prefix=API_PREFIX)
app.register_blueprint(weekly_report_poster.bp, url_prefix=API_PREFIX)
app.register_blueprint(data_reconciliation.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_kos_weekly.bp, url_prefix=API_PREFIX)
app.register_blueprint(investment_review.bp, url_prefix=API_PREFIX)
app.register_blueprint(upload.bp, url_prefix=API_PREFIX)
app.register_blueprint(webdav_backup.bp, url_prefix='/api/v1/webdav')
app.register_blueprint(version.bp, url_prefix='/api/v1/version')
# v3.5.8：SQLite ↔ PG 双向同步蓝图按开关条件注册（封存期默认不注册）
if top_config.CLOUD_SYNC_ENABLED:
    app.register_blueprint(data_sync.bp, url_prefix='/api/v1/data-sync')
    logger.info("✓ 数据同步蓝图已注册：CLOUD_SYNC_ENABLED=true")
else:
    logger.info("∘ 数据同步蓝图未注册（CLOUD_SYNC_ENABLED=false，需启用时在 .env 中设为 true）")
app.register_blueprint(system.bp)
app.register_blueprint(weekly_reports.bp)  # weekly_reports has url_prefix in blueprint
app.register_blueprint(app_market_report_blueprint.bp)
# v3.6.3: 应用市场 · 消耗和成本（URL prefix 已在蓝图定义: /api/v1/reports/app-market）
app.register_blueprint(app_market_cost_blueprint.bp)
# v3.7.3: 应用市场 · 归因转化率分析（URL prefix 已在蓝图定义: /api/v1/reports/app-market）
app.register_blueprint(app_market_attribution_blueprint.bp)
app.register_blueprint(app_market_ad_plan_blueprint.bp)
app.register_blueprint(omni_channel_report_blueprint.bp)
# v3.3.10: 小红书计划分析（URL prefix 已在蓝图定义: /api/v1/reports/xhs）
app.register_blueprint(xhs_plan_analysis_report_blueprint.bp)
# v4.1.9: 智能辅助诊断（URL prefix 已在蓝图定义: /api/v1/reports/diagnosis）
app.register_blueprint(diagnosis_report_blueprint.bp)
# v4.2.0: LLM 配置与智能分析（URL prefix 已在蓝图定义）
app.register_blueprint(llm_config.bp)
app.register_blueprint(llm_analysis_report_blueprint.bp)

# ============================================================================
# 鉴权中间件注册（feat-cloud-supabase）
# 必须放在所有蓝图 register 之后，before_request 才不会漏端点
# v3.5.8：AUTH_ENABLED=false 时中间件内部直接 return，不拦截任何请求
# ============================================================================
try:
    init_auth(app)
    if top_config.AUTH_ENABLED:
        logger.info("✓ 鉴权中间件已启用：所有 /api/v1/* 需 Bearer token（/auth/login 白名单）")
    else:
        logger.info("∘ 鉴权中间件已禁用（AUTH_ENABLED=false，无鉴权模式；需启用时在 .env 中设为 true）")
except Exception as e:
    logger.error(f"鉴权中间件注册失败：{e}")

# ============================================================================
# 数据库初始化（必须在所有 ORM 模型被 import 之后调用，否则 db.create_all()
# 看不到完整 metadata，会导致部分表（如 data_import_log）在全新数据库上不被创建）
# ============================================================================
with app.app_context():
    ensure_database_exists(app)

    # feat-local-auth 方案 A：首次启动创建默认 admin 账号
    # v3.5.8：仅在 AUTH_ENABLED=true 时创建（封存期无需建用户）
    if top_config.AUTH_ENABLED:
        try:
            from backend.models_v2 import AppUser
            from backend.auth.jwt_utils import hash_password
            from datetime import datetime
            if AppUser.query.count() == 0:
                import secrets
                admin_email = top_config.DEFAULT_ADMIN_EMAIL
                admin_password = top_config.DEFAULT_ADMIN_PASSWORD
                if not admin_password:
                    admin_password = secrets.token_urlsafe(12)
                    logger.warning(f"⚠ DEFAULT_ADMIN_PASSWORD 未配置，已生成随机密码（请妥善保存并尽快修改）")
                admin = AppUser(
                    email=admin_email,
                    password_hash=hash_password(admin_password),
                    display_name='管理员',
                    department='',
                    role='admin',
                    is_active=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.session.add(admin)
                db.session.commit()
                logger.info(f"✓ 默认 admin 账号已创建：{admin_email}（请尽快修改密码）")
                if not top_config.DEFAULT_ADMIN_PASSWORD:
                    logger.info(f"✓ 默认管理员初始密码：{admin_password}")
            else:
                logger.debug("app_users 表已有用户，跳过默认 admin 创建")
        except Exception as e:
            logger.warning(f"创建默认 admin 账号失败（忽略）：{e}")
            try:
                db.session.rollback()
            except Exception:
                pass
    else:
        logger.info("∘ 跳过默认 admin 账号创建（AUTH_ENABLED=false）")

# ============================================================================
# Swagger/OpenAPI 文档初始化
# 必须在所有 Blueprint 注册之后初始化，才能发现所有 API 端点
# ============================================================================
try:
    from backend.swagger_config import init_swagger
    swagger = init_swagger(app)
    logger.info("✓ Swagger API 文档已启用: http://127.0.0.1:5000/apidocs")
except ImportError as e:
    logger.warning(f"Swagger 未安装，跳过 API 文档初始化: {e}")
except Exception as e:
    logger.warning(f"Swagger 初始化失败: {e}")

# Debug: Log all registered routes
logger.info("已注册的路由:")
for rule in app.url_map.iter_rules():
    if rule.endpoint != 'static':
        methods_str = ', '.join(list(rule.methods))
        logger.info(f"  {methods_str:20} {rule.rule:50} -> {rule.endpoint}")


# v3.4.1: 启动时异步检测坚果云 vs 本地数据日期差
#   - 走 daemon 线程，不阻塞启动流程
#   - 连接失败只打 ERROR 日志，不影响正常使用
#   - 用户在前端「数据库备份」页或「数据新鲜度」组件中点击「立即同步」即可恢复
def _startup_check_webdav_sync():
    try:
        with app.app_context():
            from backend.routes.webdav_backup import _check_sync_status
            result = _check_sync_status()
            data = result.get('data') or {}
            if not data.get('cloud_available'):
                logger.info("启动检查: 坚果云不可达，跳过同步检测")
                return
            if data.get('need_sync'):
                logger.warning(
                    f"启动检查: 坚果云备份 {data.get('cloud_latest')} 比本地 {data.get('local_latest')} 新 "
                    f"({data.get('diff_hours')}h)，请在前端「数据库备份」页一键同步"
                )
            else:
                logger.info(
                    f"启动检查: 坚果云与本地数据日期一致 (本地 {data.get('local_latest')} / 云端 {data.get('cloud_latest')})"
                )
    except Exception as e:
        logger.error(f"启动检查异常: {e}")

import threading as _threading_v341
_thread_v341 = _threading_v341.Thread(target=_startup_check_webdav_sync, daemon=True)
_thread_v341.start()

# 后台自动更新调度（桌面版 frozen 自动启用；开发版/环境变量可关闭）。self-guard 幂等。
system.start_auto_update_scheduler()

# React Router SPA 兜底路由
# 通过 before_request 钩子处理，确保在所有其他路由之后检查
from flask import request, send_from_directory

@app.route('/assets/<path:filename>')
def serve_vite_assets(filename):
    """服务 Vite 构建的资源文件（CSS、JS chunks 等）"""
    response = send_from_directory(os.path.join(BASE_DIR, 'frontend-react', 'dist'), f'assets/{filename}')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/icons/<path:filename>')
def serve_icons(filename):
    """服务图标文件（React 侧边栏 Logo 等）"""
    response = send_from_directory(os.path.join(BASE_DIR, 'frontend-react', 'dist', 'icons'), filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.before_request
def serve_react_app():
    """React Router SPA 兜底路由 - 在所有路由匹配失败后处理"""
    from flask import make_response

    # 排除 API 路由
    if request.path.startswith('/api'):
        return None  # 继续其他匹配

    # 排除静态文件路由（由 Flask 内置 static 处理）
    if request.path.startswith('/static/') or request.path == '/favicon.ico':
        return None  # 继续其他匹配

    # 排除 Vite 构建资源路径（映射到 /static/...）
    if request.path.startswith('/assets/'):
        return None  # 继续其他匹配

    # 排除 Swagger 文档路由
    if request.path.startswith('/apidocs') or request.path.startswith('/flasgger') or request.path == '/oauth2-redirect.html':
        return None

    # 检查是否是已存在的路由（通过 url_map 检查）
    adapter = app.url_map.bind('127.0.0.1:5000')
    try:
        endpoint, values = adapter.match(request.path, method=request.method)
        # 找到了匹配的路由，不干预
        return None
    except Exception:
        # 没有匹配的路由，返回 index.html 让 React Router 处理
        pass

    # 返回 index.html
    index_path = os.path.join(app.template_folder, 'index.html')
    if os.path.exists(index_path):
        response = make_response(render_template('index.html'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    return "index.html not found", 404


# 错误处理
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '资源未找到'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"服务器错误: {error}")
    return jsonify({'error': '服务器内部错误'}), 500

def run_flask_server():
    """在后台线程运行Flask服务器"""
    app.run(
        host=HOST,
        port=PORT,
        debug=False,  # 后台运行时禁用debug模式
        use_reloader=False  # 禁用自动重载
    )

def start_with_webview():
    """使用嵌入式浏览器启动应用"""
    logger.info("=" * 60)
    logger.info("省心投 BI 系统启动中（嵌入式浏览器模式）...")
    logger.info(f"数据库路径: {DATABASE_PATH}")
    logger.info(f"后端地址: http://{HOST}:{PORT}")
    logger.info("=" * 60)

    # 在后台线程启动Flask服务器（非daemon，确保服务器运行）
    flask_thread = threading.Thread(target=run_flask_server, daemon=False)
    flask_thread.start()

    # 等待服务器启动并检查健康状态
    import requests
    max_retries = 10
    retry_count = 0

    logger.info("等待后端服务器启动...")
    while retry_count < max_retries:
        try:
            response = requests.get(f'http://{HOST}:{PORT}/api/health', timeout=1)
            if response.status_code == 200:
                logger.info("✓ 后端服务器启动成功！")
                break
        except:
            retry_count += 1
            if retry_count < max_retries:
                logger.info(f"等待后端启动... ({retry_count}/{max_retries})")
                time.sleep(1)

    if retry_count >= max_retries:
        logger.warning("后端服务器启动超时，但将继续启动窗口")

    # 获取图标路径（支持便携版和开发版）
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境
        base_dir = os.path.dirname(sys.executable)
    else:
        # 开发环境
        base_dir = os.path.abspath(os.path.dirname(__file__))

    icon_path = os.path.join(base_dir, 'icon', 'LOGO.ico')

    # 检查图标文件是否存在
    if os.path.exists(icon_path):
        logger.info(f"使用窗口图标: {icon_path}")
    else:
        logger.warning(f"图标文件不存在: {icon_path}，将使用默认图标")
        icon_path = None

    # 创建webview窗口
    webview.create_window(
        title='省心投 BI',
        url=f'http://{HOST}:{PORT}',
        width=1400,
        height=900,
        resizable=True,
        fullscreen=False,
        min_size=(1024, 768)
        # 注意：部分webview版本不支持icon参数，已移除
    )

    # 启动webview（阻塞主线程）
    webview.start()

if __name__ == '__main__':
    # 根据是否安装pywebview选择启动模式
    if USE_WEBVIEW:
        # 打包后的exe使用嵌入式浏览器
        start_with_webview()
    else:
        # 开发环境使用标准Flask服务器
        logger.info("=" * 60)
        logger.info("省心投 BI 系统启动中...")
        logger.info(f"数据库路径: {DATABASE_PATH}")
        logger.info(f"访问地址: http://{HOST}:{PORT}")
        logger.info("=" * 60)

        app.run(
            host=HOST,
            port=PORT,
            debug=DEBUG
        )
