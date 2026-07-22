# -*- coding: utf-8 -*-
"""
v2 原样导入处理器（无中间计算）

6 个新数据类型，对应 6 张新表（4 张 DWS + 2 张 DWD + dim_account 维度）：

  account_mapping       -> dim_account (含代理商信息：名称/简称/字母简称)
  conversion_content    -> fact_conv_content (1 行=1 企微，内容平台加微链路)
  conversion_appmarket  -> fact_conv_appmarket (1 行=1 APP 下载，应用市场下载链路)
  vendor_daily          -> agg_vendor_daily (日×平台×厂商×业务模式统一漏斗超集)
  xhs_note              -> agg_xhs_note (笔记级 + 笔记聚合，丢 Unnamed: 24)
  channel_open          -> agg_daily_channel_open (非广告渠道开户)

原则：
1. 原样导入（pandas to_sql replace on new tables），无业务计算
2. 加载期规范化只做：'nan'->NULL、时间解析、丢脏列、超长 ID 转字符串
3. 不做维度合并、不算漏斗率、不补映射（数据源自带的全量保留）
4. 不派生冗余表（如 dim_vendor，直接从 dim_account 去重使用）
"""
import os
import re
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime


def _resolve_db_url() -> str:
    """从 Flask current_app.config 取数据库 URI；脚本直跑场景兜底 SQLite。

    feat-desktop-supabase：不再硬编码 sqlite:///，让上传导入跟随 DATABASE_URL
    切换到 Supabase PG。upload._process_file 已在 app_context 内调用，故能读到。
    """
    try:
        from flask import current_app
        return current_app.config['SQLALCHEMY_DATABASE_URI']
    except Exception:
        _root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        _db_path = os.path.join(_root, "database", "shengxintou.db").replace("\\\\", "/")
        return f"sqlite:///{_db_path}"

# 6 个新数据类型到处理器函数的映射
HANDLERS = {}  # filled after function defs


def _read_excel(path: str) -> pd.DataFrame:
    """读取 Excel（自动尝试 sheet 0 / 1 / 2）。"""
    try:
        df = pd.read_excel(path, sheet_name=0, engine="openpyxl")
        if df is None or df.empty:
            df = pd.read_excel(path, sheet_name=0)
        return df
    except Exception:
        return pd.read_excel(path, sheet_name=0)


def _clean_nan(df: pd.DataFrame) -> pd.DataFrame:
    """'nan'/'None'/空串 -> NaN -> 落库为 NULL。"""
    return df.replace({"nan": np.nan, "NaN": np.nan, "None": np.nan, "none": np.nan, "": np.nan})


def _to_bool_int(series: pd.Series) -> pd.Series:
    """是/否/0/1/True/False 统一为 0/1（nullable int）。"""
    s = series.astype(str).str.strip()
    s = s.map({"是": 1, "否": 0, "true": 1, "false": 0, "True": 1, "False": 0, "1": 1, "0": 0})
    return pd.to_numeric(s, errors="coerce").fillna(0).astype("Int64")


def _safe_overlong_id(series: pd.Series) -> pd.Series:
    """超 64 位整数 ID 转为字符串（SQLite INTEGER 上限）。"""
    def conv(v):
        if pd.isna(v):
            return None
        try:
            iv = int(v)
            if iv > 2**63 - 1 or iv < -(2**63):
                return str(v)
            return iv
        except Exception:
            s = str(v).strip()
            if not s or s.lower() in ("nan", "none"):
                return None
            return s
    return series.apply(conv)


def _to_date_str(series: pd.Series) -> pd.Series:
    """转 'YYYY-MM-DD' 字符串（保留空）。"""
    return pd.to_datetime(series, errors="coerce").dt.strftime("%Y-%m-%d")


