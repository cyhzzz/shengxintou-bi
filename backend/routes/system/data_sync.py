# -*- coding: utf-8 -*-
"""数据双向同步 API（SQLite ↔ Supabase PG）

为「数据同步」页面提供手动双向同步功能。
- 本地开发版主库走 SQLite，CLOUD_DATABASE_URL 指向 Supabase PG
- 桌面版主库已走 PG，CLOUD_DATABASE_URL 不设时同步功能自动隐藏

同步策略：
- 上传（SQLite → PG）：DELETE + 批量 INSERT（PG 用 COPY 更快）
- 下载（PG → SQLite）：DELETE + to_sql(replace)
- 跳过表：user_profiles / dim_anchor_live_type / system_configuration（本地与云端各自维护）
"""
import io
import math
import logging
from flask import Blueprint, jsonify, request
from sqlalchemy import create_engine, text
import pandas as pd

from backend.utils.decorators import handle_exceptions
import config as app_config

bp = Blueprint('data_sync', __name__)
log = logging.getLogger(__name__)

# 跳过同步的表（与 migrate_sqlite_to_pg.py 一致）
SKIP_TABLES = {
    'user_profiles',        # UUID 列；登录后自动建
    'dim_anchor_live_type', # 启动期从 JSON 同步
    'system_configuration', # 本地配置可能与云端不同
    'app_users',            # 密码 hash 不同步
    'import_history',       # 导入历史各自维护
}

# 业务表清单（有序，外键依赖优先）
BIZ_TABLES = [
    'dim_account',
    'fact_conv_content',
    'fact_conv_appmarket',
    'agg_vendor_daily',
    'agg_xhs_note',
    'agg_daily_channel_open',
    'fact_qingniao_leads',
]


def _get_engines():
    """返回 (local_engine, cloud_engine, local_is_pg)。
    local_engine = 当前主库；cloud_engine = CLOUD_DATABASE_URL 指向的库。
    """
    local_uri = app_config.SQLALCHEMY_DATABASE_URI
    local_engine = create_engine(local_uri, pool_pre_ping=True)

    cloud_uri = app_config.CLOUD_DATABASE_URL
    if not cloud_uri:
        return local_engine, None, local_uri.startswith('postgresql')

    # feat-desktop-supabase：Supabase PgBouncer transit 下多会话会复用一个 connection
    # 的 prepared statement 名字，触发 DuplicatePreparedStatement。
    # 关掉 psycopg 自动 prepared statement（与 config.py 主库一致）。
    cloud_engine = create_engine(
        cloud_uri,
        connect_args={'connect_timeout': 30, 'prepare_threshold': None},
        pool_pre_ping=True,
    )
    local_is_pg = local_uri.startswith('postgresql')
    return local_engine, cloud_engine, local_is_pg


def _normalize_value(v):
    """NaN/NaT/Inf/None → None。"""
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
    if pd.isna(v):
        return None
    return v


def _pg_copy_insert(df: pd.DataFrame, table_name: str, engine) -> None:
    """PG 用 COPY 批量写入（复用 raw_import.py 的策略）。"""
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='', date_format='%Y-%m-%d %H:%M:%S')
    buf.seek(0)
    columns = ', '.join(f'"{c}"' for c in df.columns)
    sql = f'COPY "{table_name}" ({columns}) FROM STDIN WITH (FORMAT csv, NULL \'\' )'
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cur:
            with cur.copy(sql) as copy:
                while True:
                    chunk = buf.read(65536)
                    if not chunk:
                        break
                    copy.write(chunk)
        raw.commit()
    except Exception:
        raw.rollback()
        raise
    finally:
        raw.close()


def _sync_table(src_engine, dst_engine, table: str, dst_is_pg: bool) -> int:
    """把 src 的 table 全表同步到 dst。返回同步行数。

    - 目标 PG：DELETE + COPY（保留目标表结构，因为 PG 表结构是稳定的，由 ORM 维护）
    - 目标 SQLite：DROP + CREATE + INSERT（to_sql if_exists='replace'），
      避免 src 与 dst 表结构不一致（如新增列）导致 INSERT 失败
    """
    df = pd.read_sql_table(table, src_engine)
    n = len(df)

    # 归一化 NaN（即使空表也保留列结构）
    for col in df.columns:
        df[col] = df[col].apply(_normalize_value)

    if dst_is_pg:
        # PG：先 DELETE 再 COPY
        with dst_engine.begin() as conn:
            conn.execute(text(f'DELETE FROM "{table}"'))
        if n > 0:
            _pg_copy_insert(df, table, dst_engine)
    else:
        # SQLite：直接 replace（DROP + CREATE + INSERT），
        # 确保表结构与 src 一致，避免新增列导致 INSERT 失败
        df.to_sql(table, con=dst_engine, if_exists='replace', index=False, chunksize=1000)
    return n


