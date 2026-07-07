# -*- coding: utf-8 -*-
"""
省心投 BI v2 库表 ETL 导入脚本
================================
把 6 份源 Excel 按 docs/库表重构设计_v2.md 落到现有 SQLite 库（database/shengxintou.db）。
原则：原样存（保留全部原始列）+ 加载期规范化（'nan'→NULL、是/否→0/1、解析日期、丢脏列）。
不删除/不改动旧表，旧表保留做灰度对照。

运行：
  .venv/Scripts/python.exe scripts/import_v2_schema.py
"""
import os
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# ---------- 路径 ----------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "数据源")
DB = os.path.join(ROOT, "database", "shengxintou.db")
SRC_FILES = {
    "account_map": os.path.join(SRC, "申万宏源-投放账号映射表.xlsx"),
    "conv_content": os.path.join(SRC, "4线索明细【添加企微开始日期_2026-01-01】 (5).xlsx"),
    "conv_appmarket": os.path.join(SRC, "8.1应用市场归因明细【下载开始日期_2026-01-01_下载结束日期_2026-12-31_...】.xlsx"),
    "vendor_daily": os.path.join(SRC, "厂商广告投放分析.xlsx"),
    "xhs_note": os.path.join(SRC, "6.1小红书笔记表【数据开始时间_2026-01-01_数据结束时间_2026-12-31_...】.xlsx"),
    "channel_open": os.path.join(SRC, "0.1开户渠道分析明细【查询开始日期_2025-01-01_查询结束日期_2026-06-30_...】.xlsx"),
}
engine = create_engine(f"sqlite:///{DB}")

# ---------- 规范化工具 ----------
def clean_nan(df: pd.DataFrame) -> pd.DataFrame:
    """把字面量 'nan'/'NaN'/空串 等转成真正的 NaN（后续 to_sql 写 NULL）。"""
    df = df.replace({"nan": np.nan, "NaN": np.nan, "None": np.nan, "none": np.nan, "": np.nan})
    return df

def to_bool_col(s: pd.Series) -> pd.Series:
    """是否/0/1/true/false → 0/1（nullable int）。"""
    def conv(v):
        if pd.isna(v):
            return None
        if isinstance(v, (int, float)):
            return 1 if v else 0
        t = str(v).strip()
        if t in ("是", "1", "true", "True", "Y", "y"):
            return 1
        if t in ("否", "0", "false", "False", "N", "n"):
            return 0
        return None
    return s.map(conv).astype("Int64")

def parse_dates(df: pd.DataFrame):
    """按列名规则解析日期/时间列，存为 ISO 字符串（无法解析→NULL）。"""
    for col in df.columns:
        c = str(col)
        if c == "时间区间":  # 这是区间字符串，不解析
            continue
        if "日期" in c and "时间" not in c:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")
        elif "时间" in c:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
    return df

