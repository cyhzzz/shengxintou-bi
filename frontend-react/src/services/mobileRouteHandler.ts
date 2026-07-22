/**
 * 移动端本地路由处理器
 *
 * 将前端 API 请求映射到本地 SQLite 查询，在离线模式下替代 Flask 后端。
 * SQL 查询从后端 Python（omni_channel.py / app_market.py / dashboard.py / cost_analysis.py）翻译而来。
 *
 * 业务不变式（与后端一致）：
 * - 应用市场漏斗：强制 渠道类型 = '互联网引流'
 * - 内容平台存量剔除：是否为存量客户 = 0 OR IS NULL
 */
import { querySql } from './mobileSqlite';

// ============================================================================
// 工具函数
// ============================================================================

function toInt(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toFloat(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** 构建日期过滤条件 */
function dateClause(col: string, sd?: string, ed?: string): { sql: string; params: unknown[] } | null {
  if (sd && ed) {
    return { sql: `"${col}" >= ? AND "${col}" <= ?`, params: [sd, ed] };
  }
  return null;
}

/** 构建 IN 过滤条件 */
function inClause(col: string, values?: string[] | string): { sql: string; params: unknown[] } | null {
  if (!values) return null;
  const arr = Array.isArray(values) ? values : String(values).split(',').map(s => s.trim()).filter(Boolean);
  if (arr.length === 0) return null;
  const placeholders = arr.map(() => '?').join(', ');
  return { sql: `"${col}" IN (${placeholders})`, params: arr };
}

/** 组合 WHERE 子句 */
function buildWhere(conditions: ({ sql: string; params: unknown[] } | null)[]): { clause: string; params: unknown[] } {
  const valid = conditions.filter((c): c is { sql: string; params: unknown[] } => c !== null);
  if (valid.length === 0) return { clause: '', params: [] };
  return {
    clause: 'WHERE ' + valid.map(c => c.sql).join(' AND '),
    params: valid.flatMap(c => c.params),
  };
}

/** 从请求 body 提取 filters */
function getFilters(body: any): any {
  return body?.filters || {};
}

/** 从 filters 提取日期 */
function getDateRange(filters: any): { start_date?: string; end_date?: string } {
  const sd = filters?.start_date || (filters?.date_range?.[0] ?? undefined);
  const ed = filters?.end_date || (filters?.date_range?.[1] ?? undefined);
  return { start_date: sd, end_date: ed };
}

type Row = Record<string, any>;

// ============================================================================
// 全渠道获客 (omni-channel)
// ============================================================================

const CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流'];

async function handleOmniChannelSummary(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const catFilter = inClause('渠道类别', filters.channel_categories || filters.channel_category);
  const subFilter = inClause('渠道名称', filters.sub_channels || filters.sub_channel);
  const where = buildWhere([
    dateClause('时间区间', sd, ed),
    catFilter,
    subFilter,
  ]);

  // 1. 按渠道类别聚合
  const catSql = `SELECT "渠道类别" as channel_category,
    COALESCE(SUM("开户成功人数"), 0) as opens,
    COALESCE(SUM("入金户数"), 0) as deposit,
    COALESCE(SUM("有效户数"), 0) as valid
  FROM agg_daily_channel_open ${where.clause}
  GROUP BY "渠道类别"`;
  const catRows = await querySql<Row>(catSql, where.params);

  const catMap: Record<string, Row> = {};
  for (const r of catRows) {
    catMap[r.channel_category] = r;
  }

  const by_category: any[] = [];
  let total_opens = 0, total_deposit = 0, total_valid = 0;
  for (const cat of CATEGORY_ORDER) {
    const r = catMap[cat];
    if (!r) {
      by_category.push({ channel_category: cat, opens: 0, deposit: 0, valid: 0, valid_rate: 0, deposit_rate: 0 });
      continue;
    }
    const o = toInt(r.opens), dp = toInt(r.deposit), v = toInt(r.valid);
    total_opens += o; total_deposit += dp; total_valid += v;
    by_category.push({
      channel_category: cat,
      opens: o, deposit: dp, valid: v,
      valid_rate: o > 0 ? round2(v / o * 100) : 0,
      deposit_rate: o > 0 ? round2(dp / o * 100) : 0,
    });
  }

  // 2. 按子渠道聚合
  const subSql = `SELECT "渠道类别" as channel_category,
    "渠道名称" as channel_name,
    COALESCE(SUM("开户成功人数"), 0) as opens,
    COALESCE(SUM("入金户数"), 0) as deposit,
    COALESCE(SUM("有效户数"), 0) as valid
  FROM agg_daily_channel_open ${where.clause}
  GROUP BY "渠道类别", "渠道名称"`;
  const subRows = await querySql<Row>(subSql, where.params);

  const by_subchannel: any[] = [];
  for (const r of subRows) {
    const o = toInt(r.opens), dp = toInt(r.deposit), v = toInt(r.valid);
    if (o === 0 && dp === 0 && v === 0) continue;
    by_subchannel.push({
      channel_category: r.channel_category || '未归因',
      channel_name: r.channel_name || '未归因',
      opens: o, deposit: dp, valid: v,
      valid_rate: o > 0 ? round2(v / o * 100) : 0,
      deposit_rate: o > 0 ? round2(dp / o * 100) : 0,
    });
  }
  by_subchannel.sort((a, b) => -a.opens || a.channel_category.localeCompare(b.channel_category) || a.channel_name.localeCompare(b.channel_name));

  // top category
  const non_empty = by_category.filter(c => c.opens || c.deposit || c.valid);
  const top_row = non_empty.length > 0 ? non_empty.reduce((max, x) => x.opens > max.opens ? x : max) : null;
  const top_category_name = top_row ? top_row.channel_category : '';
  const top_opens = top_row ? top_row.opens : 0;
  const top_share = total_opens > 0 && top_row ? round2(top_opens / total_opens * 100) : 0;

  return {
    totals: {
      opens: total_opens, deposit: total_deposit, valid: total_valid,
      total_opens, total_deposit, total_valid,
    },
    by_category,
    by_subchannel,
    top_category: { channel_category: top_category_name, opens: top_opens, share: top_share },
  };
}

async function handleOmniChannelFilterOptions(): Promise<any> {
  const catRows = await querySql<Row>(
    `SELECT DISTINCT "渠道类别" as v FROM agg_daily_channel_open WHERE "渠道类别" IS NOT NULL ORDER BY "渠道类别"`
  );
  const subRows = await querySql<Row>(
    `SELECT DISTINCT "渠道名称" as v FROM agg_daily_channel_open WHERE "渠道名称" IS NOT NULL ORDER BY "渠道名称"`
  );
  return {
    channel_categories: catRows.map(r => r.v),
    sub_channels: subRows.map(r => r.v),
  };
}

async function handleOmniChannelDailyCalendar(body: any): Promise<any> {
  const data = body || {};
  const days = Math.max(7, Math.min(366, toInt(data.days || 365)));
  const filters = getFilters(data);
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const where = buildWhere([
    { sql: '"日期" >= ? AND "日期" <= ?', params: [start, end] },
    inClause('平台', filters.platforms),
    inClause('厂商', filters.agencies),
    inClause('业务模式', filters.business_models),
  ]);

  const sql = `SELECT "日期" as date, COALESCE(SUM("开户人数"), 0) as opens
    FROM agg_vendor_daily ${where.clause}
    GROUP BY "日期" ORDER BY "日期"`;
  const rows = await querySql<Row>(sql, where.params);
  return rows.map(r => ({ date: r.date, opens: toInt(r.opens) }));
}

async function handleOmniChannelDailyTrend(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const where = buildWhere([
    dateClause('时间区间', sd, ed),
    inClause('渠道类别', filters.channel_categories || filters.channel_category),
    inClause('渠道名称', filters.sub_channels || filters.sub_channel),
  ]);

  const sql = `SELECT "时间区间" as date,
    "渠道类别" as channel_category,
    "渠道名称" as channel_name,
    COALESCE(SUM("开户成功人数"), 0) as opens,
    COALESCE(SUM("入金户数"), 0) as deposit,
    COALESCE(SUM("有效户数"), 0) as valid
  FROM agg_daily_channel_open ${where.clause}
  GROUP BY "时间区间", "渠道类别", "渠道名称"`;
  const rows = await querySql<Row>(sql, where.params);

  const trend: any[] = [];
  for (const r of rows) {
    const d = String(r.date || '').slice(0, 10);
    if (!d || !r.channel_category) continue;
    trend.push({
      date: d,
      channel_category: r.channel_category,
      channel_name: r.channel_name || '未归因',
      opens: toInt(r.opens), deposit: toInt(r.deposit), valid: toInt(r.valid),
    });
  }
  trend.sort((a, b) => a.date.localeCompare(b.date) || a.channel_category.localeCompare(b.channel_category) || a.channel_name.localeCompare(b.channel_name));
  return { daily_trend: trend, trend };
}

async function handleOmniChannelByChannel(body: any): Promise<any> {
  const filters = getFilters(body);
  const channel_category = (body?.channel_category || '').trim();
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const subFromFilters = inClause('渠道名称', filters.sub_channels || filters.sub_channel);
  const subFromBody = inClause('渠道名称', body?.sub_channels || body?.sub_channel);

  const conditions: ({ sql: string; params: unknown[] } | null)[] = [
    dateClause('时间区间', sd, ed),
  ];
  if (channel_category) {
    conditions.push({ sql: '"渠道类别" = ?', params: [channel_category] });
  } else {
    conditions.push(inClause('渠道类别', filters.channel_categories || filters.channel_category));
  }
  if (subFromBody) {
    conditions.push(subFromBody);
  } else if (subFromFilters) {
    conditions.push(subFromFilters);
  }
  const where = buildWhere(conditions);

  const sql = `SELECT "渠道类别" as channel_category,
    "渠道名称" as channel_name,
    COALESCE(SUM("开户成功人数"), 0) as opens,
    COALESCE(SUM("入金户数"), 0) as deposit,
    COALESCE(SUM("有效户数"), 0) as valid
  FROM agg_daily_channel_open ${where.clause}
  GROUP BY "渠道类别", "渠道名称"`;
  const rows = await querySql<Row>(sql, where.params);

  const items: any[] = [];
  for (const r of rows) {
    const o = toInt(r.opens), dp = toInt(r.deposit), v = toInt(r.valid);
    if (o === 0 && dp === 0 && v === 0) continue;
    items.push({
      channel_category: r.channel_category || '未归因',
      channel_name: r.channel_name || '未归因',
      opens: o, deposit: dp, valid: v,
      valid_rate: o > 0 ? round2(v / o * 100) : 0,
      deposit_rate: o > 0 ? round2(dp / o * 100) : 0,
    });
  }
  items.sort((a, b) => b.opens - a.opens);
  return { items, channel_category: channel_category || 'all' };
}

// ============================================================================
// 应用市场 (app-market)
// ============================================================================

const FUNNEL_STAGES: [string, string][] = [
  ['是否激活APP', '激活APP'],
  ['是否开户注册', '开户注册'],
  ['是否注册身份证', '注册身份证'],
  ['是否注册银行卡', '注册银行卡'],
  ['是否提交开户', '提交开户'],
  ['是否开户成功', '开户成功'],
  ['是否新开户', '新开户'],
  ['是否入金', '入金'],
  ['是否有效户', '有效户'],
];

function funnelWithRates(counts: Record<string, number>): any[] {
  const out: any[] = [{ step: '激活APP', count: counts['激活APP'], rate: 100.0, step_rate: 100.0 }];
  let prev = counts['激活APP'];
  const keys = ['开户注册', '注册身份证', '注册银行卡', '提交开户', '开户成功', '新开户', '入金', '有效户'];
  for (const k of keys) {
    const v = counts[k];
    const rate = prev > 0 ? round2(v / prev * 100) : 0;
    const step_rate = counts['激活APP'] > 0 ? round2(v / counts['激活APP'] * 100) : 0;
    out.push({ step: k, count: v, rate, step_rate });
    prev = v;
  }
  return out;
}

/** 应用市场漏斗过滤：强制渠道类型='互联网引流' + 通用过滤 */
function appMarketFunnelWhere(filters: any): { clause: string; params: unknown[] } {
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  return buildWhere([
    { sql: '"渠道类型" = ?', params: ['互联网引流'] }, // 业务不变式
    dateClause('下载日期', sd, ed),
    inClause('应用市场', filters.app_markets),
  ]);
}

async function handleAppMarketFunnel(body: any): Promise<any> {
  const filters = getFilters(body);
  const where = appMarketFunnelWhere(filters);

  const selectCols = FUNNEL_STAGES.map(
    ([col, alias]) => `COALESCE(SUM("${col}"), 0) as "${alias}"`
  ).join(', ');

  const sql = `SELECT ${selectCols} FROM fact_conv_appmarket ${where.clause}`;
  const rows = await querySql<Row>(sql, where.params);
  const r = rows[0] || {};

  const counts: Record<string, number> = {};
  for (const [, alias] of FUNNEL_STAGES) {
    counts[alias] = toInt(r[alias]);
  }

  return { counts, funnel: funnelWithRates(counts) };
}

async function handleAppMarketFilterOptions(): Promise<any> {
  const marketRows = await querySql<Row>(
    `SELECT DISTINCT "应用市场" as v FROM fact_conv_appmarket WHERE "应用市场" IS NOT NULL`
  );
  const typeRows = await querySql<Row>(
    `SELECT DISTINCT "渠道类型" as v FROM fact_conv_appmarket WHERE "渠道类型" IS NOT NULL`
  );
  const markets = marketRows.map(r => r.v).sort((a: string, b: string) => {
    const ka = (/^[\x00-\x7F]/.test(a) ? 'a' : 'z') + a;
    const kb = (/^[\x00-\x7F]/.test(b) ? 'a' : 'z') + b;
    return ka.localeCompare(kb);
  });
  return {
    app_markets: markets,
    channel_types: typeRows.map(r => r.v).sort(),
  };
}

// ============================================================================
// 仪表盘 (dashboard)
// ============================================================================

function dashboardWhere(filters: any): { clause: string; params: unknown[] } {
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  return buildWhere([
    dateClause('日期', sd, ed),
    inClause('平台', filters.platforms),
    inClause('厂商', filters.agencies),
    inClause('业务模式', filters.business_models),
  ]);
}

async function handleDashboardCoreMetrics(body: any): Promise<any> {
  const filters: any = {
    start_date: body?.start_date,
    end_date: body?.end_date,
    platforms: body?.platforms || [],
    agencies: body?.agencies || [],
    business_models: body?.business_models || [],
  };
  const where = dashboardWhere(filters);

  const sql = `SELECT
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("线索数"), 0) as leads_wechat,
    COALESCE(SUM("APP激活人数"), 0) as leads_app,
    COALESCE(SUM("线索成本" * "线索数"), 0) as cost_wechat_w,
    COALESCE(SUM("APP激活成本" * "APP激活人数"), 0) as cost_app_w,
    COALESCE(SUM("开户人数"), 0) as opened,
    COALESCE(SUM("有效户人数"), 0) as valid,
    COALESCE(SUM("客户资产"), 0) as assets,
    COALESCE(SUM("客户创收"), 0) as contribution,
    COALESCE(SUM("存量客户资产"), 0) as existing_assets
  FROM agg_vendor_daily ${where.clause}`;
  const rows = await querySql<Row>(sql, where.params);
  const r = rows[0] || {};

  const cost = toFloat(r.cost);
  const impr = toInt(r.impressions);
  const leads_wechat = toInt(r.leads_wechat);
  const leads_app = toInt(r.leads_app);
  const cost_wechat_w = toFloat(r.cost_wechat_w);
  const cost_app_w = toFloat(r.cost_app_w);
  const opened = toInt(r.opened);
  const valid = toInt(r.valid);
  const assets = toFloat(r.assets);
  const contrib = toFloat(r.contribution);
  const exist_assets = toFloat(r.existing_assets);

  const core = {
    new_customers: opened,
    investment: round2(cost),
    new_valid_accounts: valid,
    leads_wechat,
    leads_app,
    total_impressions: impr,
    customer_assets: round2(assets),
    customer_contribution: round2(contrib),
    existing_customers_assets: round2(exist_assets),
    cost_per_valid_account: valid > 0 ? round2(cost / valid) : 0,
    cost_per_wechat_lead: leads_wechat > 0 ? round2(cost_wechat_w / leads_wechat) : 0,
    cost_per_app_activation: leads_app > 0 ? round2(cost_app_w / leads_app) : 0,
    cost_per_account: opened > 0 ? round2(cost / opened) : 0,
  };

  return { core_metrics: core, wow_changes: {} };
}

async function handleDashboardTrendData(body: any): Promise<any> {
  const filters: any = {
    start_date: body?.start_date,
    end_date: body?.end_date,
    platforms: body?.platforms || [],
    agencies: body?.agencies || [],
    business_models: body?.business_models || [],
  };
  const where = dashboardWhere(filters);

  const sql = `SELECT "日期" as period,
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("APP激活人数"), 0) as leads_app,
    COALESCE(SUM("线索成本" * "线索数"), 0) as cost_wechat_w,
    COALESCE(SUM("APP激活成本" * "APP激活人数"), 0) as cost_app_w,
    COALESCE(SUM("开户人数"), 0) as opened,
    COALESCE(SUM("有效户人数"), 0) as valid
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "日期" ORDER BY "日期"`;
  const rows = await querySql<Row>(sql, where.params);

  const dates: string[] = [];
  const trend_data: any[] = [];
  for (const r of rows) {
    const d = String(r.period);
    const cost = toFloat(r.cost);
    const impr = toInt(r.impressions);
    const clk = toInt(r.clicks);
    const leads = toInt(r.leads);
    const leads_app = toInt(r.leads_app);
    const cost_wechat_w = toFloat(r.cost_wechat_w);
    const cost_app_w = toFloat(r.cost_app_w);
    const opened = toInt(r.opened);
    const valid = toInt(r.valid);

    dates.push(d);
    trend_data.push({
      date: d,
      cost: round2(cost), impressions: impr, clicks: clk,
      leads, leads_app, opened, valid,
      _derived: {
        cost_per_lead: leads > 0 ? round2(cost / leads) : 0,
        cost_per_wechat_lead: leads > 0 ? round2(cost_wechat_w / leads) : 0,
        cost_per_app_activation: leads_app > 0 ? round2(cost_app_w / leads_app) : 0,
        cost_wechat: leads > 0 ? round2(cost_wechat_w / leads) : 0,
        cost_app: leads_app > 0 ? round2(cost_app_w / leads_app) : 0,
        cost_per_account: opened > 0 ? round2(cost / opened) : 0,
        cost_per_valid_account: valid > 0 ? round2(cost / valid) : 0,
        ctr: impr > 0 ? round4(clk / impr * 100) : 0,
        click_to_lead_rate: clk > 0 ? round4(leads / clk * 100) : 0,
        lead_to_account_rate: leads > 0 ? round4(opened / leads * 100) : 0,
        account_to_valid_rate: opened > 0 ? round4(valid / opened * 100) : 0,
      },
      value: 0,
    });
  }

  return { dates, trend_data, metric_type: body?.metric_type || 'cost_per_lead' };
}

// ============================================================================
// 成本分析 (cost-analysis)
// ============================================================================

async function handleCostAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const where = buildWhere([
    dateClause('日期', sd, ed),
    inClause('平台', filters.platforms),
    inClause('厂商', filters.agencies),
    inClause('业务模式', filters.business_models),
  ]);

  const sql = `SELECT "日期", "平台", "厂商",
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开户人数"), 0) as opened
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "日期", "平台", "厂商"`;
  const rows = await querySql<Row>(sql, where.params);

  const output: any[] = [];
  for (const r of rows) {
    const cost = toFloat(r.cost);
    const impr = toInt(r.impressions);
    const clk = toInt(r.clicks);
    const ld = toInt(r.leads);
    const op = toInt(r.opened);
    output.push({
      platform: r['平台'],
      agency: r['厂商'],
      metrics: { cost: round2(cost), impressions: impr, clicks: clk, leads: ld, new_accounts: op },
      cost_metrics: {
        cost_per_lead: ld > 0 ? round2(cost / ld) : 0,
        cost_per_account: op > 0 ? round2(cost / op) : 0,
        cost_per_click: clk > 0 ? round2(cost / clk) : 0,
        cpm: impr > 0 ? round2(cost / impr * 1000) : 0,
      },
    });
  }

  const tc = output.reduce((s, i) => s + i.metrics.cost, 0);
  const tl = output.reduce((s, i) => s + i.metrics.leads, 0);
  const ta = output.reduce((s, i) => s + i.metrics.new_accounts, 0);

  return {
    data: output,
    summary: {
      total_cost: round2(tc),
      total_leads: tl,
      total_accounts: ta,
      avg_cost_per_lead: tl > 0 ? round2(tc / tl) : 0,
      avg_cost_per_account: ta > 0 ? round2(tc / ta) : 0,
    },
  };
}

// ============================================================================
// 路由分发
// ============================================================================

/** 从完整 URL 提取 /api/v1/ 之后的路径 */
function extractApiPath(url: string): string {
  const match = url.match(/\/api\/v1\/(.+?)(?:\?|$)/);
  return match ? match[1] : '';
}

/**
 * 移动端路由处理器入口
 *
 * 将 API 请求 URL + body 映射到本地 SQLite 查询，返回与 Flask 后端一致的 data 结构。
 */
export async function mobileRouteHandler(url: string, body: any): Promise<any> {
  const path = extractApiPath(url);

  switch (path) {
    // 全渠道获客
    case 'reports/omni-channel/summary':
      return handleOmniChannelSummary(body);
    case 'reports/omni-channel/filter-options':
      return handleOmniChannelFilterOptions();
    case 'reports/omni-channel/daily-calendar':
      return handleOmniChannelDailyCalendar(body);
    case 'reports/omni-channel/daily-trend':
      return handleOmniChannelDailyTrend(body);
    case 'reports/omni-channel/by-channel':
      return handleOmniChannelByChannel(body);

    // 应用市场
    case 'reports/app-market/funnel':
      return handleAppMarketFunnel(body);
    case 'reports/app-market/filter-options':
      return handleAppMarketFilterOptions();

    // 仪表盘
    case 'dashboard/core-metrics':
      return handleDashboardCoreMetrics(body);
    case 'dashboard/trend-data':
      return handleDashboardTrendData(body);

    // 成本分析
    case 'cost-analysis':
      return handleCostAnalysis(body);

    default:
      throw new Error(`Mobile API not implemented: ${path}`);
  }
}
