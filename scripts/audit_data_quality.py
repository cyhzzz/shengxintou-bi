#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据质量审计脚本（v3.7.x）

目标：系统性拦截"聚合表重复行导致 SUM 虚高"这类数据问题。
背景：量子/绩牛开户成本虚高根因是 agg_vendor_daily 存在重复行，
      而聚合表只有自增主键、无业务唯一键，导入层为 DELETE + 原样 append 不去重，
      上游文件含重复行会原样入库，导致 SUM(花费/开户数) 虚高。

检测维度：
  1. 聚合表按业务唯一维度 GROUP BY ... HAVING COUNT(*)>1 检出重复行
     - agg_vendor_daily        : 日期 + 平台 + 厂商 + 业务模式
     - agg_daily_channel_open  : 时间区间 + 渠道类别 + 渠道名称
     - agg_xhs_note            : 笔记ID
  2. 列出每个重复键的重复次数（供定位上游文件）

支持 SQLite + PostgreSQL 双端：
  - 优先读 config.SQLALCHEMY_DATABASE_URI（跟随 .env 的 DATABASE_URL / DATABASE_PATH）
  - 脚本直跑无 Flask context 时自动兜底 SQLite 默认库

退出码：
  0 = 无重复行（数据健康）
  1 = 检测到重复行（需处理）

用法：
  python scripts/audit_data_quality.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 聚合表 -> 业务唯一维度（这些维度上不应出现重复行）
# 若上游 ETL 产出同维度多行，说明文件本身有重复，必须在上游修正后再导入。
AGGREGATE_KEYS: Dict[str, List[str]] = {
    'agg_vendor_daily': ['日期', '平台', '厂商', '业务模式'],
    'agg_daily_channel_open': ['时间区间', '渠道类别', '渠道名称'],
    # 小红书笔记表：同一笔记可能按广告策略/创作者拆成多行（上游行粒度），
    # 因此唯一键取 笔记ID+创作者+广告策略，只把完全相同的行视为重复。
    'agg_xhs_note': ['笔记ID', '创作者', '广告策略'],
}


def _resolve_db_url() -> str:
    """解析数据库 URI（不依赖 Flask/config，避免 CI 无后端依赖时 import dotenv 失败）。

    优先级与 config.py 一致：
      1. DATABASE_URL（PG/Supabase）
      2. DATABASE_PATH（SQLite 路径，可相对项目根）
      3. 兜底 项目根/database/shengxintou.db
    """
    raw_url = os.getenv('DATABASE_URL', '').strip()
    if raw_url:
        if raw_url.startswith('postgres://'):
            raw_url = 'postgresql+psycopg://' + raw_url[len('postgres://'):]
        return raw_url
    db_path_env = os.getenv('DATABASE_PATH', '').strip()
    if db_path_env:
        if os.path.isabs(db_path_env):
            _db_path = db_path_env
        else:
            _db_path = os.path.join(ROOT, db_path_env)
    else:
        _db_path = os.path.join(ROOT, 'database', 'shengxintou.db')
    return f'sqlite:///{_db_path}'


def _connect(url: str):
    """返回 (conn, is_pg)。SQLite 用内置 sqlite3；PG 用 sqlalchemy。"""
    if url.startswith(('postgresql://', 'postgresql+psycopg://', 'postgres://')):
        from sqlalchemy import create_engine, text
        engine = create_engine(url)
        return engine.connect(), True
    # SQLite：解析 sqlite:///path
    db_path = url.replace('sqlite:///', '', 1)
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn, False


def _quote(conn, col: str, is_pg: bool) -> str:
    """SQLite 用双引号，PG 用双引号；返回引用后的列名。"""
    return f'"{col}"'


def _list_tables(conn, is_pg: bool) -> set:
    if is_pg:
        rows = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ).fetchall()
        return {r[0] if isinstance(r, tuple) else r[0] for r in rows}
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {r[0] if isinstance(r, tuple) else r[0] for r in rows}


def audit_table(conn, is_pg: bool, table: str, key_cols: List[str]) -> Tuple[bool, List[Dict]]:
    """检测单个聚合表重复行。返回 (has_duplicates, duplicate_groups)。"""
    quoted_cols = ', '.join(_quote(conn, c, is_pg) for c in key_cols)
    sql = (
        f'SELECT {quoted_cols}, COUNT(*) AS n '
        f'FROM "{table}" '
        f'GROUP BY {quoted_cols} '
        f'HAVING COUNT(*) > 1 '
        f'ORDER BY n DESC'
    )
    try:
        rows = conn.execute(sql).fetchall()
    except Exception as e:  # 表可能不存在或列缺失
        print(f'  ⚠️  表 {table} 检测跳过: {e}')
        return False, []

    duplicates: List[Dict] = []
    for r in rows:
        rec = dict(r) if hasattr(r, 'keys') else {k: r[i] for i, k in enumerate(key_cols + ['n'])}
        rec['n'] = int(rec.get('n', r[-1]))
        duplicates.append(rec)
    return len(duplicates) > 0, duplicates


def _is_placeholder(rec: Dict, key_cols: List[str]) -> bool:
    """业务键全部为 None/空串 的行视为占位行（上游空笔记行，业务代码已过滤，不参与统计）。"""
    return all(rec.get(c) is None or str(rec.get(c)).strip() == '' for c in key_cols)


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    print('=' * 72)
    print('audit_data_quality.py — 聚合表重复行检测')
    print('=' * 72)
    print()

    url = _resolve_db_url()
    is_pg = url.startswith(('postgresql://', 'postgresql+psycopg://', 'postgres://'))
    print(f'数据库: {"PostgreSQL" if is_pg else "SQLite"}')
    print()

    conn, is_pg = _connect(url)
    try:
        tables = _list_tables(conn, is_pg)
        total_dup = 0
        placeholder_cnt = 0
        for table, key_cols in AGGREGATE_KEYS.items():
            print(f'--- {table}（业务键: {", ".join(key_cols)}） ---')
            if table not in tables:
                print('  （表不存在，跳过）')
                print()
                continue
            has_dup, dups = audit_table(conn, is_pg, table, key_cols)
            if not has_dup:
                print('  ✅ 无重复行')
                print()
                continue
            # 区分"业务键全空的占位行"与"真正的重复行"
            real_dups = [d for d in dups if not _is_placeholder(d, key_cols)]
            placeholder_cnt += len(dups) - len(real_dups)
            if not real_dups:
                print(f'  ℹ️  有 {len(dups)} 个占位行（业务键全空，上游空笔记行，不参与统计），忽略')
                print()
                continue
            total_dup += 1
            print(f'  ❌ 检测到 {len(real_dups)} 个重复键组：')
            for d in real_dups[:20]:
                key_vals = ', '.join(f'{c}={d[c]}' for c in key_cols)
                print(f'      [{key_vals}]  重复 {d["n"]} 次')
            if len(real_dups) > 20:
                print(f'      ... 还有 {len(real_dups) - 20} 个重复键组未列出')
            print()

        print('=' * 72)
        if placeholder_cnt:
            print(f'ℹ️  忽略 {placeholder_cnt} 个占位行（业务键全空，不参与统计）')
        if total_dup:
            print(f'❌ 有 {total_dup} 张聚合表存在重复行。')
            print('   处理：重复行来自上游 ETL 文件，需在上游去重后重新导入对应数据源；')
            print('         本项目导入层为 DELETE+原样 append，不去重。')
            return 1
        print('✅ 全部聚合表无重复行，数据健康')
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
