# -*- coding: utf-8 -*-
"""
v2 原样导入处理器（无中间计算）

7 个新数据类型，对应 7 张新表（4 张 DWS + 2 张 DWD + dim_account 维度 + dim_ad_plan_class 维度）：

  account_mapping       -> dim_account (含代理商信息：名称/简称/字母简称)
  conversion_content    -> fact_conv_content (1 行=1 企微，内容平台加微链路)
  conversion_appmarket  -> fact_conv_appmarket (1 行=1 APP 下载，应用市场下载链路)
  vendor_daily          -> agg_vendor_daily (日×平台×厂商×业务模式统一漏斗超集)
  xhs_note              -> agg_xhs_note (笔记级 + 笔记聚合，丢 Unnamed: 24)
  channel_open          -> agg_daily_channel_open (非广告渠道开户)
  appmarket_plan_class  -> dim_ad_plan_class (应用市场广告计划分类维度)

原则：
1. 原样导入（pandas to_sql replace on new tables），无业务计算
2. 加载期规范化只做：'nan'->NULL、时间解析、丢脏列、超长 ID 转字符串
3. 不做维度合并、不算漏斗率、不补映射（数据源自带的全量保留）
4. 不派生冗余表（如 dim_vendor，直接从 dim_account 去重使用）

特殊导入规则（详见 docs/rules/business-invariants.md）：
- qingniao_leads：批次 append（例外）
- conversion_appmarket：增量(overwrite=False)按 设备号+下载日期 去重；
  全量替换(overwrite=True)为按日期分区替换（保留 2026-06-30 及之前，只重写 7/1 以后）
- vendor_daily：默认按日期分区替换（保留 2026-06-30 及之前，只重写 7/1 以后）；
  若新文件自身含 7/1 之前数据（全量文件）则退化为整表替换（以文件为准）
"""
import os
import io
import re
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text, inspect as sqla_inspect
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# 应用市场下载链路（conversion_appmarket → fact_conv_appmarket）的分区替换边界：
# 保留 2026-06-30 及之前的历史数据；之后上传的文件仅含 2026-07-01 以后的数据，
# 导入（含"全量替换"开关开启时）只清空并重写 该日期 及以后的数据，避免整表替换丢失历史。
APPMARKET_CONV_REPLACE_FROM = '2026-07-01'

# 厂商广告投放分析（vendor_daily → agg_vendor_daily）的分区替换边界：
# 与 conversion_appmarket 口径一致，默认保留 2026-06-30 及之前历史；之后上传的文件
# （通常是 2026-07-01 起的滚动增量）只清空并重写 7/1 及以后，避免整表替换丢失历史。
# 智能退化：若新文件自身含 7/1 之前的数据（即全量文件），则整表替换（以文件为准），
# 从而既能保护滚动增量场景的历史，又能在补全全量文件时刷新全部（含 6/30 及之前）数据。
VENDOR_DAILY_REPLACE_FROM = '2026-07-01'


def _vendor_daily_min_date(df: "pd.DataFrame"):
    """取 vendor_daily DataFrame 的「日期」列最小日期 (YYYY-MM-DD)，无则返回 None。"""
    if "日期" not in df.columns:
        return None
    try:
        s = pd.to_datetime(df["日期"], errors="coerce").dropna()
        if s.empty:
            return None
        return s.min().strftime("%Y-%m-%d")
    except Exception:
        return None


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

# 应用市场白名单（与归因转化率报表口径一致；OPPO/VIVO 源表大写，落库前 .lower()）
ALLOWED_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']


def _read_excel(path: str) -> pd.DataFrame:
    """读取 Excel（自动尝试 sheet 0 / 1 / 2）。"""
    try:
        df = pd.read_excel(path, sheet_name=0, engine="openpyxl")
        if df is None or df.empty:
            df = pd.read_excel(path, sheet_name=0)
        return df
    except Exception:
        return pd.read_excel(path, sheet_name=0)


