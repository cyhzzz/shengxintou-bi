# -*- coding: utf-8 -*-
"""代理商简称↔全称映射工具

dim_account 表存有 agency_name（全称）、agency_short（简称/显示名）、agency_letter（字母简称）。
实测口径（2026-09）：agg_vendor_daily.厂商 / fact_plan_daily.厂商名称 / fact_conv_content.广告代理商
存的都是简称（上游 ETL 已按 dim_account 归一化；广告代理商以简称为主，含"申万宏源直投""小红书直投"等变体）。
因此厂商类字段的 SQL 过滤直接用简称 .in_() 即为正确实现（恒等映射），
同一代理商在不同平台的全称可能有差异（如"申万宏源-量子" vs "北京量子聚合文化传播有限公司"），
但简称是共同的。

本模块直接从 dim_account 表去重构建映射，不依赖 dim_vendor 派生表。

提供：
  - get_all_shorts() -> [简称列表]        # 下拉选项的权威来源
  - short_to_full(short) -> [全称列表]    # 展示辅助
  - full_to_short(full) -> 简称           # 显示时用全称找简称
  - enrich_item/enrich_items(items, key)  # 在数据列表里补 agency_short 字段
  - expand_short_to_fulls(shorts) -> [全称列表]  # 仅限展示用途，见函数警告
  - get_app_market_vendors() -> {厂商: [渠道]}   # 应用市场包干厂商写死映射
  - agency_lead_clause(col, agencies) -> 条件    # 广告代理商筛选：'未归因'翻译为 NULL/空串
"""

import json
import os

from sqlalchemy import or_

from backend.models_v2 import DimAccount
from backend.database import db

# 代理商/厂商筛选的"未归因"选项值（展示层 or '未归因' 兜底的统一业务分组名）
AGENCY_UNATTRIBUTED = '未归因'

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
    """将简称列表展开为全称列表 —— 仅限展示用途

    ⚠️ 禁止用于厂商类字段的 SQL WHERE IN 过滤！
    dim_account.agency_name 存的是带前缀的长名（如"申万宏源-量子"），
    而 agg_vendor_daily.厂商 / fact_plan_daily.厂商名称 等业务字段存的是简称；
    展开成全称去过滤会全部落空，导致报表数据全空（2026-09 小红书计划分析事故同因）。
    合法用途：metadata.py 生成 agencies.full_names / agency_full_map 供前端展示辅助。
    """
    fulls = []
    for s in shorts:
        fulls.extend(short_to_full(s))
    return list(set(fulls))


_app_market_cache = None


def get_app_market_vendors():
    """应用市场包干厂商→渠道写死映射（backend/config/agency_market_channels.json）

    背景：有米/哇棒/kiwi 三家按应用市场包干投放（非账号投放），上游账号映射未覆盖，
    dim_account 无记录，导致 Web 端厂商下拉选不到。metadata.py 从本配置合并补充下拉选项。
    返回 {厂商简称: [渠道列表]}；配置缺失或损坏时返回 {}（不影响启动）。
    """
    global _app_market_cache
    if _app_market_cache is None:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   '..', 'config', 'agency_market_channels.json')
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            _app_market_cache = {k: list((v or {}).get('channels', []))
                                 for k, v in (data.get('mappings') or {}).items()}
        except Exception:
            _app_market_cache = {}
    return dict(_app_market_cache)


def agency_lead_clause(col, agencies: list):
    """广告代理商筛选子句（fact_conv_content.广告代理商）：'未归因'翻译为 NULL/空串条件

    业务口径：广告代理商为 NULL/空串的线索在展示层兜底为'未归因'，是合理业务分组，可选可看。
    ⚠️ 仅适用于以 NULL/空串表示未归因的字段（fact_conv_content.广告代理商）；
    agg_vendor_daily.厂商 的'未归因'是上游写入的真实字符串值，直接 .in_() 即可命中，禁用本函数。
    agencies 为空时返回 None（调用方跳过过滤）。
    """
    if not agencies:
        return None
    normal = [a for a in agencies if a != AGENCY_UNATTRIBUTED]
    has_unattr = len(normal) != len(agencies)
    if has_unattr and normal:
        return or_(col.in_(normal), col.is_(None), col == '')
    if has_unattr:
        return or_(col.is_(None), col == '')
    return col.in_(normal)
