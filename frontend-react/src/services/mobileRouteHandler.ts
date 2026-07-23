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
  const metric_type = body?.metric_type || 'cost_per_lead';

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

  // v3.5.4：按 metric_type 计算 value（对齐后端 dashboard.py 的 _per_metric）
  const selectValue = (p: Record<string, number>): number => {
    const mt = metric_type;
    if (mt === 'cost_per_lead') return p.leads > 0 ? round2(p.cost / p.leads) : 0;
    if (mt === 'cost_per_wechat_lead') return p.leads > 0 ? round2(p.cost_wechat_w / p.leads) : 0;
    if (mt === 'cost_per_app_activation') return p.leads_app > 0 ? round2(p.cost_app_w / p.leads_app) : 0;
    if (mt === 'cost_per_customer' || mt === 'cost_per_account') return p.opened > 0 ? round2(p.cost / p.opened) : 0;
    if (mt === 'cost_per_valid_account') return p.valid > 0 ? round2(p.cost / p.valid) : 0;
    if (mt === 'investment') return round2(p.cost);
    if (mt === 'impressions') return p.impressions;
    if (mt === 'clicks') return p.clicks;
    if (mt === 'leads' || mt === 'leads_wechat') return p.leads;
    if (mt === 'leads_app') return p.leads_app;
    if (mt === 'new_customers') return p.opened;
    if (mt === 'valid_customers') return p.valid;
    return 0; // 双系列等无对应值
  };

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

    const p = { cost, impressions: impr, clicks: clk, leads, leads_app, cost_wechat_w, cost_app_w, opened, valid };
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
      value: selectValue(p),
    });
  }

  return { dates, trend_data, metric_type };
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
// 应用市场总览 (app-market/summary)
// ============================================================================

/** 应用市场漏斗过滤（强制渠道类型=互联网引流）+ 通用过滤 */
function appMarketWhere(filters: any, includeChannelTypeFilter = true): { clause: string; params: unknown[] } {
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const conditions: ({ sql: string; params: unknown[] } | null)[] = [
    dateClause('下载日期', sd, ed),
    inClause('应用市场', filters.app_markets),
  ];
  if (includeChannelTypeFilter) {
    conditions.push({ sql: '"渠道类型" = ?', params: ['互联网引流'] });
  } else {
    conditions.push(inClause('渠道类型', filters.channel_types));
  }
  return buildWhere(conditions);
}

const FUNNEL_SUMS = FUNNEL_STAGES.map(
  ([col, alias]) => `COALESCE(SUM("${col}"), 0) as "${alias}"`
).join(', ');

function funnelCountsFromRow(r: Row): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [, alias] of FUNNEL_STAGES) {
    counts[alias] = toInt(r[alias]);
  }
  return counts;
}

async function handleAppMarketSummary(body: any): Promise<any> {
  const filters = getFilters(body);
  const where = appMarketWhere(filters, true);

  // 1. 总计
  const totalSql = `SELECT ${FUNNEL_SUMS} FROM fact_conv_appmarket ${where.clause}`;
  const totalRows = await querySql<Row>(totalSql, where.params);
  const total_counts = funnelCountsFromRow(totalRows[0] || {});

  // 新开户资产（仅 是否新开户=1 的行累加 总资产）
  const assetSql = `SELECT COALESCE(SUM(CASE WHEN "是否新开户" = 1 THEN "总资产" ELSE 0 END), 0) as v
    FROM fact_conv_appmarket ${where.clause}`;
  const assetRows = await querySql<Row>(assetSql, where.params);
  total_counts['新开户资产'] = round2(toFloat(assetRows[0]?.v));

  // 2. 按月 × 应用市场
  const monthSql = `SELECT substr("下载日期", 1, 7) as month, "应用市场" as app_market, ${FUNNEL_SUMS}
    FROM fact_conv_appmarket ${where.clause}
    GROUP BY month, "应用市场" ORDER BY month`;
  const monthRows = await querySql<Row>(monthSql, where.params);
  const by_month_market = monthRows.map(r => {
    const cnt = funnelCountsFromRow(r);
    return {
      month: r.month,
      app_market: r.app_market || '未归因',
      counts: cnt,
      final_open_rate: cnt['激活APP'] > 0 ? round4(cnt['开户成功'] / cnt['激活APP'] * 100) : 0,
      final_valid_rate: cnt['激活APP'] > 0 ? round4(cnt['有效户'] / cnt['激活APP'] * 100) : 0,
    };
  });

  // 3. 按应用市场
  const marketSql = `SELECT "应用市场" as app_market, ${FUNNEL_SUMS}
    FROM fact_conv_appmarket ${where.clause}
    GROUP BY "应用市场"`;
  const marketRows = await querySql<Row>(marketSql, where.params);
  const by_market = marketRows.map(r => {
    const cnt = funnelCountsFromRow(r);
    return { app_market: r.app_market || '未归因', counts: cnt, funnel: funnelWithRates(cnt) };
  });

  // 4. 按渠道类型 × 应用市场（不强制互联网引流，含所有类型）
  const typeWhere = appMarketWhere(filters, false);
  const typeSql = `SELECT "渠道类型" as channel_type, "应用市场" as app_market, ${FUNNEL_SUMS}
    FROM fact_conv_appmarket ${typeWhere.clause}
    GROUP BY "渠道类型", "应用市场"`;
  const typeRows = await querySql<Row>(typeSql, typeWhere.params);
  const by_channel_type = typeRows.map(r => {
    const cnt = funnelCountsFromRow(r);
    return { channel_type: r.channel_type || '未归因', app_market: r.app_market || '未归因', counts: cnt };
  });

  return {
    total_counts,
    total_funnel: funnelWithRates(total_counts),
    by_month_market,
    by_market,
    by_channel_type,
  };
}