def _read_excel_smart(path: str, required_col: str) -> pd.DataFrame:
    """读取 Excel，智能识别含 ``required_col`` 列的明细数据 sheet。

    背景：归因明细等 Excel 常含多个 sheet（Sheet2 透视表在前、Sheet1
    明细在后）。``sheet_name=0`` 会误读透视表（仅几行且大多是 Unnamed
    列）。此函数遍历所有 sheet，优先返回列中含 ``required_col`` 的
    第一个 sheet；若都不含则退回列数最多的 sheet（明细表列数远多于
    透视表）；最后兜底走 ``_read_excel``。
    """
    try:
        xl = pd.ExcelFile(path, engine="openpyxl")
    except Exception:
        return _read_excel(path)
    try:
        best_sheet = None  # (sheet_name, col_count)
        for s in xl.sheet_names:
            try:
                probe = pd.read_excel(xl, sheet_name=s, nrows=5)
            except Exception:
                continue
            if required_col in probe.columns:
                return pd.read_excel(xl, sheet_name=s)
            if best_sheet is None or len(probe.columns) > best_sheet[1]:
                best_sheet = (s, len(probe.columns))

        if best_sheet is not None and best_sheet[1] > 0:
            return pd.read_excel(xl, sheet_name=best_sheet[0])
        return _read_excel(path)
    finally:
        # 显式释放 ExcelFile，避免 Windows 下上传文件句柄残留（文件被占用）
        try:
            xl.close()
        except Exception:
            pass


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
    """8.1应用市场归因明细.xlsx -> fact_conv_appmarket（1 行=1 APP 下载）。

    该 Excel 可能含多个 sheet（透视表 + 明细数据），需要智能识别含
    ``设备号`` 列的明细 sheet，避免误读透视表/汇总 sheet。
    """
    df = _read_excel_smart(path, required_col="\u8bbe\u5907")
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


def handle_appmarket_plan_class(path: str):
    """广告计划分类表.xlsx -> dim_ad_plan_class（1 行=1 广告分组，应用市场计划分解维度）。

    列：应用市场 / 广告分组ID / 广告分组名称 / 版位 / 子版位 / 出价。

    规范（v2 原样导入，仅格式层）：
    1. 应用市场 .lower() 归一（OPPO/VIVO → oppo/vivo），与 fact_conv_appmarket 口径一致
    2. 仅保留 7 大应用市场白名单，其余行丢弃
    3. 广告分组ID 超长 ID 安全转换（BigInteger / 超界转字符串）
    4. 覆盖写入（replace），无中间计算
    """
    df = _read_excel(path)
    df = _clean_nan(df)

    # 1) 应用市场归一（小写）+ 2) 白名单过滤
    def _norm_market(v):
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        return str(v).strip().lower()
    df["应用市场"] = df["应用市场"].apply(_norm_market)
    df = df[df["应用市场"].isin(ALLOWED_PLATFORMS)].copy()
    df = df.reset_index(drop=True)

    # 3) 广告分组ID 超长 ID 安全转换
    if "广告分组ID" in df.columns:
        df["广告分组ID"] = _safe_overlong_id(df["广告分组ID"])

    # 保序选取落库列（原样，仅中文列名，id 由 ORM 自增）
    keep = ["应用市场", "广告分组ID", "广告分组名称", "版位", "子版位", "出价"]
    keep = [c for c in keep if c in df.columns]
    plan_df = df[keep].copy()

    # 保留 id 列（SQLAlchemy ORM 需要 id 主键）—— 显式 1..n，便于覆盖写入对齐
    if "id" not in plan_df.columns:
        plan_df.insert(0, "id", range(1, len(plan_df) + 1))

    return {"dim_ad_plan_class": plan_df}, {
        "row_counts": {"dim_ad_plan_class": len(plan_df)},
    }


HANDLERS["account_mapping"] = handle_account_mapping
HANDLERS["conversion_content"] = handle_conversion_content
HANDLERS["conversion_appmarket"] = handle_conversion_appmarket
HANDLERS["vendor_daily"] = handle_vendor_daily
HANDLERS["xhs_note"] = handle_xhs_note
HANDLERS["channel_open"] = handle_channel_open
HANDLERS["appmarket_plan_class"] = handle_appmarket_plan_class


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
    # 不主动设置 id 列，让数据库 AUTOINCREMENT 处理（append 模式下避免主键冲突）
    if "id" in df.columns:
        df = df.drop(columns=["id"])
    # 批次标注列
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

def _pg_copy_insert(df: pd.DataFrame, table_name: str, engine) -> None:
    """用 PostgreSQL COPY 命令批量写入 DataFrame。

    性能优化：COPY 比 method='multi' INSERT 快 10 倍以上。
    - 流式写入，不受 PG 参数上限（65535）限制
    - 不需要分批提交（COPY 整体是一个事务，但写入是流式的）
    - 原样导入场景适用：数据均为覆盖写入，列顺序与 DataFrame 一致
    """
    buf = io.StringIO()
    # 写 CSV（无 header，NaN → 空字符串 = NULL）
    df.to_csv(buf, index=False, header=False, na_rep='', date_format='%Y-%m-%d %H:%M:%S')
    buf.seek(0)

    columns = ', '.join(f'"{c}"' for c in df.columns)
    sql = f"COPY \"{table_name}\" ({columns}) FROM STDIN WITH (FORMAT csv, NULL '')"

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