def _get_table_row_counts(engine, tables: list) -> dict:
    """获取各表行数。"""
    counts = {}
    with engine.connect() as conn:
        for t in tables:
            try:
                r = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"'))
                counts[t] = r.fetchone()[0]
            except Exception:
                counts[t] = -1  # 表不存在
    return counts


def _get_latest_date(engine, table: str, date_col: str = '线索日期') -> str | None:
    """获取某表最新日期（用于对比两端数据新旧）。"""
    try:
        with engine.connect() as conn:
            r = conn.execute(text(f'SELECT MAX("{date_col}") FROM "{table}"'))
            val = r.fetchone()[0]
            return str(val)[:10] if val else None
    except Exception:
        return None


@bp.route('/status', methods=['GET'])
@handle_exceptions
def sync_status():
    """获取本地与云端数据对比状态（行数 + 最新日期）。"""
    local_engine, cloud_engine, _ = _get_engines()
    if not cloud_engine:
        return jsonify({
            'success': True,
            'data': {
                'available': False,
                'message': '未配置 CLOUD_DATABASE_URL，同步功能不可用',
            }
        })

    tables = [t for t in BIZ_TABLES if t not in SKIP_TABLES]
    local_counts = _get_table_row_counts(local_engine, tables)
    cloud_counts = _get_table_row_counts(cloud_engine, tables)

    # 取 fact_conv_content 的最新线索日期作为数据新旧对比
    local_latest = _get_latest_date(local_engine, 'fact_conv_content')
    cloud_latest = _get_latest_date(cloud_engine, 'fact_conv_content')

    return jsonify({
        'success': True,
        'data': {
            'available': True,
            'local': {
                'dialect': 'sqlite' if str(local_engine.url).startswith('sqlite') else 'postgresql',
                'counts': local_counts,
                'latest_date': local_latest,
            },
            'cloud': {
                'dialect': 'postgresql',
                'counts': cloud_counts,
                'latest_date': cloud_latest,
            },
        }
    })


@bp.route('/upload', methods=['POST'])
@handle_exceptions
def sync_upload():
    """上传：本地 SQLite → 云端 PG（覆盖）。"""
    local_engine, cloud_engine, local_is_pg = _get_engines()
    if not cloud_engine:
        return jsonify({'success': False, 'message': '未配置 CLOUD_DATABASE_URL'}), 400

    data = request.get_json() or {}
    selected_tables = data.get('tables') or [t for t in BIZ_TABLES if t not in SKIP_TABLES]

    results = {}
    total_rows = 0
    for table in selected_tables:
        if table in SKIP_TABLES:
            results[table] = {'skipped': True}
            continue
        try:
            n = _sync_table(local_engine, cloud_engine, table, dst_is_pg=True)
            results[table] = {'rows': n}
            total_rows += n
            log.info(f'上传 {table}: {n} 行')
        except Exception as e:
            results[table] = {'error': str(e)}
            log.error(f'上传 {table} 失败: {e}')

    return jsonify({
        'success': True,
        'data': {
            'direction': 'upload',
            'results': results,
            'total_rows': total_rows,
        }
    })


@bp.route('/download', methods=['POST'])
@handle_exceptions
def sync_download():
    """下载：云端 PG → 本地 SQLite（覆盖）。"""
    local_engine, cloud_engine, local_is_pg = _get_engines()
    if not cloud_engine:
        return jsonify({'success': False, 'message': '未配置 CLOUD_DATABASE_URL'}), 400

    data = request.get_json() or {}
    selected_tables = data.get('tables') or [t for t in BIZ_TABLES if t not in SKIP_TABLES]

    results = {}
    total_rows = 0
    for table in selected_tables:
        if table in SKIP_TABLES:
            results[table] = {'skipped': True}
            continue
        try:
            n = _sync_table(cloud_engine, local_engine, table, dst_is_pg=local_is_pg)
            results[table] = {'rows': n}
            total_rows += n
            log.info(f'下载 {table}: {n} 行')
        except Exception as e:
            results[table] = {'error': str(e)}
            log.error(f'下载 {table} 失败: {e}')

    return jsonify({
        'success': True,
        'data': {
            'direction': 'download',
            'results': results,
            'total_rows': total_rows,
        }
    })
