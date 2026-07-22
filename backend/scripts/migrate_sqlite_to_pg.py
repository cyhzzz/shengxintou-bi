"""一次性数据迁移：SQLite → Supabase Postgres。

运行：
    python -m backend.scripts.migrate_sqlite_to_pg [--dry-run] [--skip-tables=t1,t2]

设计原则：
    1. 全程 sqlalchemy，跨 dialect 友好
    2. 用 df.to_sql 的可定制版本（每批 1000 行 executemany）以避免 SQL 长度超限
    3. NaN / None / 空串统一写 NULL（PG 不能接 SQLite 的 '' 当数值）
    4. user_profiles 不迁：UUID 列存不下 SQLite 里的本地 user.id 字符串，登录后会自动建
    5. dim_anchor_live_type 不迁：启动期已 JSON 同步过，幂等
    6. system_configuration 不迁：本地值与云端可能不同；如需迁改用 spec 后续
"""
import argparse
import os
import sys
import logging
from typing import List, Dict, Any

# 确保项目根目录在 sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# 启动期先把 DATABASE_URL 临时切回 sqlite 以便读源库
# 然后再切回 PG 当目标库
os.environ.pop('DATABASE_URL', None)
import config as top_config
# 我们要读的是本地 SQLite 文件（不走 DATABASE_URL），独立建 engine
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
import pandas as pd
import math

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
log = logging.getLogger('migrate')


# 这些表跳过迁移，原因见 docstring
SKIP_TABLES = {
    'user_profiles',        # UUID 列存不下本地 user.id 字符串；登录后会自动建
    'dim_anchor_live_type', # 启动期已 JSON 同步过
    'system_configuration', # 配置可能与云端默认不同，留本地兜底
}


def sqlite_engine() -> Engine:
    path = top_config.DATABASE_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(f'本地 SQLite 不存在: {path}')
    return create_engine(f'sqlite:///{path}', connect_args={'timeout': 30})


def pg_engine() -> Engine:
    uri = top_config.SQLALCHEMY_DATABASE_URI
    if not uri or uri.startswith('sqlite:'):
        raise RuntimeError('当前 config.SQLALCHEMY_DATABASE_URI 指向 SQLite，请检查 .env DATABASE_URL')
    return create_engine(uri, connect_args={'connect_timeout': 30}, pool_pre_ping=True)


def list_tables(src: Engine) -> List[str]:
    with src.connect() as c:
        if src.dialect.name == 'sqlite':
            rows = c.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )).fetchall()
        else:
            rows = c.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
            )).fetchall()
    return [r[0] for r in rows]


def normalize_value(v: Any) -> Any:
    """NaN/NaT/Inf/-Inf/None → None；空串视情况（保留为字符串）。"""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, pd.Timestamp):
        if pd.isna(v):
            return None
        return v.to_pydatetime()
    if pd.isna(v):  # 涵盖 numpy.NaT / NaN
        return None
    return v


def migrate_table(src: Engine, dst: Engine, table: str, dry_run: bool = False) -> int:
    """把 SQLite 的 table 全表迁移到 PG。

    流程：
        1) pandas.read_sql 读 SQLite
        2) 对每行 normalize_value
        3) executemany 批量插入 PG（每批 1000 行）
        4) 目标表 TRUNCATE 在前（幂等）

    返回：迁移行数
    """
    log.info(f'--- 开始迁移表: {table} ---')

    # 1) 读源表
    df = pd.read_sql_table(table, src)
    n_rows = len(df)
    log.info(f'  读源表行数={n_rows}, 列数={len(df.columns)}')
    if n_rows == 0:
        log.info('  跳过（空表）')
        return 0

    # 2) 归一化 + 转 dict 列表（SQLAlchemy 2.x executemany 要求 list of dict）
    #    中文列名不能直接当 :name 占位符，故映射成 p0/p1/...
    cols = list(df.columns)
    records = []
    for row in df.itertuples(index=False, name=None):
        rec = {f'p{i}': normalize_value(v) for i, v in enumerate(row)}
        records.append(rec)
    placeholders = ', '.join([f':p{i}' for i in range(len(cols))])
    quoted_cols = ', '.join([f'"{c}"' for c in cols])
    quoted_table = f'"{table}"'
    sql = f'INSERT INTO {quoted_table} ({quoted_cols}) VALUES ({placeholders})'

    # 3) 写目标
    if dry_run:
        log.info('  [DRY-RUN] 跳过写入')
        return n_rows

    with dst.begin() as conn:
        # 清空目标（保证幂等；后续可改成 UPSERT）
        try:
            conn.execute(text(f'TRUNCATE TABLE {quoted_table} RESTART IDENTITY'))
        except Exception as e:
            log.warning(f'  TRUNCATE 失败（首次迁移可忽略）: {e}')

        batch = 1000
        for i in range(0, len(records), batch):
            chunk = records[i:i + batch]
            try:
                conn.execute(text(sql), chunk)
            except Exception as e:
                log.error(f'  插入批次 {i // batch + 1} 失败（{len(chunk)} 行）: {e}')
                raise
            log.info(f'  已写入 {min(i + batch, len(records))} / {len(records)}')

    return n_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='只读不写')
    ap.add_argument('--skip-tables', default='', help='逗号分隔额外跳过表')
    ap.add_argument('--only-tables', default='', help='逗号分隔只迁这些表')
    args = ap.parse_args()

    skip_extra = set(t.strip() for t in args.skip_tables.split(',') if t.strip())
    only = set(t.strip() for t in args.only_tables.split(',') if t.strip())

    src = sqlite_engine()
    dst = pg_engine()
    src_tables = list_tables(src)
    dst_tables = set(list_tables(dst))
    log.info(f'SQLite 表: {src_tables}')
    log.info(f'PG 目标表存在: {sorted(dst_tables)}')

    total = 0
    for t in src_tables:
        if t in SKIP_TABLES:
            log.info(f'跳过 {t}（默认排除）')
            continue
        if t in skip_extra:
            log.info(f'跳过 {t}（--skip-tables 显式排除）')
            continue
        if only and t not in only:
            log.info(f'跳过 {t}（不在 --only-tables 名单内）')
            continue
        if t not in dst_tables:
            log.warning(f'跳过 {t}（PG 里不存在该表，先运行 db.create_all()）')
            continue
        try:
            n = migrate_table(src, dst, t, dry_run=args.dry_run)
            total += n
        except Exception as e:
            log.error(f'迁移 {t} 失败：{e}')
            sys.exit(1)

    log.info(f'=== 全部完成，总迁移行数: {total} ===')


if __name__ == '__main__':
    main()