def write_to_db(data_type: str, file_path: str, db_url: str = None, **kwargs) -> dict:
    """处理并写入新表。

    双端支持关键改造：
    - db_url 默认从 current_app.config['SQLALCHEMY_DATABASE_URI'] 取（兼容 SQLite + PG）
    - 改为 DELETE + append 模式，保留 ORM 建好的表结构（主键/序列/索引/中文列名映射）
      原因：to_sql(if_exists='replace') = DROP TABLE + 按 pandas 推断类型重建，
      会摧毁 PG 的 BIGSERIAL 序列、主键约束、index=True 索引；下次 ORM 插入必报错。
    - qingniao_leads 仍用纯 append（保留历史批次，不 DELETE）
    - conversion_appmarket 全量替换时按日期分区（保留 6/30 及之前，只重写 7/1 以后），
      见 APPMARKET_CONV_REPLACE_FROM 注释；增量模式（overwrite=False）仍按 设备号+下载日期 去重
    - vendor_daily 默认按日期分区（保留 6/30 及之前，只重写 7/1 以后，见
      VENDOR_DAILY_REPLACE_FROM）；若新文件自身含 7/1 之前数据（全量文件）则退化为整表替换
    - 删除 sqlite_sequence 操作（SQLite 专属，PG 报错；DELETE + append 不需要重置序列）

    性能优化：
    - PG 使用 COPY 命令替代 INSERT（20万行从 199s → 预计 <30s）
    - SQLite 保持 to_sql（COPY 是 PG 专有命令）
    """
    result = process(data_type, file_path, **kwargs)
    tables = result["tables"]
    meta = result["meta"]
    overwrite = kwargs.get("overwrite", True)

    if db_url is None:
        # feat-desktop-supabase：优先复用 Flask-SQLAlchemy 的 engine，
        # 共享连接池配置（pool_pre_ping/pool_recycle），避免 Supabase 连接泄漏。
        try:
            from flask import current_app
            from backend.database import db
            engine = db.engine
            local_engine = False
        except Exception:
            engine = create_engine(_resolve_db_url())
            local_engine = True
    else:
        engine = create_engine(db_url)
        local_engine = True
    written = {}
    is_pg = str(engine.url).startswith(("postgresql://", "postgresql+psycopg://"))

    with engine.connect() as conn:
        for table_name, df in tables.items():
            # 动态加列：检测上游新增字段，自动 ALTER TABLE ADD COLUMN
            # 避免上游 ETL 加字段时导入报错；ORM 模型可后续按需补充
            insp = sqla_inspect(engine)
            existing_cols = {col['name'] for col in insp.get_columns(table_name)}
            df_cols = set(df.columns) - {'id'}
            missing_cols = df_cols - existing_cols
            if missing_cols:
                for col in sorted(missing_cols):
                    dtype_str = str(df[col].dtype)
                    if dtype_str in ('int64', 'Int64'):
                        col_type = 'BIGINT'
                    elif dtype_str in ('float64', 'Float64'):
                        col_type = 'FLOAT'
                    else:
                        col_type = 'TEXT'
                    conn.execute(text(
                        f'ALTER TABLE "{table_name}" ADD COLUMN "{col}" {col_type}'
                    ))
                    logger.info(f'自动添加列: {table_name}."{col}" {col_type}')
                conn.commit()

            if data_type == "qingniao_leads":
                # append 模式：保留历史批次数据，不 DELETE
                if is_pg:
                    _pg_copy_insert(df, table_name, engine)
                else:
                    df.to_sql(table_name, con=engine, if_exists="append", index=False, chunksize=1000)
            elif data_type == "conversion_appmarket" and not overwrite:
                # 增量模式：用临时表批量去重，避免逐条 DELETE
                if "设备号" in df.columns and "下载日期" in df.columns:
                    valid = df.dropna(subset=["设备号", "下载日期"])
                    pairs = valid[["设备号", "下载日期"]].drop_duplicates().astype(str)
                    if len(pairs) > 0:
                        # 1. 创建去重表（普通表，跨连接可见）
                        conn.execute(text(
                            'CREATE TABLE IF NOT EXISTS _tmp_dedup '
                            '("设备号" TEXT, "下载日期" TEXT)'
                        ))
                        conn.execute(text('DELETE FROM _tmp_dedup'))
                        conn.commit()
                        # 2. pandas to_sql 批量写入去重对
                        pairs.to_sql('_tmp_dedup', con=engine, if_exists='append',
                                     index=False, chunksize=5000)
                        # 3. 创建索引（JOIN 优化关键）
                        conn.execute(text(
                            'CREATE INDEX IF NOT EXISTS idx_tmp_dedup '
                            'ON _tmp_dedup ("设备号", "下载日期")'
                        ))
                        conn.commit()
                        # 4. JOIN + rowid 批量 DELETE（利用主表索引，比 EXISTS 快 700 倍）
                        conn.execute(text(
                            f'DELETE FROM "{table_name}" '
                            f'WHERE rowid IN ('
                            f'SELECT t.rowid FROM "{table_name}" t '
                            f'INNER JOIN _tmp_dedup d '
                            f'ON t."设备号" = d."设备号" '
                            f'AND t."下载日期" = d."下载日期")'
                        ))
                        conn.commit()
                        # 5. 清理
                        conn.execute(text('DROP TABLE IF EXISTS _tmp_dedup'))
                        conn.commit()
                # 丢弃 id 列，让 DB autoincrement 生成（避免主键冲突）
                if "id" in df.columns:
                    df = df.drop(columns=["id"])
                if is_pg:
                    _pg_copy_insert(df, table_name, engine)
                else:
                    df.to_sql(table_name, con=engine, if_exists="append", index=False, chunksize=1000)
            else:
                # DELETE + append：清空旧数据但保留 ORM 表结构（主键/序列/索引）
                if data_type == "conversion_appmarket" and APPMARKET_CONV_REPLACE_FROM:
                    # 应用市场下载链路：保留 6/30 及之前历史，只替换 7/1 以后数据
                    # （新文件仅含 7/1 以后数据；防止"全量替换"开关清空历史）
                    logger.info(
                        f'conversion_appmarket 分区替换: DELETE {table_name} '
                        f'WHERE 下载日期 >= {APPMARKET_CONV_REPLACE_FROM}'
                    )
                    conn.execute(text(
                        f'DELETE FROM "{table_name}" WHERE "下载日期" >= :cutoff'
                    ), {"cutoff": APPMARKET_CONV_REPLACE_FROM})
                    # 丢弃 id 列让 DB 自增生成，避免与保留的历史行主键冲突
                    if "id" in df.columns:
                        df = df.drop(columns=["id"])
                elif data_type == "vendor_daily":
                    # 厂商广告投放分析：与下载链路口径一致，默认保留 6/30 及之前历史。
                    # 智能判断：若新文件 min(日期) >= 7/1（滚动增量文件），只替换 7/1 以后；
                    # 若新文件含 7/1 之前数据（全量文件），则整表替换（以文件为准）。
                    _cutoff = VENDOR_DAILY_REPLACE_FROM
                    _min_date = _vendor_daily_min_date(df)
                    if _min_date is not None and _min_date >= _cutoff:
                        logger.info(
                            f'vendor_daily 分区替换: DELETE {table_name} '
                            f'WHERE 日期 >= {_cutoff}'
                        )
                        conn.execute(text(
                            f'DELETE FROM "{table_name}" WHERE "日期" >= :cutoff'
                        ), {"cutoff": _cutoff})
                        if "id" in df.columns:
                            df = df.drop(columns=["id"])
                    else:
                        logger.info(f'vendor_daily 全量替换: DELETE {table_name}')
                        conn.execute(text(f'DELETE FROM "{table_name}"'))
                else:
                    conn.execute(text(f'DELETE FROM "{table_name}"'))
                conn.commit()
                if is_pg:
                    _pg_copy_insert(df, table_name, engine)
                else:
                    df.to_sql(table_name, con=engine, if_exists="append", index=False, chunksize=1000)
            cur = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            n = cur.fetchone()[0]
            written[table_name] = n
    if local_engine:
        # 释放本地创建的 engine 连接池（脚本/测试直跑场景），
        # 避免 SQLite 文件句柄残留导致文件被占用；共享 db.engine 不处理。
        engine.dispose()
    meta["written"] = written
    return meta