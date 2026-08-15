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
# v3.3.10: 把 DimAnchorLiveType 提到顶层 import，避免 _sync_anchor_live_types_from_json
# 异常时 except 分支访问不到该名字，同时让 db.create_all() 能在更早时机注册到 metadata
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
# SQLite 性能优化配置
# ============================================================================

def configure_sqlite_optimization():
    """配置SQLite性能优化参数（WAL模式、缓存、同步模式）

    feat-cloud-supabase：仅当当前 dialect 为 sqlite 时挂 PRAGMA 监听器。
    Postgres 下挂 SQLite PRAGMA 会触发 'PRAGMA is not supported' 异常或被忽略。
    """
    # dialect 来自 top_config.DATABASE_DIALECT（feat-cloud-supabase）
    if top_config.DATABASE_DIALECT != 'sqlite':
        logger.info(f"当前数据库 dialect='{top_config.DATABASE_DIALECT}'，跳过 SQLite PRAGMA 配置")
        return
    try:
        from sqlalchemy import event
        from sqlalchemy.engine import Engine

        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            """设置SQLite PRAGMA参数以提升性能"""
            # 跳过非 SQLite 连接（避免 PG 等其他库执行 PRAGMA 报错）
            if 'sqlite' not in (dbapi_conn.__class__.__module__ or ''):
                return

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