def add_id(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.insert(0, "id", range(1, len(df) + 1))
    return df

def sqlite_safe(df: pd.DataFrame) -> pd.DataFrame:
    """把超过 SQLite 64 位整数上限(2^63-1)的 Python int 转成字符串，避免 OverflowError。
    SQLite INTEGER 上限约 9.2e18；抖音/小红书等平台用户ID常为 19 位，必须存 TEXT。"""
    limit = 2 ** 63 - 1
    for col in df.columns:
        if df[col].dtype == object:
            def conv(v):
                if pd.isna(v):
                    return v
                if isinstance(v, int) and abs(v) > limit:
                    return str(v)
                if isinstance(v, str):
                    s = v.strip()
                    if s and (s.lstrip("-").isdigit() or s.lstrip("-").replace(".", "", 1).isdigit()):
                        try:
                            if abs(float(s)) > limit:
                                return s
                        except ValueError:
                            pass
                return v
            df[col] = df[col].map(conv)
    return df

def load_and_store(name, df, **kwargs):
    df = add_id(df)
    df = sqlite_safe(df)
    df.to_sql(name, engine, if_exists="replace", index=False, **kwargs)
    print(f"  ✓ {name}: {len(df)} 行, {df.shape[1]} 列")
    return df

# ============================================================
print("=== 开始 v2 ETL 导入 ===")
print(f"目标库: {DB}")

# ---------- DIM: 投放账号映射表 ----------
print("\n[DIM] 投放账号映射表 → dim_account / dim_vendor")
acc = pd.read_excel(SRC_FILES["account_map"])
acc = clean_nan(acc)
acc = acc.rename(columns={
    "平台": "platform",
    "主账号ID": "main_account_id",
    "主账号名称": "main_account_name",
    "子账号ID": "sub_account_id",
    "子账号名称": "sub_account_name",
    "代理商名称": "agency_name",
    "代理商简称": "agency_short",
    "代理商字母简称": "agency_letter",
    "业务模式": "business_model",
})
acc = acc.dropna(how="all")
load_and_store("dim_account", acc)

ven = (acc[["agency_name", "agency_short", "agency_letter"]]
       .dropna(subset=["agency_name"])
       .drop_duplicates(subset=["agency_name"])
       .reset_index(drop=True))
load_and_store("dim_vendor", ven)

# ---------- DIM: 渠道类别 / 渠道叶子（预置字典） ----------
print("\n[DIM] 渠道类别 / 渠道叶子（预置）")
cat_df = pd.DataFrame([
    {"id": 1, "name": "内容平台"},
    {"id": 2, "name": "应用市场"},
    {"id": 3, "name": "合作机构"},
    {"id": 4, "name": "员工开户"},
    {"id": 5, "name": "自然流入"},
])
cat_df.to_sql("dim_channel_category", engine, if_exists="replace", index=False)
print("  ✓ dim_channel_category: 5 行")

# channel_category_id: 1=内容平台, 2=应用市场
channels = [
    ("抖音", 1, 1), ("腾讯", 1, 1), ("小红书", 1, 1), ("快手", 1, 1),
    ("小米", 2, 1), ("华为", 2, 1), ("OPPO", 2, 1), ("VIVO", 2, 1),
    ("荣耀", 2, 1), ("苹果", 2, 1),
    ("鸿蒙", 2, 0), ("iOS", 2, 0),  # 待上线
]
ch_df = pd.DataFrame(
    [{"id": i + 1, "name": n, "channel_category_id": cid, "is_enabled": en}
     for i, (n, cid, en) in enumerate(channels)]
)
ch_df.to_sql("dim_channel", engine, if_exists="replace", index=False)
print(f"  ✓ dim_channel: {len(ch_df)} 行（含鸿蒙/iOS 待上线）")

# ---------- DWD: 内容平台明细（客户级） ----------
print("\n[DWD] 4线索明细 → fact_conv_content")
cc = pd.read_excel(SRC_FILES["conv_content"])
cc = clean_nan(cc)
bool_cols_cc = ["是否客户开口", "是否有效线索", "是否开户中断", "是否开户",
                "是否为有效户", "是否为存量客户", "是否为存量有效户", "是否删除企微"]
for c in bool_cols_cc:
    if c in cc.columns:
        cc[c] = to_bool_col(cc[c])
cc = parse_dates(cc)
load_and_store("fact_conv_content", cc)

# ---------- DWD: 应用市场明细（设备级） ----------
print("\n[DWD] 8.1应用市场归因明细 → fact_conv_appmarket")
am = pd.read_excel(SRC_FILES["conv_appmarket"])
am = clean_nan(am)
bool_cols_am = ["是否激活APP", "是否开户注册", "是否注册身份证", "是否注册银行卡",
                "是否提交开户", "是否开户成功", "是否新开户", "是否入金",
                "是否有效户", "是否存量客户", "是否创建完资金账号"]
for c in bool_cols_am:
    if c in am.columns:
        am[c] = to_bool_col(am[c])
am = parse_dates(am)
load_and_store("fact_conv_appmarket", am)

# ---------- DWS: 厂商日聚合（统一漏斗超集） ----------
print("\n[DWS] 厂商广告投放分析 → agg_vendor_daily")
vd = pd.read_excel(SRC_FILES["vendor_daily"], sheet_name="Sheet1")
vd = clean_nan(vd)
vd = parse_dates(vd)
load_and_store("agg_vendor_daily", vd)

# ---------- DWS: 小红书笔记聚合 ----------
print("\n[DWS] 6.1小红书笔记表 → agg_xhs_note")
xn = pd.read_excel(SRC_FILES["xhs_note"])
xn = clean_nan(xn)
# 丢弃脏列 Unnamed: 24
xn = xn.loc[:, ~xn.columns.astype(str).str.startswith("Unnamed")]
xn = parse_dates(xn)
load_and_store("agg_xhs_note", xn)

# ---------- DWS: 渠道开户聚合 ----------
print("\n[DWS] 0.1开户渠道分析明细 → agg_daily_channel_open")
co = pd.read_excel(SRC_FILES["channel_open"], sheet_name="开户渠道分析")
co = clean_nan(co)
load_and_store("agg_daily_channel_open", co)

# ---------- 汇总 ----------
print("\n=== 落库完成，校验行数 ===")
with engine.connect() as conn:
    for t in ["dim_account", "dim_vendor", "dim_channel_category", "dim_channel",
              "fact_conv_content", "fact_conv_appmarket",
              "agg_vendor_daily", "agg_xhs_note", "agg_daily_channel_open"]:
        n = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
        print(f"  {t}: {n} 行")
print("\n全部完成。旧表（backend_conversions / xhs_* / raw_ad_data_* / daily_metrics_unified 等）保持不变。")
