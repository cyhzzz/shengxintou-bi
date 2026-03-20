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
from config import *
from backend.database import db

# 修复：在便携Python环境中，将lib目录添加到sys.path
# 这样即使PYTHONPATH环境变量不生效，也能正常导入第三方库
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # PyInstaller打包后的环境，使用exe所在目录
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
    # PyInstaller打包后的环境，使用exe所在目录
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

# CORS配置 - 使用Flask-CORS扩展（推荐）
CORS(app, resources={r"/api/*": {"origins": "*", "headers": "Content-Type,Authorization", "methods": "GET,PUT,POST,DELETE,OPTIONS", "supports_credentials": True}})

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

# 初始化数据库
db.init_app(app)

# ============================================================================
# SQLite 性能优化配置
# ============================================================================

def configure_sqlite_optimization():
    """配置SQLite性能优化参数（WAL模式、缓存、同步模式）"""
    try:
        from sqlalchemy import event
        from sqlalchemy.engine import Engine

        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            """设置SQLite PRAGMA参数以提升性能"""
            cursor = dbapi_conn.cursor()

            # 更改为传统模式，避免WAL模式导致的数据库损坏问题
            # WAL模式虽然提高了并发性能，但在某些情况下可能导致数据库损坏
            cursor.execute("PRAGMA journal_mode=DELETE")

            # 设置缓存大小（-100000表示约100MB）
            # 默认是2000页（约8MB），增大缓存可显著提升查询性能
            cursor.execute("PRAGMA cache_size=-100000")

            # 设置同步模式为NORMAL
            # WAL模式下NORMAL足够安全，且性能更好
            cursor.execute("PRAGMA synchronous=NORMAL")

            # 启用临时存储在内存中
            cursor.execute("PRAGMA temp_store=MEMORY")

            # 设置繁忙超时（5秒）
            # 避免并发访问时快速失败
            cursor.execute("PRAGMA busy_timeout=5000")

            cursor.close()

        logger.info("SQLite性能优化配置已启用: 传统模式 + 100MB缓存 + NORMAL同步")
    except Exception as e:
        logger.warning(f"SQLite性能优化配置失败: {e}")

# 在数据库初始化后立即配置优化
with app.app_context():
    configure_sqlite_optimization()

def ensure_database_exists():
    """确保数据库和所有表存在"""
    try:
        database_path = DATABASE_PATH

        # 检查数据库文件是否存在
        if not os.path.exists(database_path):
            logger.info("数据库文件不存在，正在创建...")

            # 确保数据库目录存在
            db_dir = os.path.dirname(database_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir)
                logger.info(f"创建数据库目录: {db_dir}")

            # 创建所有表
            with app.app_context():
                db.create_all()
                logger.info("✓ 数据库表创建成功!")

                # 记录数据库文件位置
                logger.info(f"✓ 数据库位置: {database_path}")
        else:
            logger.info(f"数据库文件已存在: {database_path}")

    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        raise

# 应用启动前确保数据库存在
with app.app_context():
    ensure_database_exists()

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
    return jsonify({
        'status': 'ok',
        'message': '省心投 BI 系统运行正常',
        'version': '1.0.0'
    })

# 注册API路由
from backend.routes import metadata, upload, config, aggregation, feishu_sync, webdav_backup, xhs_note_info, version

# Import weekly_reports module
from backend.routes import weekly_reports

# 导入拆分后的数据模块
from backend.routes.data import (
    query,
    dashboard,
    trend,
    agency_analysis,
    xhs_notes,
    cost_analysis,
    external_analysis,
    leads,
    account_mapping,
    abbreviation_mapping,
    xhs_operation,
    employee_conversion,
    weekly_report_poster
)

# 注意：已移除模块缓存清除和reload逻辑，避免"module not in sys.modules"错误
# 如需重新加载代码，请重启服务器

app.register_blueprint(metadata.bp, url_prefix=API_PREFIX)

# 注册所有拆分后的数据模块Blueprint
app.register_blueprint(query.bp, url_prefix=API_PREFIX)
app.register_blueprint(dashboard.bp, url_prefix=API_PREFIX)
app.register_blueprint(trend.bp, url_prefix=API_PREFIX)
app.register_blueprint(agency_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_notes.bp, url_prefix=API_PREFIX)
app.register_blueprint(cost_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(external_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(leads.bp, url_prefix=API_PREFIX)
app.register_blueprint(account_mapping.bp, url_prefix=API_PREFIX)
app.register_blueprint(abbreviation_mapping.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_operation.bp, url_prefix=API_PREFIX)
app.register_blueprint(employee_conversion.bp, url_prefix=API_PREFIX)
app.register_blueprint(weekly_report_poster.bp, url_prefix=API_PREFIX)

# 其他Blueprint
app.register_blueprint(upload.bp, url_prefix=API_PREFIX)
app.register_blueprint(config.bp)
app.register_blueprint(aggregation.bp, url_prefix=API_PREFIX)
app.register_blueprint(feishu_sync.bp, url_prefix='/api/v1/feishu')
app.register_blueprint(webdav_backup.bp, url_prefix='/api/v1/webdav')
app.register_blueprint(xhs_note_info.bp, url_prefix=API_PREFIX + '/xhs-note-info')
app.register_blueprint(version.bp, url_prefix='/api/v1/version')
app.register_blueprint(weekly_reports.bp)  # weekly_reports has url_prefix in blueprint

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

# React Router SPA 兜底路由
# 通过 before_request 钩子处理，确保在所有其他路由之后检查
from flask import request, send_from_directory

# 旧版 JS 静态文件路由（新版前端混合模式依赖）
@app.route('/js/<path:filename>')
def serve_legacy_js(filename):
    """服务旧版 JS 文件"""
    response = send_from_directory(os.path.join(BASE_DIR, 'frontend-react', 'dist'), f'js/{filename}')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/libs/<path:filename>')
def serve_legacy_libs(filename):
    """服务旧版 libs 文件"""
    response = send_from_directory(os.path.join(BASE_DIR, 'frontend-react', 'dist'), f'libs/{filename}')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

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

    # 排除旧版 JS 路由（新版前端混合模式依赖）
    if request.path.startswith('/js/') or request.path.startswith('/libs/'):
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