def _sync_anchor_live_types_from_json():
    """v3.3.0: 从 backend/config/anchor_live_types.json 同步映射到 dim_anchor_live_type 表。

    JSON 是权威源（随 git 走），DB 表是查询缓存。每次启动都 upsert：
      - JSON 有 DB 无 → 插入
      - JSON 有 DB 有 → 更新 anchor_name/live_type/remark/is_active=1
      - JSON 无 DB 有 → 标记为 is_active=0（不删除，保留历史）
    返回 upsert 的行数（插入 + 更新 + 软删除）。
    """
    import json
    from datetime import datetime
    # DimAnchorLiveType / db 已在 app.py 顶层 import，这里无需重复

    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               'backend', 'config', 'anchor_live_types.json')
    if not os.path.exists(config_path):
        logger.warning(f"主播直播类型映射 JSON 不存在: {config_path}")
        return 0

    with open(config_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    mappings = data.get('mappings') or []
    if not mappings:
        return 0

    now = datetime.utcnow()
    json_tokens = {m['source_token'] for m in mappings}

    # 查询现有数据
    existing = {r.source_token: r for r in db.session.query(DimAnchorLiveType).all()}

    changes = 0
    # 1. upsert JSON 中的 token
    for m in mappings:
        tok = m['source_token']
        row = existing.get(tok)
        if row is None:
            db.session.add(DimAnchorLiveType(
                source_token=tok,
                anchor_name=m['anchor_name'],
                live_type=m['live_type'],
                remark=m.get('remark'),
                is_active=1,
                updated_at=now,
            ))
            changes += 1
        else:
            if (row.anchor_name != m['anchor_name']
                    or row.live_type != m['live_type']
                    or (row.remark or None) != (m.get('remark') or None)
                    or row.is_active != 1):
                row.anchor_name = m['anchor_name']
                row.live_type = m['live_type']
                row.remark = m.get('remark')
                row.is_active = 1
                row.updated_at = now
                changes += 1

    # 2. JSON 无 DB 有 → 软删除（is_active=0）
    for tok, row in existing.items():
        if tok not in json_tokens and row.is_active == 1:
            row.is_active = 0
            row.updated_at = now
            changes += 1

    if changes > 0:
        db.session.commit()
    return changes


def _migrate_qingniao_batch_tag():
    """v3.3.6: fact_qingniao_leads 表加 `批次标注` 列 + 修复 id 列为 PRIMARY KEY AUTOINCREMENT。

    背景：
    - 历史表由 pandas to_sql 创建，id 列没有 PRIMARY KEY AUTOINCREMENT 约束。
    - append 模式下 drop id 列后，新数据 id 全为 NULL，导致 SQLAlchemy ORM 无法加载对象
      （主键为 NULL → 返回 None 对象，访问属性报错 'NoneType' has no attribute ...）。
    - 修复方案：重建表为 `id INTEGER PRIMARY KEY AUTOINCREMENT`，历史数据自动生成 id。

    幂等：列已存在且 id 已是 PRIMARY KEY 时跳过。

    feat-cloud-supabase：SQLite 专属 ALTER/重建只在历史 SQLite db 上需要；Postgres 全新库
    上 db.create_all() 已经建好所有列，跳过整段逻辑。
    """
    if top_config.DATABASE_DIALECT != 'sqlite':
        logger.info(f"跳过 _migrate_qingniao_batch_tag：dialect='{top_config.DATABASE_DIALECT}' 不需要 SQLite 表重建")
        return
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if not inspector.has_table('fact_qingniao_leads'):
        return  # 表本身不存在，create_all 之后会带新列创建

    # 1. 加批次标注列（幂等）
    cols = [c['name'] for c in inspector.get_columns('fact_qingniao_leads')]
    if '批次标注' not in cols:
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE fact_qingniao_leads ADD COLUMN \"批次标注\" TEXT"))
            conn.execute(text("UPDATE fact_qingniao_leads SET \"批次标注\" = 'legacy' WHERE \"批次标注\" IS NULL"))
        logger.info("✓ fact_qingniao_leads 已新增 `批次标注` 列（旧数据补默认值 'legacy'）")
        # 重新检查列定义
        inspector = inspect(db.engine)
        cols = [c['name'] for c in inspector.get_columns('fact_qingniao_leads')]

    # 2. 加索引（幂等）
    with db.engine.begin() as conn:
        try:
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_fact_qingniao_leads_batch ON fact_qingniao_leads("批次标注")'))
        except Exception:
            pass

    # 3. 修复 id 列为 PRIMARY KEY AUTOINCREMENT（幂等）
    #    SQLite 不支持 ALTER 列属性，需要重建表
    pk_cols = inspector.get_pk_constraint('fact_qingniao_leads')['constrained_columns'] or []
    if 'id' in pk_cols:
        return  # id 已是主键，无需重建

    logger.warning("fact_qingniao_leads.id 列不是 PRIMARY KEY，开始重建表结构...")

    # 步骤：
    # a. 临时表（带正确主键）→ b. 复制数据（NULL id 自动生成）→ c. drop 旧表 → d. rename
    # 注意：SQLite 中只有 `INTEGER PRIMARY KEY` 才是 ROWID 别名 + AUTOINCREMENT，
    #       `BIGINT PRIMARY KEY` 不是，所以必须用 INTEGER 而非 BIGINT。
    from backend.models_v2 import FactQingniaoLeads
    orm_cols = [c.name for c in FactQingniaoLeads.__table__.columns]
    # 去掉 id（让新表 AUTOINCREMENT 处理）
    data_cols = [c for c in orm_cols if c != 'id']
    # 用双引号包裹中文列名 + 含空格的列名
    def q(name):
        return f'"{name}"'
    data_cols_sql = ', '.join(q(c) for c in data_cols)

    with db.engine.begin() as conn:
        # a. 创建临时表（id 用 INTEGER PRIMARY KEY AUTOINCREMENT，其他列保持原类型）
        #    先 drop 临时表（如果上次迁移失败留下的残留）
        conn.execute(text('DROP TABLE IF EXISTS _fact_qingniao_leads_new'))
        # 用 ORM 列定义拼出 CREATE TABLE 语句
        # 列类型映射：BigInteger/BIGINT → TEXT/REAL/INTEGER 由原表决定，
        #   为简化直接用 TEXT 容纳所有字符串/数字（SQLite 是动态类型）
        col_defs = ['id INTEGER PRIMARY KEY AUTOINCREMENT']
        for c in FactQingniaoLeads.__table__.columns:
            if c.name == 'id':
                continue
            col_defs.append(f'{q(c.name)} TEXT')
        create_sql = f'CREATE TABLE _fact_qingniao_leads_new ({", ".join(col_defs)})'
        conn.execute(text(create_sql))
        # b. 复制数据（旧表的 NULL id 会被忽略，新表用 AUTOINCREMENT 生成）
        conn.execute(text(
            f'INSERT INTO _fact_qingniao_leads_new ({data_cols_sql}) '
            f'SELECT {data_cols_sql} FROM fact_qingniao_leads'
        ))
        # 统计行数
        n_old = conn.execute(text('SELECT COUNT(*) FROM fact_qingniao_leads')).scalar()
        # c. drop 旧表
        conn.execute(text('DROP TABLE fact_qingniao_leads'))
        # d. rename 临时表
        conn.execute(text('ALTER TABLE _fact_qingniao_leads_new RENAME TO fact_qingniao_leads'))
        # 重建索引
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_fact_qingniao_leads_batch ON fact_qingniao_leads("批次标注")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_fact_qingniao_leads_nickname ON fact_qingniao_leads("微信线索昵称")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_fact_qingniao_leads_date ON fact_qingniao_leads("日期")'))
        # 更新 sqlite_sequence 让后续 AUTOINCREMENT 接着最大 id 递增
        max_id = conn.execute(text('SELECT MAX(id) FROM fact_qingniao_leads')).scalar() or 0
        conn.execute(text("DELETE FROM sqlite_sequence WHERE name='fact_qingniao_leads'"))
        conn.execute(text(f"INSERT INTO sqlite_sequence(name, seq) VALUES('fact_qingniao_leads', {max_id})"))
        logger.info(f"✓ fact_qingniao_leads 表已重建（id 改为 INTEGER PRIMARY KEY AUTOINCREMENT，{n_old} 行数据已迁移）")