def _to_datetime_str(series: pd.Series) -> pd.Series:
    """转 'YYYY-MM-DD HH:MM:SS' 字符串。"""
    return pd.to_datetime(series, errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")


# ============================================================================
# 6 个处理器函数：每个返回 (DataFrame, dict(meta))
# ============================================================================

def handle_account_mapping(path: str):
    """申万宏源-投放账号映射表.xlsx -> dim_account（含代理商信息）。"""
    df = _read_excel(path)
    df = _clean_nan(df)
    # 期望列：平台 / 主账号ID / 主账号名称 / 子账号ID / 子账号名称 / 代理商名称 / 代理商简称 / 代理商字母简称 / 业务模式
    col_map = {
        "\u5e73\u53f0": "platform", "platform": "platform",
        "\u4e3b\u8d26\u53f7ID": "main_account_id",
        "\u4e3b\u8d26\u53f7\u540d\u79f0": "main_account_name",
        "\u5b50\u8d26\u53f7ID": "sub_account_id",
        "\u5b50\u8d26\u53f7\u540d\u79f0": "sub_account_name",
        "\u4ee3\u7406\u5546\u540d\u79f0": "agency_name",
        "\u4ee3\u7406\u5546\u7b80\u79f0": "agency_short",
        "\u4ee3\u7406\u5546\u5b57\u6bcd\u7b80\u79f0": "agency_letter",
        "\u4e1a\u52a1\u6a21\u5f0f": "business_model",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
    # 补缺列
    for c in ["platform", "main_account_id", "main_account_name", "sub_account_id",
              "sub_account_name", "agency_name", "agency_short", "agency_letter", "business_model"]:
        if c not in df.columns:
            df[c] = None
    # ID 字段安全转换
    df["main_account_id"] = _safe_overlong_id(df["main_account_id"])
    df["sub_account_id"] = _safe_overlong_id(df["sub_account_id"])
    # 主键：原表无 id，落库时让 SQLite 自增
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    # account 表中文列名（保留 id 列以满足 ORM）
    account_df = df[["id", "platform", "main_account_id", "main_account_name", "sub_account_id",
                     "sub_account_name", "agency_name", "agency_short", "agency_letter",
                     "business_model"]].copy()
    account_df.insert(1, "序号", range(1, len(account_df) + 1))  # 序号列对齐 DimAccount ORM
    account_df.columns = ["id", "序号", "platform", "main_account_id", "main_account_name",
                          "sub_account_id", "sub_account_name", "agency_name",
                          "agency_short", "agency_letter", "business_model"]
    return {"dim_account": account_df}, {
        "primary_keys": {},
        "row_counts": {"dim_account": len(account_df)},
    }


def handle_conversion_content(path: str):
    """4 线索明细.xlsx -> fact_conv_content（1 行=1 企微，加微链路）。"""
    df = _read_excel(path)
    df = _clean_nan(df)
    # 超长 ID 安全转换
    for c in df.columns:
        if any(k in c for k in ["\u5e73\u53f0\u7528\u6237ID", "ID", "id"]):
            df[c] = _safe_overlong_id(df[c])
    # 布尔列：是/否 -> 0/1
    for c in df.columns:
        if any(k in c for k in ["\u662f\u5426", "\u662f/\u5426"]):
            df[c] = _to_bool_int(df[c])
    # 时间列
    for c in df.columns:
        if any(k in c for k in ["\u65e5\u671f", "\u65f6\u95f4"]):
            try:
                sample = df[c].dropna().head(3)
                if len(sample) == 0:
                    continue
                if any(re.search(r"\d+:\d+", str(s)) for s in sample):
                    df[c] = _to_datetime_str(df[c])
                else:
                    df[c] = _to_date_str(df[c])
            except Exception:
                pass
    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    return {"fact_conv_content": df}, {"row_counts": {"fact_conv_content": len(df)}}


def handle_conversion_appmarket(path: str):
    """8.1应用市场归因明细.xlsx -> fact_conv_appmarket（1 行=1 APP 下载）。"""
    df = _read_excel(path)
    df = _clean_nan(df)
    for c in df.columns:
        if any(k in c for k in ["\u8bbe\u5907", "ID", "id"]):
            df[c] = _safe_overlong_id(df[c])
    for c in df.columns:
        if any(k in c for k in ["\u662f\u5426"]):
            df[c] = _to_bool_int(df[c])
    for c in df.columns:
        if any(k in c for k in ["\u65e5\u671f", "\u65f6\u95f4"]):
            try:
                sample = df[c].dropna().head(3)
                if len(sample) == 0:
                    continue
                if any(re.search(r"\d+:\d+", str(s)) for s in sample):
                    df[c] = _to_datetime_str(df[c])
                else:
                    df[c] = _to_date_str(df[c])
            except Exception:
                pass
    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    return {"fact_conv_appmarket": df}, {"row_counts": {"fact_conv_appmarket": len(df)}}


def handle_vendor_daily(path: str):
    """厂商广告投放分析.xlsx -> agg_vendor_daily（统一漏斗超集）。"""
    df = _read_excel(path)
    df = _clean_nan(df)
    for c in df.columns:
        if any(k in c for k in ["\u65e5\u671f", "\u6708"]):
            df[c] = _to_date_str(df[c])
    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    return {"agg_vendor_daily": df}, {"row_counts": {"agg_vendor_daily": len(df)}}


def handle_xhs_note(path: str):
    """6.1小红书笔记表.xlsx -> agg_xhs_note（笔记级 + 笔记聚合，丢 Unnamed: 24）。"""
    df = _read_excel(path)
    df = _clean_nan(df)
    # 丢脏列 Unnamed: 24 等
    drop_cols = [c for c in df.columns if str(c).startswith("Unnamed:")]
    if drop_cols:
        df = df.drop(columns=drop_cols)
    # 时间列
    for c in df.columns:
        if any(k in c for k in ["\u53d1\u5e03\u65f6\u95f4", "\u65e5\u671f"]):
            try:
                sample = df[c].dropna().head(3)
                if len(sample) > 0:
                    df[c] = _to_datetime_str(df[c])
            except Exception:
                pass
    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    return {"agg_xhs_note": df}, {"row_counts": {"agg_xhs_note": len(df)}}


def handle_channel_open(path: str):
    """0.1 开户渠道分析明细.xlsx -> agg_daily_channel_open（开户渠道分析 sheet）。"""
    # 该 Excel 通常含多个 sheet，需要找 开户渠道分析 / 开户 这类
    try:
        xl = pd.ExcelFile(path)
        sheet_name = None
        for s in xl.sheet_names:
            if "\u5f00\u6237" in s:
                sheet_name = s
                break
        if sheet_name is None:
            sheet_name = xl.sheet_names[0]
        df = pd.read_excel(xl, sheet_name=sheet_name)
    except Exception:
        df = _read_excel(path)
    df = _clean_nan(df)
    # 时间区间可能为日期/字符串
    for c in df.columns:
        if "\u65f6\u95f4\u533a\u95f4" in c or "\u533a\u95f4" in c:
            try:
                df[c] = _to_date_str(df[c])
            except Exception:
                pass
    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）
    if "id" not in df.columns:
        df = df.copy()
        df.insert(0, "id", range(1, len(df) + 1))
    return {"agg_daily_channel_open": df}, {"row_counts": {"agg_daily_channel_open": len(df)}}


HANDLERS["account_mapping"] = handle_account_mapping
HANDLERS["conversion_content"] = handle_conversion_content
HANDLERS["conversion_appmarket"] = handle_conversion_appmarket
HANDLERS["vendor_daily"] = handle_vendor_daily
HANDLERS["xhs_note"] = handle_xhs_note
HANDLERS["channel_open"] = handle_channel_open


def handle_qingniao_leads(path: str, batch_tag: str = None):
    """抖音青鸟线索通线索详情导出 -> fact_qingniao_leads（1 行=1 条青鸟回传线索）。

    v3.3.6 关键改造：
    1. 批次标注字段：每行追加 `批次标注` 列，值为 batch_tag 参数。
       若未传 batch_tag，默认用当前时间 'YYYYMMDDHHmm'（如 '202607201430'）。
    2. 历史批次保留：write_to_db 对 qingniao_leads 特例使用 to_sql(if_exists='append')
       保留历史批次；其他 6 类 v2 类型默认 to_sql(if_exists='replace')。
       本 handler 返回的 DataFrame 已带 `批次标注` 列。
    3. id 列从 1 自增改为不主动设置，让数据库 AUTOINCREMENT 处理（避免 append 模式下主键冲突）。

    原样导入，仅做格式层规范（nan->NULL、超长 ID 转字符串、日期规范化）。
    3 个标志位列保持「未打」/「已打」字符串原样入库，对账端点再做映射。
    """
    df = _read_excel(path)
    df = _clean_nan(df)
    # 超长 ID 安全转换（计划ID/创意ID/素材ID/广告ID/广告账户ID 均可能超 64 位）
    for c in df.columns:
        if any(k in c for k in ["ID", "id", "Id"]):
            df[c] = _safe_overlong_id(df[c])
    # 日期列：青鸟侧「日期」字段格式为 'YYYY-MM-DD'
    for c in df.columns:
        if c == "日期" or "日期" in c:
            try:
                df[c] = _to_date_str(df[c])
            except Exception:
                pass
    # 标志位列保留原样字符串「未打」/「已打」，不做转换
    # 不主动设置 id 列，让数据库 AUTOINCREMENT 处理（v3.3.6 改 append 模式后避免主键冲突）
    if "id" in df.columns:
        df = df.drop(columns=["id"])
    # v3.3.6：批次标注列
    if not batch_tag:
        batch_tag = datetime.now().strftime('%Y%m%d%H%M')
    df = df.copy()
    df["批次标注"] = batch_tag
    return {"fact_qingniao_leads": df}, {"row_counts": {"fact_qingniao_leads": len(df)}, "batch_tag": batch_tag}


HANDLERS["qingniao_leads"] = handle_qingniao_leads


def process(data_type: str, file_path: str, **kwargs) -> dict:
    """
    处理入口：data_type -> {table_name: DataFrame, ...}, meta。

    Returns:
        {
            "tables": {"table_name": DataFrame, ...},
            "meta": {"row_counts": {...}, "data_type": ...},
        }
    """
    if data_type not in HANDLERS:
        raise ValueError(f"Unknown data_type: {data_type}. Supported: {list(HANDLERS.keys())}")
    # v3.3.6：qingniao_leads 支持 batch_tag 参数透传
    if data_type == "qingniao_leads":
        tables, meta = HANDLERS[data_type](file_path, **kwargs)
    else:
        tables, meta = HANDLERS[data_type](file_path)
    meta["data_type"] = data_type
    return {"tables": tables, "meta": meta}

def write_to_db(data_type: str, file_path: str, db_url: str = None, **kwargs) -> dict:
    """处理并写入新表。

    v3.4.0 feat-desktop-supabase 关键改造：
    - db_url 默认从 current_app.config['SQLALCHEMY_DATABASE_URI'] 取（兼容 SQLite + PG）
    - 改为 DELETE + append 模式，保留 ORM 建好的表结构（主键/序列/索引/中文列名映射）
      原因：to_sql(if_exists='replace') = DROP TABLE + 按 pandas 推断类型重建，
      会摧毁 PG 的 BIGSERIAL 序列、主键约束、index=True 索引；下次 ORM 插入必报错。
    - qingniao_leads 仍用纯 append（保留历史批次，不 DELETE）
    - 删除 sqlite_sequence 操作（SQLite 专属，PG 报错；DELETE + append 不需要重置序列）
    """
    result = process(data_type, file_path, **kwargs)
    tables = result["tables"]
    meta = result["meta"]

    if db_url is None:
        # feat-desktop-supabase：优先复用 Flask-SQLAlchemy 的 engine，
        # 共享连接池配置（pool_pre_ping/pool_recycle），避免 Supabase 连接泄漏。
        try:
            from flask import current_app
            from backend.database import db
            engine = db.engine
        except Exception:
            engine = create_engine(_resolve_db_url())
    else:
        engine = create_engine(db_url)
    written = {}
    # v3.4.1 性能修复：避免 engine.begin() 大事务（20万行单事务导致 PG 超时）
    # - to_sql 加 method='multi' 批量参数化 INSERT（多行合并到一条 INSERT）
    # - 加 chunksize=500 分批提交（每批独立事务，避免 PgBouncer statement_timeout）
    # - PG 参数上限 65535，500 行 × 30 列 = 15000 参数，安全
    is_pg = str(engine.url).startswith(("postgresql://", "postgresql+psycopg://"))
    chunk = 500 if is_pg else 1000

    with engine.connect() as conn:
        for table_name, df in tables.items():
            if data_type == "qingniao_leads":
                # append 模式：保留历史批次数据，不 DELETE
                df.to_sql(table_name, con=engine, if_exists="append", index=False,
                          method='multi', chunksize=chunk)
            else:
                # DELETE + append：清空旧数据但保留 ORM 表结构（主键/序列/索引）
                conn.execute(text(f'DELETE FROM "{table_name}"'))
                conn.commit()
                # 用 engine 而非 conn，让 to_sql 自动分批提交（每 chunksize 行一个事务）
                df.to_sql(table_name, con=engine, if_exists="append", index=False,
                          method='multi', chunksize=chunk)
            cur = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            n = cur.fetchone()[0]
            written[table_name] = n
    meta["written"] = written
    return meta