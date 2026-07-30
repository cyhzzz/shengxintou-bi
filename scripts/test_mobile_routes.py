"""
移动端路由处理器 SQL 测试（Python 版）

模拟 mobileRouteHandler.ts 中所有 SQL 查询，验证在本地 SQLite 上能正常执行。
"""
import sqlite3
import json
import sys
import os

# 优先用环境变量，回退到默认数据库路径
DB_PATH = os.environ.get("DATABASE_PATH") or r"D:\AIproject\省心投BI\database\shengxintou.db"

def query_sql(sql, params=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

tests = [
    {
        'name': 'omni-channel/summary',
        'sql': '''SELECT "渠道类别" as channel_category,
            COALESCE(SUM("开户成功人数"), 0) as opens,
            COALESCE(SUM("入金户数"), 0) as deposit,
            COALESCE(SUM("有效户数"), 0) as valid
          FROM agg_daily_channel_open GROUP BY "渠道类别"''',
        'params': [],
    },
    {
        'name': 'omni-channel/filter-options',
        'sql': 'SELECT DISTINCT "渠道类别" as v FROM agg_daily_channel_open WHERE "渠道类别" IS NOT NULL ORDER BY "渠道类别"',
        'params': [],
    },
    {
        'name': 'omni-channel/daily-calendar',
        'sql': '''SELECT "日期" as date, COALESCE(SUM("开户人数"), 0) as opens
          FROM agg_vendor_daily WHERE "日期" >= ? AND "日期" <= ?
          GROUP BY "日期" ORDER BY "日期"''',
        'params': ['2025-01-01', '2025-12-31'],
    },
    {
        'name': 'omni-channel/daily-trend',
        'sql': '''SELECT "时间区间" as date, "渠道类别" as channel_category, "渠道名称" as channel_name,
            COALESCE(SUM("开户成功人数"), 0) as opens,
            COALESCE(SUM("入金户数"), 0) as deposit,
            COALESCE(SUM("有效户数"), 0) as valid
          FROM agg_daily_channel_open GROUP BY "时间区间", "渠道类别", "渠道名称"''',
        'params': [],
    },
    {
        'name': 'omni-channel/by-channel',
        'sql': '''SELECT "渠道类别" as channel_category, "渠道名称" as channel_name,
            COALESCE(SUM("开户成功人数"), 0) as opens,
            COALESCE(SUM("入金户数"), 0) as deposit,
            COALESCE(SUM("有效户数"), 0) as valid
          FROM agg_daily_channel_open GROUP BY "渠道类别", "渠道名称"''',
        'params': [],
    },
    {
        'name': 'app-market/funnel',
        'sql': '''SELECT COALESCE(SUM("是否激活APP"), 0) as "激活APP",
            COALESCE(SUM("是否开户注册"), 0) as "开户注册",
            COALESCE(SUM("是否注册身份证"), 0) as "注册身份证",
            COALESCE(SUM("是否注册银行卡"), 0) as "注册银行卡",
            COALESCE(SUM("是否提交开户"), 0) as "提交开户",
            COALESCE(SUM("是否开户成功"), 0) as "开户成功",
            COALESCE(SUM("是否新开户"), 0) as "新开户",
            COALESCE(SUM("是否入金"), 0) as "入金",
            COALESCE(SUM("是否有效户"), 0) as "有效户"
          FROM fact_conv_appmarket WHERE "渠道类型" = ?''',
        'params': ['互联网引流'],
    },
    {
        'name': 'app-market/filter-options',
        'sql': 'SELECT DISTINCT "应用市场" as v FROM fact_conv_appmarket WHERE "应用市场" IS NOT NULL',
        'params': [],
    },
    {
        'name': 'dashboard/core-metrics',
        'sql': '''SELECT COALESCE(SUM("花费"), 0) as cost,
            COALESCE(SUM("展示量"), 0) as impressions,
            COALESCE(SUM("线索数"), 0) as leads_wechat,
            COALESCE(SUM("APP激活人数"), 0) as leads_app,
            COALESCE(SUM("开户人数"), 0) as opened,
            COALESCE(SUM("有效户人数"), 0) as valid,
            COALESCE(SUM("客户资产"), 0) as assets,
            COALESCE(SUM("客户创收"), 0) as contribution,
            COALESCE(SUM("存量客户资产"), 0) as existing_assets
          FROM agg_vendor_daily''',
        'params': [],
    },
    {
        'name': 'dashboard/trend-data',
        'sql': '''SELECT "日期" as period, COALESCE(SUM("花费"), 0) as cost,
            COALESCE(SUM("展示量"), 0) as impressions,
            COALESCE(SUM("点击量"), 0) as clicks,
            COALESCE(SUM("线索数"), 0) as leads,
            COALESCE(SUM("APP激活人数"), 0) as leads_app,
            COALESCE(SUM("开户人数"), 0) as opened,
            COALESCE(SUM("有效户人数"), 0) as valid
          FROM agg_vendor_daily GROUP BY "日期" ORDER BY "日期" LIMIT 5''',
        'params': [],
    },
    {
        'name': 'cost-analysis',
        'sql': '''SELECT "日期", "平台", "厂商",
            COALESCE(SUM("花费"), 0) as cost,
            COALESCE(SUM("展示量"), 0) as impressions,
            COALESCE(SUM("点击量"), 0) as clicks,
            COALESCE(SUM("线索数"), 0) as leads,
            COALESCE(SUM("开户人数"), 0) as opened
          FROM agg_vendor_daily GROUP BY "日期", "平台", "厂商" LIMIT 5''',
        'params': [],
    },
    {
        'name': 'reports/app-market/cost-analysis',
        'sql': '''SELECT "平台",
            COALESCE(SUM("花费"), 0) as total_spend,
            COALESCE(SUM("开户人数"), 0) as total_open
          FROM agg_vendor_daily
          WHERE "日期" >= ? AND "日期" <= ? AND "花费" > 0
            AND "平台" IN ('华为', '小米', '荣耀', 'oppo', 'vivo', '苹果')
          GROUP BY "平台" ORDER BY "平台"''',
        'params': ['2026-01-01', '2026-12-31'],
    },
]

if __name__ == '__main__':
    print('=' * 60)
    print('移动端路由处理器 SQL 测试')
    print('=' * 60)
    pass_count = 0
    fail_count = 0
    for t in tests:
        try:
            rows = query_sql(t['sql'], t['params'])
            print(f"[PASS] {t['name']} ({len(rows)} rows)")
            if rows:
                sample = json.dumps(rows[0], ensure_ascii=False, default=str)
                print(f"  sample: {sample[:200]}")
            pass_count += 1
        except Exception as e:
            print(f"[FAIL] {t['name']}: {e}")
            fail_count += 1
    print('=' * 60)
    print(f"总计: {pass_count} 通过, {fail_count} 失败")
    print('=' * 60)
    sys.exit(1 if fail_count > 0 else 0)