def _reset_pg_sequences():
    """feat-cloud-supabase：重置 PostgreSQL 所有自增序列到 MAX(id)。

    背景：从 SQLite 迁移数据到 PG 时，数据 INSERT 带了显式 id 值，
    但 PG 的 SERIAL/BIGSERIAL 序列不会自动前进。下次 ORM INSERT（不指定 id）
    会从序列当前值（可能是 1）生成 id，跟已迁移的行主键冲突，报
    UniqueViolation: duplicate key value violates unique constraint "<table>_pkey"。

    修复：对每张有 SERIAL id 列的表执行
      SELECT setval(pg_get_serial_sequence('<table>', 'id'), GREATEST(MAX(id), 1)) FROM <table>;

    幂等：setval 可以重复执行，不会报错。
    SQLite 下跳过（SQLite AUTOINCREMENT 跟随 ROWID 自动前进，不存在此问题）。
    """
    if top_config.DATABASE_DIALECT != 'postgresql':
        return
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    # 扫描所有表，找有 id 列且有 SERIAL 序列的表
    reset_tables = []
    for tbl_name in inspector.get_table_names():
        try:
            seq_sql = "SELECT pg_get_serial_sequence(:t, 'id')"
            seq_name = db.session.execute(text(seq_sql), {'t': tbl_name}).scalar()
            if seq_name:
                reset_tables.append(tbl_name)
        except Exception:
            continue  # 该表无 id 列或无序列，跳过
    if not reset_tables:
        return
    with db.engine.begin() as conn:
        for tbl in reset_tables:
            # setval(seq, MAX(id))；空表时设为 1（下次 INSERT 从 1 开始）
            conn.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), "
                f"GREATEST((SELECT COALESCE(MAX(id), 1) FROM \"{tbl}\"), 1))"
            ))
    logger.info(f"✓ PostgreSQL 自增序列已重置到 MAX(id)（{len(reset_tables)} 张表）")


