# -*- coding: utf-8 -*-
"""逐表同步工具（WebDAV 按表上传/下载）。

v3.9.3 新增。把 WebDAV 整库同步拆分为「每张业务表一个独立快照文件 + 表级清单」，
让不同同事各自增量上传自己改动的表，云端各表保持独立最新。

无身份、全等权限模型：版本「新者胜、等者不动」。
- 版本信号（混合）：
  - 优先本机「最近一次写入/导入该表的时间戳」watermark（YYYYMMDD_HHMMSS）。
  - 事实/聚合表在无 watermark 时的兜底：MAX(业务日期)。
  - 维表无 watermark 时若有本机数据返回 '0'（存在即初始化，可上传建端）；否则返回 None。
- 单表文件：导出为独立 SQLite 文件（含完整列结构），合并时 DROP+CREATE+INSERT。
"""
import os
import json
import logging
import sqlite3
from datetime import datetime

import config

log = logging.getLogger(__name__)

# 可逐表同步的业务表（与 Sync 页展示一致）
SYNC_TABLES = [
    'dim_account',
    'dim_ad_plan_class',
    'fact_conv_content',
    'fact_conv_appmarket',
    'agg_vendor_daily',
    'agg_xhs_note',
    'agg_daily_channel_open',
    'fact_qingniao_leads',
]

# 事实/聚合表的业务日期列（用于 MAX 兜底版本）
TABLE_DATE_COLS = {
    'fact_conv_content': '线索日期',
    'fact_conv_appmarket': '下载日期',
    'agg_vendor_daily': '日期',
    'agg_xhs_note': '发布时间',
    'agg_daily_channel_open': '时间区间',
    'fact_qingniao_leads': '日期',
}

# 维表（常作为口径/映射）。
# 无 watermark 但有本机数据时返回 _INIT_DIM_VERSION（存在即初始化），使历史升级库也能首次上传；
# 任何真实导入 watermark（YYYYMMDD_HHMMSS）都比它新，不会误覆盖云端已有数据。
DIM_TABLES = ['dim_account', 'dim_ad_plan_class']
_INIT_DIM_VERSION = '0'

_WATERMARK_FILENAME = 'table_sync_watermark.json'


# ---- watermark（本机最近一次改动某表的时间戳） ----

def _watermark_path() -> str:
    return os.path.join(config.USER_DATA_DIR, _WATERMARK_FILENAME)


def _load_watermarks() -> dict:
    try:
        with open(_watermark_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_watermarks(data: dict) -> None:
    try:
        os.makedirs(config.USER_DATA_DIR, exist_ok=True)
        with open(_watermark_path(), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning('保存表同步 watermark 失败: %s', e)


def get_table_watermark(table: str):
    """返回某表本机最近写入时间戳（YYYYMMDD_HHMMSS），无则 None。"""
    return _load_watermarks().get(table)


def set_table_watermark(table: str, ts: str = None) -> None:
    """记录某表本机最近写入时间戳（写入层在成功写入后调用）。"""
    if not ts:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    data = _load_watermarks()
    data[table] = ts
    _save_watermarks(data)
    log.info('表同步 watermark 更新: %s = %s', table, ts)


# ---- 版本计算 ----

def compute_table_local(engine, table: str):
    """计算本机某表版本与行数。返回 (version: str|None, rows: int)。

    version 信号：优先 watermark；事实表兜底 MAX(业务日期)；
    维表无 watermark 时若本机有数据返回 _INIT_DIM_VERSION（存在即初始化），否则 None。
    """
    wm = get_table_watermark(table)
    if wm:
        return wm, _count_rows(engine, table)

    date_col = TABLE_DATE_COLS.get(table)
    if date_col:
        import sqlalchemy as sa
        try:
            with engine.connect() as conn:
                r = conn.execute(sa.text(f'SELECT MAX("{date_col}") FROM "{table}"'))
                val = r.fetchone()[0]
                return (str(val)[:10] if val else None), _count_rows(engine, table)
        except Exception as e:
            log.warning('计算 %s MAX(日期) 失败: %s', table, e)
            return None, _count_rows(engine, table)

    # 维表：无 watermark、无业务日期列
    rows = _count_rows(engine, table)
    if rows > 0:
        return _INIT_DIM_VERSION, rows
    return None, rows


def _count_rows(engine, table: str) -> int:
    try:
        import sqlalchemy as sa
        with engine.connect() as conn:
            r = conn.execute(sa.text(f'SELECT COUNT(*) FROM "{table}"'))
            return int(r.fetchone()[0])
    except Exception:
        return 0


# ---- 单表导出 / 合并 ----

def export_table_to_sqlite_file(engine, table: str, dest_db_path: str) -> int:
    """把主库某表整表导出为一个独立 SQLite 文件。返回行数。"""
    import pandas as pd
    df = pd.read_sql_table(table, engine)
    df.to_sql(table, con=f'sqlite:///{dest_db_path}', if_exists='replace',
              index=False, chunksize=1000)
    return len(df)


def _normalize_df(df) -> None:
    """就地归一化 NaN/NaT/None，避免 COPY/to_sql 写入失败。"""
    import math
    import pandas as pd
    for col in df.columns:
        df[col] = df[col].apply(
            lambda v: None if v is None
            else (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v))
                  else (None if pd.isna(v) else v))
        )