/** 应用市场明细（分页） */
async function handleAppMarketDetail(body: any): Promise<any> {
  const filters = getFilters(body);
  const page = Math.max(1, toInt(body?.page));
  const page_size = Math.max(1, Math.min(200, toInt(body?.page_size) || 20));
  const offset = (page - 1) * page_size;
  const where = appMarketWhere(filters, false);

  const totalSql = `SELECT COUNT(*) as c FROM fact_conv_appmarket ${where.clause}`;
  const totalRows = await querySql<Row>(totalSql, where.params);
  const total = toInt(totalRows[0]?.c);

  const sql = `SELECT * FROM fact_conv_appmarket ${where.clause}
    ORDER BY id DESC LIMIT ${page_size} OFFSET ${offset}`;
  const rows = await querySql<Row>(sql, where.params);

  const detail = rows.map(r => ({
    id: r.id,
    '下载日期': String(r['下载日期'] || ''),
    '应用市场': r['应用市场'] || '',
    '应用市场名称': r['应用市场名称'] || '',
    '渠道类型': r['渠道类型'] || '',
    '设备号': r['设备号'] || '',
    '资金账号': r['资金账号'] || '',
    '激活APP': !!r['是否激活APP'],
    '开户注册': !!r['是否开户注册'],
    '注册身份证': !!r['是否注册身份证'],
    '注册银行卡': !!r['是否注册银行卡'],
    '提交开户': !!r['是否提交开户'],
    '开户成功': !!r['是否开户成功'],
    '新开户': !!r['是否新开户'],
    '入金': !!r['是否入金'],
    '有效户': !!r['是否有效户'],
    '总资产': r['总资产'] != null ? toFloat(r['总资产']) : null,
    '累计创收': r['累计创收'] != null ? toFloat(r['累计创收']) : null,
  }));

  return { detail, page, page_size, total };
}

// ============================================================================
// 代理商分析 (agency-analysis)
// ============================================================================

