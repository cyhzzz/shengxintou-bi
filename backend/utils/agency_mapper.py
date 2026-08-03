# -*- coding: utf-8 -*-
"""代理商简称→全称映射工具

dim_account 表存有 agency_name（全称）、agency_short（简称/显示名）、agency_letter（字母简称）。
agg_vendor_daily.厂商 和 fact_conv_content.广告代理商 存的是全称。
同一代理商在不同平台的全称可能有差异（如"量子" vs "量子科技"），
但简称是共同的。

本模块直接从 dim_account 表去重构建映射，不依赖 dim_vendor 派生表。

提供：
  - load_agency_map() -> {简称: [全称1, 全称2, ...]}
  - short_to_full(short) -> [全称列表]  # 筛选时用简称查全称
  - full_to_short(full) -> 简称          # 显示时用全称找简称
  - enrich_agency_short(items, key)      # 在数据列表里补 agency_short 字段
"""

from backend.models_v2 import DimAccount
from backend.database import db

_cache = None


def _build_map():
    """从 DimAccount 表去重构建简称→全称映射"""
    rows = db.session.query(DimAccount).all()
    short_to_fulls = {}  # {简称: set(全称)}
    full_to_short = {}   # {全称: 简称}

    for r in rows:
        if r.agency_short and r.agency_name:
            short = r.agency_short.strip()
            full = r.agency_name.strip()
            if short not in short_to_fulls:
                short_to_fulls[short] = set()
            short_to_fulls[short].add(full)
            full_to_short[full] = short

    return {
        'short_to_fulls': {k: sorted(v) for k, v in short_to_fulls.items()},
        'full_to_short': full_to_short,
        'all_shorts': sorted(short_to_fulls.keys()),
    }


def _get_map():
    global _cache
    if _cache is None:
        _cache = _build_map()
    return _cache


def reset_cache():
    """当 DimVendor 表有变动时，手动调用刷新缓存"""
    global _cache
    _cache = None
    return _get_map()


def get_all_shorts():
    """返回所有简称列表"""
    return _get_map()['all_shorts']


def short_to_full(short: str):
    """简称 -> [全称列表]（同一简称可能对应多个全称）"""
    return _get_map()['short_to_fulls'].get(short, [short])


def full_to_short(full: str):
    """全称 -> 简称；找不到则做包含匹配兜底，仍找不到返回全称本身

    背景：agg_vendor_daily.厂商 存的是短名（如 "信则"），但 dim_account.agency_name
    存的是带前缀的长名（如 "申万宏源-信则"）。精确匹配查不到时，尝试用包含匹配
    （长名包含短名，或短名包含长名）作为兜底，避免前端表格代理商字段为空。
    """
    if not full:
        return ''
    m = _get_map()
    # 1. 精确匹配（最快路径）
    if full in m['full_to_short']:
        return m['full_to_short'][full]
    # 2. 包含匹配兜底：长名以 "-短名" 结尾，或短名包含长名
    for long_name, short in m['full_to_short'].items():
        if long_name.endswith('-' + full) or long_name == full or full in long_name:
            return short
    return full


def enrich_item(item: dict, key: str = "agency"):
    """给单个 item 补 agency_short 字段（基于 item[key] 全称找简称）"""
    full = item.get(key, "")
    item["agency_short"] = full_to_short(full) if full else ""
    return item


def enrich_items(items: list, key: str = "agency"):
    """给列表每个 item 补 agency_short 字段"""
    for item in items:
        enrich_item(item, key)
    return items


def expand_short_to_fulls(shorts: list):
    """将简称列表展开为全称列表（用于 SQL WHERE IN）"""
    fulls = []
    for s in shorts:
        fulls.extend(short_to_full(s))
    return list(set(fulls))