def merge_sqlite_table_into(engine, table: str, src_db_path: str, dst_is_pg: bool) -> int:
    """把单表 SQLite 文件合并进主库（DROP+CREATE+INSERT / PG DELETE+COPY）。返回行数。"""
    import pandas as pd
    import sqlalchemy as sa
    if not os.path.exists(src_db_path):
        raise FileNotFoundError(f'单表文件不存在: {src_db_path}')
    df = pd.read_sql_table(table, f'sqlite:///{src_db_path}')
    _normalize_df(df)
    n = len(df)

    if dst_is_pg:
        with engine.begin() as conn:
            conn.execute(sa.text(f'DELETE FROM "{table}"'))
        if n > 0:
            _pg_copy_insert(df, table, engine)
    else:
        df.to_sql(table, con=engine, if_exists='replace', index=False, chunksize=1000)
    return n


def _pg_copy_insert(df, table_name: str, engine) -> None:
    """PG COPY 批量写入（复用 raw_import 策略）。"""
    import io
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='', date_format='%Y-%m-%d %H:%M:%S')
    buf.seek(0)
    columns = ', '.join(f'"{c}"' for c in df.columns)
    sql = f'COPY "{table_name}" ({columns}) FROM STDIN WITH (FORMAT csv, NULL \'\')'
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


def normalize_version(v) -> int | None:
    """把版本信号归一化成可比较整数：去除非数字字符后按 int 比较。

    兼容三种来源：'2026-08-23'（事实表 MAX 日期）、'20260824_083000'（watermark 时间戳），
    以及维表的 '0'。同一天：日期(无时间) < 带时间戳 watermark，语义正确（导入过即更新）。
    """
    if v is None:
        return None
    digits = ''.join(ch for ch in str(v) if ch.isdigit())
    return int(digits) if digits else None


def snapshot_table_max_date(snapshot_db: str, table: str):
    """读取整库快照里某表的 MAX(业务日期)。返回 'YYYY-MM-DD'，空表/维表返回 None。

    用于逐表下载时「在新表数据基础上检查老整库该表数据日期」：老同事只整库 push，
    快照里该表日期可能比云端逐表文件更新，此时应从快照拆分该表合并入库。
    """
    date_col = TABLE_DATE_COLS.get(table)
    if not date_col:
        return None
    try:
        import sqlalchemy as sa
        engine = sa.create_engine(f'sqlite:///{snapshot_db}')
        with engine.connect() as conn:
            val = conn.execute(sa.text(f'SELECT MAX("{date_col}") FROM "{table}"')).scalar()
            return str(val)[:10] if val is not None else None
    except Exception as e:
        log.warning('读取快照 %s MAX(%s) 失败: %s', table, date_col, e)
        return None


# ---- 整库快照兜底（向下兼容：老同事整库 push，新逐表缺失表自动回填） ----

def download_latest_snapshot(client, tmpdir: str):
    """拉取云端最新整库快照到本地临时目录。返回本地路径，无快照返回 None。

    用于逐表下载时某表在云端逐表清单缺失的回退源：老版本同事只整库推送，
    云端逐表没有该表，则从最新整库快照抽取该表回填本地，使升级后也能拿到老同事数据。
    """
    try:
        backups = client.list_backups()
    except Exception as e:
        log.warning('读取云端整库清单失败: %s', e)
        return None
    if not backups:
        return None
    fname = backups[0]['filename']
    dest = os.path.join(tmpdir, fname.replace('/', '_').replace('\\', '_'))
    try:
        client.download_backup(fname, dest)
    except Exception as e:
        log.warning('下载云端整库快照失败 %s: %s', fname, e)
        return None
    return dest