def ensure_database_exists():
    """确保数据库和所有表存在

    feat-cloud-supabase：dialect 不为 sqlite 时跳过本地 db 文件存在性检查；
    '业务表存在且有内容' 的安全网仍打 WARN，但不会阻塞启动（不强制迁移历史数据）。
    """
    try:
        database_path = DATABASE_PATH
        # feat-cloud-supabase：当前 dialect 与 URI 在启动日志显式打出，便于排查
        # 使用 top_config 别名，避免被 from backend.routes import config 覆盖
        logger.info(f"✓ 数据库接入: dialect='{top_config.DATABASE_DIALECT}' uri=<redacted>")

        # 仅 SQLite 需要检查本地 db 文件
        if top_config.DATABASE_DIALECT == 'sqlite':
            # 检查数据库文件是否存在
            if not os.path.exists(database_path):
                logger.info("数据库文件不存在，正在创建...")

                # 确保数据库目录存在
                db_dir = os.path.dirname(database_path)
                if db_dir and not os.path.exists(db_dir):
                    os.makedirs(db_dir)
                    logger.info(f"创建数据库目录: {db_dir}")
            else:
                logger.info(f"数据库文件已存在: {database_path}")
        else:
            # Postgres：直接走 db.create_all；不存在不会自动建库，需要 supabase 控制台先建 PG 实例
            logger.info(
                f"Postgres 模式：跳过本地文件检查。请确认 Supabase 项目里已经"
                f"存在数据库（Free 计划默认会自动建库，无需手动建）。"
            )

        # create_all 幂等：已存在的表不受影响，新表会自动创建
        with app.app_context():
            db.create_all()
            logger.info("✓ 数据库表结构已就绪")

            # v3.7.0：开启 SQLite auto_vacuum=INCREMENTAL（仅对 sqlite dialect 生效）
            # 必要性：default auto_vacuum=0 让 DELETE/REPLACE 后的死页永远占着空间，
            #         频繁导入（conversion_appmarket / vendor_daily）会让库快速膨胀。
            # 选项值是 db header 常量，持久化后无需每次重设。
            #   0 = NONE        —— 不回收（默认）
            #   1 = FULL        —— 自动 VACUUM 整库（成本高，禁用）
            #   2 = INCREMENTAL —— 死页加入 freelist，新写入自动复用，写操作零成本
            # 局限：SQLite 限制 auto_vacuum 改动必须在空库或 VACUUM 后才生效。
            #       老库若 auto_vacuum=0，需要手动跑一次 scripts/vacuum_db.py 切到 INCREMENTAL；
            #       新库（本次 commit 之后首次创建）从一开始就进入 INCREMENTAL 模式。
            if top_config.DATABASE_DIALECT == 'sqlite':
                try:
                    from sqlalchemy import text as _text
                    db.session.execute(_text("PRAGMA auto_vacuum = INCREMENTAL"))
                    db.session.commit()
                    logger.info("✓ SQLite auto_vacuum=INCREMENTAL 已开启")
                except Exception as _e:
                    logger.warning(f"auto_vacuum 切换失败（可忽略，老库需手动跑 scripts/vacuum_db.py）: {_e}")

            # v3.3.0: 主播直播类型映射同步（JSON 权威源 → DB 缓存，每次启动都 upsert）
            # v3.3.10: 同步失败时记录 ERROR 级别日志 + 二次校验表是否为空，避免静默失败导致
            #          直播获客报表全 0 而用户毫无察觉
            try:
                synced = _sync_anchor_live_types_from_json()
                if synced > 0:
                    logger.info(f"✓ 主播直播类型映射已同步: {synced} 条")
                else:
                    # 二次校验：表里必须有 active 数据，否则直播获客报表会全 0
                    from sqlalchemy import func as _func
                    active_count = db.session.query(_func.count(DimAnchorLiveType.id)).filter(
                        DimAnchorLiveType.is_active == 1
                    ).scalar() or 0
                    if active_count == 0:
                        logger.error(
                            "⚠ 主播直播类型映射表为空！直播获客报表将全 0。"
                            "请检查 backend/config/anchor_live_types.json 是否存在且格式正确。"
                        )
                    else:
                        logger.info(f"✓ 主播直播类型映射已就绪（{active_count} 条 active，本次无变化）")
            except Exception as e:
                import traceback
                logger.error(f"主播直播类型映射同步失败（直播获客报表将全 0）: {e}")
                logger.error(traceback.format_exc())

            # v3.3.6: fact_qingniao_leads 批次标注列迁移
            #   create_all 不会给已存在的表加列，需要手动 ALTER TABLE
            #   旧数据补默认值 'legacy'，便于后续按批次筛选（与新版区分开）
            try:
                _migrate_qingniao_batch_tag()
            except Exception as e:
                logger.warning(f"fact_qingniao_leads 批次标注列迁移失败（不影响启动）: {e}")

            # feat-cloud-supabase：重置 PG 自增序列到 MAX(id)
            #   从 SQLite 迁移数据后，PG SERIAL 序列不会自动前进，
            #   导致 ORM INSERT 时主键冲突（data_import_log_pkey 等）
            try:
                _reset_pg_sequences()
            except Exception as e:
                logger.warning(f"PG 自增序列重置失败（可能导致主键冲突）: {e}")

            # 记录数据库文件位置
            logger.info(f"✓ 数据库位置: {database_path}")

    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        raise

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
from backend.routes import metadata, upload, config, webdav_backup, version
from backend.routes.system import self_update as system
from backend.routes.system import data_sync

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
from backend.routes.reports import omni_channel as omni_channel_report_blueprint
# v3.3.10: 小红书计划分析（仿应用市场 /plan-analysis，数据源 fact_conv_content）
from backend.routes.reports import xhs_plan_analysis as xhs_plan_analysis_report_blueprint

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
app.register_blueprint(trend.bp, url_prefix=API_PREFIX)
app.register_blueprint(agency_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_notes.bp, url_prefix=API_PREFIX)
app.register_blueprint(cost_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(external_analysis.bp, url_prefix=API_PREFIX)
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
app.register_blueprint(omni_channel_report_blueprint.bp)
# v3.3.10: 小红书计划分析（URL prefix 已在蓝图定义: /api/v1/reports/xhs）
app.register_blueprint(xhs_plan_analysis_report_blueprint.bp)

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
    ensure_database_exists()

    # feat-local-auth 方案 A：首次启动创建默认 admin 账号
    # v3.5.8：仅在 AUTH_ENABLED=true 时创建（封存期无需建用户）
    if top_config.AUTH_ENABLED:
        try:
            from backend.models_v2 import AppUser
            from backend.auth.jwt_utils import hash_password
            from datetime import datetime
            if AppUser.query.count() == 0:
                admin_email = top_config.DEFAULT_ADMIN_EMAIL
                admin_password = top_config.DEFAULT_ADMIN_PASSWORD
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
