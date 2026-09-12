# -*- coding: utf-8 -*-
"""省心投 BI - 数据库引导与迁移

从 app.py 原样搬出的数据库启动逻辑，app.py 只保留 Flask 装配。职责：
  - configure_sqlite_optimization: SQLite PRAGMA 性能优化（仅 sqlite dialect）
  - _sync_anchor_live_types_from_json: 主播映射 JSON 权威源 → DB 缓存 upsert
  - _migrate_qingniao_batch_tag: 青鸟线索表历史结构迁移（SQLite 专属）
  - _reset_pg_sequences: PG 自增序列重置到 MAX(id)
  - ensure_database_exists: 建库建表 + 复合索引 + 依次调度上述引导步骤

纯搬家：函数体与调用时序与搬出前一致，行为不变。
调用时序约束（由 app.py 保证）：
  1. configure_sqlite_optimization() 在 db.init_app(app) 之后立即调用；
  2. ensure_database_exists(app) 必须在所有蓝图（ORM 模型）import 之后调用，
     否则 db.create_all() 看不到完整 metadata，部分表不会被创建。
"""

import os
import logging

import config as top_config  # 顶层 config 模块；backend.routes 下的 config 是另一个模块
from backend.database import db
from backend.models_v2 import DimAnchorLiveType

logger = logging.getLogger(__name__)


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
    # DimAnchorLiveType / db 已在模块顶层 import

    # 本模块位于 backend/ 下，config/ 与本文件同目录
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               'config', 'anchor_live_types.json')
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


def ensure_database_exists(app):
    """确保数据库和所有表存在

    feat-cloud-supabase：dialect 不为 sqlite 时跳过本地 db 文件存在性检查；
    '业务表存在且有内容' 的安全网仍打 WARN，但不会阻塞启动（不强制迁移历史数据）。

    app: Flask 应用实例。db.create_all() 等需要在 app context 中执行，
    由调用方传入（搬出 app.py 后不再依赖全局 app 引用）。
    """
    try:
        database_path = top_config.DATABASE_PATH
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

            # v4.1.x：广告计划分析聚合性能 —— 为 fact_conv_appmarket 加复合索引，加速
            # 「按 应用市场 + 资金账号创建完成时间」与「按 广告计划ID + 资金账号创建完成时间」
            # 的分组聚合（广告计划分析报表对这张大表做多次 group by 及 COUNT(DISTINCT 设备号)）。
            # CREATE INDEX IF NOT EXISTS 幂等，SQLite / Postgres 均可执行，对已存在库也生效。
            try:
                from sqlalchemy import text as _idx_text
                with db.engine.begin() as _conn:
                    _conn.execute(_idx_text(
                        'CREATE INDEX IF NOT EXISTS ix_fact_conv_appmarket_market_acct_time '
                        'ON fact_conv_appmarket("应用市场", "资金账号创建完成时间")'
                    ))
                    _conn.execute(_idx_text(
                        'CREATE INDEX IF NOT EXISTS ix_fact_conv_appmarket_plan_acct_time '
                        'ON fact_conv_appmarket("广告计划ID", "资金账号创建完成时间")'
                    ))
                logger.info("✓ fact_conv_appmarket 复合索引已就绪（market/plan × 资金账号创建完成时间）")
            except Exception as _idx_e:
                logger.warning(f"fact_conv_appmarket 索引创建失败（不影响启动，报表可能偏慢）: {_idx_e}")

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