/** 从 URL query string 提取参数（GET 请求用） */
function parseQueryParams(url: string): Record<string, string> {
  const qIndex = url.indexOf('?');
  if (qIndex < 0) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(qIndex + 1).split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

async function handleAgencyAnalysis(url: string, body: any): Promise<any> {
  // GET 请求参数在 URL query；POST 在 body.filters
  let sd: string | undefined, ed: string | undefined;
  let platforms: string[] = [], agencies: string[] = [], business_models: string[] = [];

  if (body?.filters) {
    const f = body.filters;
    sd = f.start_date; ed = f.end_date;
    platforms = f.platforms || []; agencies = f.agencies || []; business_models = f.business_models || [];
  } else {
    const q = parseQueryParams(url);
    sd = q.start_date; ed = q.end_date;
    platforms = q.platforms ? q.platforms.split(',').filter(Boolean) : [];
    agencies = q.agencies ? q.agencies.split(',').filter(Boolean) : [];
    business_models = q.business_models ? q.business_models.split(',').filter(Boolean) : [];
  }

  const where = buildWhere([
    dateClause('日期', sd, ed),
    inClause('平台', platforms),
    inClause('厂商', agencies),
    inClause('业务模式', business_models),
  ]);

  // 1. summary（按 平台/业务模式/厂商 聚合）
  const sumSql = `SELECT "平台", "业务模式", "厂商",
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开户人数"), 0) as opened,
    COALESCE(SUM("有效户人数"), 0) as valid,
    COALESCE(SUM("客户资产"), 0) as assets,
    COALESCE(SUM("存量客户资产"), 0) as existing_assets
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "平台", "业务模式", "厂商"`;
  const sumRows = await querySql<Row>(sumSql, where.params);

  const summary: any[] = [];
  const plat_sub: Record<string, any> = {};
  const grand = { cost: 0, impressions: 0, clicks: 0, leads: 0, opened: 0, valid: 0, assets: 0, existing_assets: 0 };

  for (const r of sumRows) {
    const cost = toFloat(r.cost), leads = toInt(r.leads), opened = toInt(r.opened);
    const valid = toInt(r.valid), assets = toFloat(r.assets), exAssets = toFloat(r.existing_assets);
    const item = {
      platform: r['平台'],
      business_model: r['业务模式'],
      agency: r['厂商'],
      metrics: {
        cost: round2(cost), impressions: toInt(r.impressions), clicks: toInt(r.clicks),
        lead_users: leads, opened_account_users: opened, valid_customer_users: valid,
        opened_account_assets: round2(assets), existing_customer_assets: round2(exAssets),
        lead_cost: leads > 0 ? round2(cost / leads) : 0,
        account_cost: opened > 0 ? round2(cost / opened) : 0,
      },
    };
    summary.push(item);

    // 平台小计
    const p = item.platform;
    if (!plat_sub[p]) {
      plat_sub[p] = { platform: p, business_model: '', agency: `[${p} 小计]`, is_subtotal: true,
        metrics: { cost: 0, impressions: 0, clicks: 0, lead_users: 0, opened_account_users: 0, valid_customer_users: 0, opened_account_assets: 0, existing_customer_assets: 0 } };
    }
    const sm = plat_sub[p].metrics;
    sm.cost += cost; sm.impressions += item.metrics.impressions; sm.clicks += item.metrics.clicks;
    sm.lead_users += leads; sm.opened_account_users += opened; sm.valid_customer_users += valid;
    sm.opened_account_assets += assets; sm.existing_customer_assets += exAssets;

    // 合计
    grand.cost += cost; grand.impressions += item.metrics.impressions; grand.clicks += item.metrics.clicks;
    grand.leads += leads; grand.opened += opened; grand.valid += valid;
    grand.assets += assets; grand.existing_assets += exAssets;
  }

  // 小计四舍五入
  for (const p in plat_sub) {
    const m = plat_sub[p].metrics;
    m.cost = round2(m.cost); m.opened_account_assets = round2(m.opened_account_assets);
    m.existing_customer_assets = round2(m.existing_customer_assets);
  }

  const grand_row = {
    platform: '', business_model: '', agency: '[合计]', is_total: true,
    metrics: {
      cost: round2(grand.cost), impressions: grand.impressions, clicks: grand.clicks,
      lead_users: grand.leads, opened_account_users: grand.opened, valid_customer_users: grand.valid,
      opened_account_assets: round2(grand.assets), existing_customer_assets: round2(grand.existing_assets),
      lead_cost: grand.leads > 0 ? round2(grand.cost / grand.leads) : 0,
      account_cost: grand.opened > 0 ? round2(grand.cost / grand.opened) : 0,
    },
  };

  const final_summary = summary.concat(Object.values(plat_sub)).concat([grand_row]);

  // 2. trend（按 日期/平台/业务模式/厂商）
  const trendSql = `SELECT "日期", "平台", "业务模式", "厂商",
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开户人数"), 0) as opened,
    COALESCE(SUM("有效户人数"), 0) as valid
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "日期", "平台", "业务模式", "厂商" ORDER BY "日期"`;
  const trendRows = await querySql<Row>(trendSql, where.params);
  const series = trendRows.map(r => ({
    date: String(r['日期']),
    platform: r['平台'],
    business_model: r['业务模式'],
    agency: r['厂商'] || '',
    agency_short: r['厂商'] || '',
    metrics: {
      cost: round2(toFloat(r.cost)), impressions: toInt(r.impressions), clicks: toInt(r.clicks),
      lead_users: toInt(r.leads), opened_account_users: toInt(r.opened), valid_customer_users: toInt(r.valid),
    },
  }));
  const dates = [...new Set(series.map(s => s.date))].sort();

  const agency_count = new Set(sumRows.map(r => r['厂商']).filter(Boolean)).size;
  const platform_count = new Set(sumRows.map(r => r['平台']).filter(Boolean)).size;

  return { summary: final_summary, meta: { agency_count, platform_count }, trend: { dates, series } };
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
    case 'reports/app-market/summary':
      return handleAppMarketSummary(body);
    case 'reports/app-market/detail':
      return handleAppMarketDetail(body);
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

    // 代理商分析（GET 请求，参数在 URL query）
    case 'agency-analysis':
      return handleAgencyAnalysis(url, body);

    default:
      throw new Error(`Mobile API not implemented: ${path}`);
  }
}
