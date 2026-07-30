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

// v3.6.4：由 vite.config.ts define 注入的 version.json 内容（构建时确定）
// 移动端/PWA 端关于页的 version/local 端点直接返回此对象
declare const __APP_VERSION_INFO__: {
  version: string;
  release_date: string;
  changelog?: string[];
  [key: string]: unknown;
};
const APP_VERSION_INFO = __APP_VERSION_INFO__;

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
    // ASCII 字符（codePoint < 0x80）排在前，非 ASCII 排在后；用 codePointAt 替代 [\x00-\x7F] 正则避免 no-control-regex
    const ka = (a.codePointAt(0)! <= 0x7f ? 'a' : 'z') + a;
    const kb = (b.codePointAt(0)! <= 0x7f ? 'a' : 'z') + b;
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

  // wow_changes：计算前一周同口径指标的环比变化（对齐后端 dashboard.py:104-164）
  // 前端 Dashboard/index.tsx 用 wowChanges?.xxx 取每个 MetricCard 的环比箭头，
  // mobile 端此前直接返回 {} 导致所有环比箭头不显示
  let wow: Record<string, any> = {};
  try {
    if (filters.start_date && filters.end_date) {
      const sDt = new Date(filters.start_date + 'T00:00:00Z');
      const eDt = new Date(filters.end_date + 'T00:00:00Z');
      if (!isNaN(sDt.getTime()) && !isNaN(eDt.getTime())) {
        const days = Math.floor((eDt.getTime() - sDt.getTime()) / 86400000) + 1;
        const prevEDt = new Date(sDt.getTime() - 86400000);
        const prevSDt = new Date(prevEDt.getTime() - (days - 1) * 86400000);
        const prevSd = prevSDt.toISOString().slice(0, 10);
        const prevEd = prevEDt.toISOString().slice(0, 10);
        const prevWhere = dashboardWhere({ ...filters, start_date: prevSd, end_date: prevEd });
        const prevSql = `SELECT
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
        FROM agg_vendor_daily ${prevWhere.clause}`;
        const prevRows = await querySql<Row>(prevSql, prevWhere.params);
        const pr = prevRows[0] || {};
        const prev_cost = toFloat(pr.cost);
        const prev_impr = toInt(pr.impressions);
        const prev_leads_wechat = toInt(pr.leads_wechat);
        const prev_leads_app = toInt(pr.leads_app);
        const prev_cost_wechat_w = toFloat(pr.cost_wechat_w);
        const prev_cost_app_w = toFloat(pr.cost_app_w);
        const prev_opened = toInt(pr.opened);
        const prev_valid = toInt(pr.valid);
        const prev_assets = toFloat(pr.assets);
        const prev_contrib = toFloat(pr.contribution);
        const prev_exist_assets = toFloat(pr.existing_assets);

        const _pct = (a: number, b: number) => b > 0 ? round2((a - b) / b * 100) : 0;
        // 中国股市惯例：上升=红 / 下降=绿（与后端 _w 一致，不区分成本/业务量）
        const _w = (curr: number, prev: number) => {
          const is_up = curr > prev;
          return { value: _pct(curr, prev), trend: is_up ? 'up' : 'down', color: is_up ? 'red' : 'green' };
        };

        const curr_cpwl = leads_wechat > 0 ? round2(cost_wechat_w / leads_wechat) : 0;
        const curr_cpaa = leads_app > 0 ? round2(cost_app_w / leads_app) : 0;
        const curr_cpa = opened > 0 ? round2(cost / opened) : 0;
        const curr_cpva = valid > 0 ? round2(cost / valid) : 0;
        const prev_cpwl = prev_leads_wechat > 0 ? round2(prev_cost_wechat_w / prev_leads_wechat) : 0;
        const prev_cpaa = prev_leads_app > 0 ? round2(prev_cost_app_w / prev_leads_app) : 0;
        const prev_cpa = prev_opened > 0 ? round2(prev_cost / prev_opened) : 0;
        const prev_cpva = prev_valid > 0 ? round2(prev_cost / prev_valid) : 0;

        wow = {
          investment: _w(cost, prev_cost),
          total_impressions: _w(impr, prev_impr),
          leads_wechat: _w(leads_wechat, prev_leads_wechat),
          leads_app: _w(leads_app, prev_leads_app),
          new_customers: _w(opened, prev_opened),
          new_valid_accounts: _w(valid, prev_valid),
          customer_assets: _w(assets, prev_assets),
          customer_contribution: _w(contrib, prev_contrib),
          existing_customers_assets: _w(exist_assets, prev_exist_assets),
          cost_per_wechat_lead: _w(curr_cpwl, prev_cpwl),
          cost_per_app_activation: _w(curr_cpaa, prev_cpaa),
          cost_per_account: _w(curr_cpa, prev_cpa),
          cost_per_valid_account: _w(curr_cpva, prev_cpva),
        };
      }
    }
  } catch {
    // wow 计算失败时保持空对象，不影响主指标展示
  }

  return { core_metrics: core, wow_changes: wow };
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
// 应用市场消耗和成本 (app-market/cost-analysis)
// ============================================================================
const APP_MARKET_PLATFORMS = ['华为', '小米', '荣耀', 'oppo', 'vivo', '苹果'];

function _weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

async function handleAppMarketCostAnalysis(body: any): Promise<any> {
  const filters = body?.filters || {};
  const sd = filters.start_date || '2026-01-01';
  const ed = filters.end_date || '2026-12-31';

  // Part 1 & 2: 总体 + 分市场聚合
  const marketWhere = buildWhere([
    dateClause('日期', sd, ed),
    { sql: '"花费" > 0', params: [] },
    inClause('平台', APP_MARKET_PLATFORMS),
  ]);

  const marketSql = `SELECT "平台",
    COALESCE(SUM("花费"), 0) as total_spend,
    COALESCE(SUM("开户人数"), 0) as total_open
    FROM agg_vendor_daily ${marketWhere.clause}
    GROUP BY "平台" ORDER BY "平台"`;
  const marketRows = await querySql<Row>(marketSql, marketWhere.params);

  const by_market: any[] = [];
  let total_spend = 0;
  let total_open = 0;
  for (const r of marketRows) {
    const spend = round2(toFloat(r.total_spend));
    const openCnt = toInt(r.total_open);
    total_spend += spend;
    total_open += openCnt;
    by_market.push({
      platform: r['平台'],
      total_spend: spend,
      total_open: openCnt,
      cost_per_open: openCnt > 0 ? round2(spend / openCnt) : 0,
    });
  }

  const summary = {
    total_spend: round2(total_spend),
    total_open,
    cost_per_open: total_open > 0 ? round2(total_spend / total_open) : 0,
  };

  // Part 3: 月度消耗
  const monthSql = `SELECT substr("日期", 1, 7) as month, "平台",
    COALESCE(SUM("花费"), 0) as spend
    FROM agg_vendor_daily ${marketWhere.clause}
    GROUP BY month, "平台" ORDER BY month, "平台"`;
  const monthRows = await querySql<Row>(monthSql, marketWhere.params);
  const by_month = monthRows.map(r => ({
    month: r.month,
    platform: r['平台'],
    spend: round2(toFloat(r.spend)),
  }));

  // Part 4: 周度消耗（按 Python 侧周起始逻辑，查询日数据后按周聚合）
  const weekSql = `SELECT "日期", "平台",
    COALESCE(SUM("花费"), 0) as spend
    FROM agg_vendor_daily ${marketWhere.clause}
    GROUP BY "日期", "平台" ORDER BY "日期"`;
  const weekRows = await querySql<Row>(weekSql, marketWhere.params);

  const weekMap: Record<string, number> = {};
  const weekPlatforms: Record<string, string> = {};
  for (const r of weekRows) {
    const ws = _weekStart(r['日期']);
    const key = `${ws}|${r['平台']}`;
    weekMap[key] = (weekMap[key] || 0) + toFloat(r.spend);
    weekPlatforms[key] = r['平台'];
  }

  const by_week = Object.entries(weekMap).map(([key, spend]) => {
    const [ws] = key.split('|');
    return { week_start: ws, platform: weekPlatforms[key], spend: round2(spend) };
  }).sort((a, b) => a.week_start.localeCompare(b.week_start));

  return {
    summary,
    by_market,
    by_month,
    by_week,
    platforms: APP_MARKET_PLATFORMS,
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

  // 1. 总计 + 资产（核心数据：漏斗图依赖此结果，必须成功）
  const totalSql = `SELECT ${FUNNEL_SUMS} FROM fact_conv_appmarket ${where.clause}`;
  const totalRows = await querySql<Row>(totalSql, where.params);
  const total_counts = funnelCountsFromRow(totalRows[0] || {});

  // 新开户资产（仅 是否新开户=1 的行累加 总资产）
  const assetSql = `SELECT COALESCE(SUM(CASE WHEN "是否新开户" = 1 THEN "总资产" ELSE 0 END), 0) as v
    FROM fact_conv_appmarket ${where.clause}`;
  const assetRows = await querySql<Row>(assetSql, where.params);
  total_counts['新开户资产'] = round2(toFloat(assetRows[0]?.v));

  // 2~4. 辅助查询（非核心：失败不影响 total_funnel 渲染，仅降级辅助图表）
  //   根因排查：移动端 SQLite 表结构与 PG 略有差异时，辅助查询可能抛异常，
  //   若不隔离会整体返回 success:false，导致 9 阶段漏斗空白。
  let by_month_market: any[] = [];
  let by_market: any[] = [];
  let by_channel_type: any[] = [];

  try {
    const monthSql = `SELECT substr("下载日期", 1, 7) as month, "应用市场" as app_market, ${FUNNEL_SUMS}
      FROM fact_conv_appmarket ${where.clause}
      GROUP BY month, "应用市场" ORDER BY month`;
    const monthRows = await querySql<Row>(monthSql, where.params);
    by_month_market = monthRows.map(r => {
      const cnt = funnelCountsFromRow(r);
      return {
        month: r.month,
        app_market: r.app_market || '未归因',
        counts: cnt,
        final_open_rate: cnt['激活APP'] > 0 ? round4(cnt['开户成功'] / cnt['激活APP'] * 100) : 0,
        final_valid_rate: cnt['激活APP'] > 0 ? round4(cnt['有效户'] / cnt['激活APP'] * 100) : 0,
      };
    });
  } catch (e) {
    console.warn('[mobileRouteHandler] by_month_market query failed:', e);
  }

  try {
    const marketSql = `SELECT "应用市场" as app_market, ${FUNNEL_SUMS}
      FROM fact_conv_appmarket ${where.clause}
      GROUP BY "应用市场"`;
    const marketRows = await querySql<Row>(marketSql, where.params);
    by_market = marketRows.map(r => {
      const cnt = funnelCountsFromRow(r);
      return { app_market: r.app_market || '未归因', counts: cnt, funnel: funnelWithRates(cnt) };
    });
  } catch (e) {
    console.warn('[mobileRouteHandler] by_market query failed:', e);
  }

  try {
    const typeWhere = appMarketWhere(filters, false);
    const typeSql = `SELECT "渠道类型" as channel_type, "应用市场" as app_market, ${FUNNEL_SUMS}
      FROM fact_conv_appmarket ${typeWhere.clause}
      GROUP BY "渠道类型", "应用市场"`;
    const typeRows = await querySql<Row>(typeSql, typeWhere.params);
    by_channel_type = typeRows.map(r => {
      const cnt = funnelCountsFromRow(r);
      return { channel_type: r.channel_type || '未归因', app_market: r.app_market || '未归因', counts: cnt };
    });
  } catch (e) {
    console.warn('[mobileRouteHandler] by_channel_type query failed:', e);
  }

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
// 转化漏斗 (conversion-funnel/split)
// ============================================================================

/**
 * 转化漏斗 split：内容平台 + 应用市场 双漏斗
 *
 * 内容平台 8 阶段：
 *   广告曝光(agg_vendor_daily.展示量) → 客户点击(agg_vendor_daily.点击量)
 *   → 客户线索 → 客户开口 → 有效线索 → 有效线索(剔除存量) → 成功开户 → 有效户
 *   （后 6 阶段从 fact_conv_content 取）
 *
 * 应用市场 9 阶段（强制 渠道类型='互联网引流'）：
 *   激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功
 *   → 新开户 → 入金 → 有效户
 *   （新开户作为漏斗阶段呈现存量剔除，不做 WHERE 过滤，避免漏斗变平）
 *
 * 存量剔除口径（内容平台）：是否为存量客户 = 0 OR IS NULL（在有效线索之后剔除）
 */
async function handleConversionFunnelSplit(url: string, body: any): Promise<any> {
  // POST 请求 filters 在 body；GET 请求参数在 URL query
  let sd: string | undefined, ed: string | undefined;
  let platforms: string[] = [];
  let is_employee_mode = false;

  if (body?.filters) {
    const f = body.filters;
    sd = f.start_date; ed = f.end_date;
    platforms = f.platforms || [];
    is_employee_mode = !!body.is_employee_mode;
  } else {
    const q = parseQueryParams(url);
    sd = q.start_date; ed = q.end_date;
    platforms = q.platforms ? q.platforms.split(',').filter(Boolean) : [];
    is_employee_mode = (q.is_employee_mode || 'false').toLowerCase() === 'true';
  }

  // ---- 内容平台漏斗 ----
  // 1) 全量统计：客户线索/客户开口/有效线索（含存量）
  const cAllWhere = buildWhere([
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
  ]);
  const cAllSql = `SELECT
    COUNT(*) as leads,
    COALESCE(SUM("是否客户开口"), 0) as mouth,
    COALESCE(SUM("是否有效线索"), 0) as valid_lead
  FROM fact_conv_content ${cAllWhere.clause}`;
  const cAllRows = await querySql<Row>(cAllSql, cAllWhere.params);
  const cAll = cAllRows[0] || {};
  const leads = toInt(cAll.leads);
  const mouth = toInt(cAll.mouth);
  const valid_lead = toInt(cAll.valid_lead);

  // 2) 非存量：有效线索(剔除存量)/成功开户/有效户
  const cNewWhere = buildWhere([
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    { sql: '("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)', params: [] as unknown[] },
  ]);
  const cNewSql = `SELECT
    COALESCE(SUM("是否有效线索"), 0) as new_valid_lead,
    COALESCE(SUM("是否开户"), 0) as opened,
    COALESCE(SUM("是否为有效户"), 0) as valid
  FROM fact_conv_content ${cNewWhere.clause}`;
  const cNewRows = await querySql<Row>(cNewSql, cNewWhere.params);
  const cNew = cNewRows[0] || {};
  const new_valid_lead = toInt(cNew.new_valid_lead);
  const opened = toInt(cNew.opened);
  const valid = toInt(cNew.valid);

  // 3) extra_new_opened：非有效线索但新开户
  const cExtraWhere = buildWhere([
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    { sql: '("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)', params: [] as unknown[] },
    { sql: '"是否有效线索" != 1', params: [] as unknown[] },
  ]);
  const cExtraSql = `SELECT COALESCE(SUM("是否开户"), 0) as extra_opened
  FROM fact_conv_content ${cExtraWhere.clause}`;
  const cExtraRows = await querySql<Row>(cExtraSql, cExtraWhere.params);
  const extra_new_opened = toInt(cExtraRows[0]?.extra_opened);

  // 4) 内容平台新开户引进资产 = 非存量且开户成功的客户资产 SUM
  const cAssetWhere = buildWhere([
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    { sql: '("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)', params: [] as unknown[] },
    { sql: '"是否开户" = 1', params: [] as unknown[] },
  ]);
  const cAssetSql = `SELECT COALESCE(SUM("资产"), 0) as new_open_assets
  FROM fact_conv_content ${cAssetWhere.clause}`;
  const cAssetRows = await querySql<Row>(cAssetSql, cAssetWhere.params);
  const content_new_open_assets = round2(toFloat(cAssetRows[0]?.new_open_assets));

  // 5) 前 2 阶段（广告曝光/客户点击）从 agg_vendor_daily 取
  const vWhere = buildWhere([
    dateClause('日期', sd, ed),
    inClause('平台', platforms),
  ]);
  const vSql = `SELECT
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("花费"), 0) as cost
  FROM agg_vendor_daily ${vWhere.clause}`;
  const vRows = await querySql<Row>(vSql, vWhere.params);
  const v = vRows[0] || {};
  const impressions = toInt(v.impressions);
  const clicks = toInt(v.clicks);
  const cost_total = toFloat(v.cost);

  // 内容平台 8 阶段
  const content_top = impressions > 0 ? impressions : 1;
  const content_stages = [
    { step: '广告曝光', value: impressions, rate: 100.0, step_rate: 100.0 },
    { step: '客户点击', value: clicks,
      rate: impressions > 0 ? round2(clicks / impressions * 100) : 0,
      step_rate: round2(clicks / content_top * 100) },
    { step: '客户线索', value: leads,
      rate: clicks > 0 ? round2(leads / clicks * 100) : 0,
      step_rate: round2(leads / content_top * 100) },
    { step: '客户开口', value: mouth,
      rate: leads > 0 ? round2(mouth / leads * 100) : 0,
      step_rate: round2(mouth / content_top * 100) },
    { step: '有效线索', value: valid_lead,
      rate: mouth > 0 ? round2(valid_lead / mouth * 100) : 0,
      step_rate: round2(valid_lead / content_top * 100) },
    { step: '有效线索(剔除存量)', value: new_valid_lead,
      rate: valid_lead > 0 ? round2(new_valid_lead / valid_lead * 100) : 0,
      step_rate: round2(new_valid_lead / content_top * 100) },
    { step: '成功开户', value: opened,
      rate: new_valid_lead > 0 ? round2(opened / new_valid_lead * 100) : 0,
      step_rate: round2(opened / content_top * 100) },
    { step: '有效户', value: valid,
      rate: opened > 0 ? round2(valid / opened * 100) : 0,
      step_rate: round2(valid / content_top * 100) },
  ];

  // ---- 应用市场漏斗 ----
  // 强制 渠道类型='互联网引流'；新开户作为阶段呈现，不做 WHERE 过滤
  const aWhere = buildWhere([
    dateClause('下载日期', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
  ]);
  const aFunnelCols = [
    ['是否激活APP', '激活APP'],
    ['是否开户注册', '开户注册'],
    ['是否注册身份证', '注册身份证'],
    ['是否注册银行卡', '注册银行卡'],
    ['是否提交开户', '提交开户'],
    ['是否开户成功', '开户成功'],
    ['是否新开户', '新开户'],
    ['是否入金', '入金'],
    ['是否有效户', '有效户'],
  ] as [string, string][];
  const aSelectCols = aFunnelCols.map(
    ([col, alias]) => `COALESCE(SUM("${col}"), 0) as "${alias}"`
  ).join(', ');
  const aSql = `SELECT ${aSelectCols} FROM fact_conv_appmarket ${aWhere.clause}`;
  const aRows = await querySql<Row>(aSql, aWhere.params);
  const ar = aRows[0] || {};
  const a_counts: Record<string, number> = {};
  for (const [, alias] of aFunnelCols) {
    a_counts[alias] = toInt(ar[alias]);
  }
  const a_base = a_counts['激活APP'];
  const appmarket_stages: any[] = [];
  let a_prev = a_base;
  for (const [, alias] of aFunnelCols) {
    const v = a_counts[alias];
    const rate = a_prev > 0 ? round2(v / a_prev * 100) : 0;
    const step_rate = round2(v / (a_base || 1) * 100);
    appmarket_stages.push({ step: alias, value: v, rate, step_rate });
    a_prev = v;
  }

  // 应用市场新开户引进资产 = 是否新开户==1 的行总资产 SUM
  const aAssetWhere = buildWhere([
    dateClause('下载日期', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
    { sql: '"是否新开户" = 1', params: [] as unknown[] },
  ]);
  const aAssetSql = `SELECT COALESCE(SUM("总资产"), 0) as new_open_assets
  FROM fact_conv_appmarket ${aAssetWhere.clause}`;
  const aAssetRows = await querySql<Row>(aAssetSql, aAssetWhere.params);
  const appmarket_new_open_assets = round2(toFloat(aAssetRows[0]?.new_open_assets));

  return {
    funnels: {
      content: {
        stages: content_stages,
        data_source: 'fact_conv_content + agg_vendor_daily(前 2 段)',
        channel_category: 'content',
        extra_new_opened,
        new_open_assets: content_new_open_assets,
      },
      appmarket: {
        stages: appmarket_stages,
        data_source: 'fact_conv_appmarket',
        channel_category: 'appmarket',
        new_open_assets: appmarket_new_open_assets,
      },
    },
    core_metrics: {
      cost: round2(cost_total),
      lead_users: leads + a_counts['激活APP'],
      opened_account_users: opened + a_counts['开户成功'],
      valid_customer_users: valid + a_counts['有效户'],
    },
    is_employee_mode,
  };
}

// ============================================================================
// 线索明细 (leads-detail)
// ============================================================================

/** 线索明细分页查询（GET 请求，参数在 URL query） */
async function handleLeadsDetail(url: string): Promise<any> {
  const q = parseQueryParams(url);
  const page = Math.max(1, toInt(q.page) || 1);
  const page_size = Math.max(1, Math.min(200, toInt(q.page_size) || 50));
  const offset = (page - 1) * page_size;
  const sd = q.start_date || undefined;
  const ed = q.end_date || undefined;
  const platforms = q.platforms ? q.platforms.split(',').filter(Boolean) : [];
  const agencies = q.agencies ? q.agencies.split(',').filter(Boolean) : [];
  const employee_name = q.employee_name || '';
  const is_opened_account = q.is_opened_account;

  const conditions: ({ sql: string; params: unknown[] } | null)[] = [
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    inClause('广告代理商', agencies),
  ];
  if (employee_name) {
    conditions.push({ sql: '"添加员工姓名" = ?', params: [employee_name] });
  }
  if (is_opened_account === 'true') {
    conditions.push({ sql: '"是否开户" = 1', params: [] as unknown[] });
  } else if (is_opened_account === 'false') {
    conditions.push({ sql: '("是否开户" = 0 OR "是否开户" IS NULL)', params: [] as unknown[] });
  }
  const where = buildWhere(conditions);

  // 总数
  const totalSql = `SELECT COUNT(*) as c FROM fact_conv_content ${where.clause}`;
  const totalRows = await querySql<Row>(totalSql, where.params);
  const total = toInt(totalRows[0]?.c);

  // 分页查询（ORDER BY 线索日期 DESC）
  // LIMIT/OFFSET 用字符串拼接（page/page_size 已被 Math.min/Math.max 夹紧到安全范围）
  const sql = `SELECT * FROM fact_conv_content ${where.clause}
    ORDER BY "线索日期" DESC LIMIT ${page_size} OFFSET ${offset}`;
  const rows = await querySql<Row>(sql, where.params);

  const items = rows.map(r => ({
    wechat_nickname: r['微信昵称'],
    capital_account: r['资金账号'],
    opening_branch: r['开户营业部'],
    customer_gender: r['客户性别'],
    platform_source: r['平台来源'],
    traffic_type: r['流量类型'],
    customer_source: r['客户来源'],
    is_customer_mouth: !!toInt(r['是否客户开口']),
    is_valid_lead: !!toInt(r['是否有效线索']),
    is_open_account_interrupted: !!toInt(r['是否开户中断']),
    open_account_interrupted_date: r['开户中断日期'],
    is_opened_account: !!toInt(r['是否开户']),
    is_valid_customer: !!toInt(r['是否为有效户']),
    is_existing_customer: !!toInt(r['是否为存量客户']),
    is_existing_valid_customer: !!toInt(r['是否为存量有效户']),
    is_delete_enterprise_wechat: !!toInt(r['是否删除企微']),
    lead_date: r['线索日期'],
    first_contact_time: r['首次触达时间'],
    last_contact_time: r['最近互动时间'],
    account_opening_time: r['开户时间'],
    wechat_verify_status: r['微信认证状态'] != null ? String(r['微信认证状态']) : null,
    wechat_verify_time: r['微信认证时间'],
    valid_customer_time: r['有效户时间'],
    ad_click_date: r['广告点击日期'],
    interaction_count: toInt(r['互动次数']),
    sales_interaction_count: toFloat(r['营销人员互动次数']),
    assets: toFloat(r['资产']),
    customer_contribution: toFloat(r['客户贡献']),
    add_employee_no: r['添加员工号'] != null ? String(r['添加员工号']) : null,
    add_employee_name: r['添加员工姓名'],
    ad_account: r['广告账号'],
    agency: r['广告代理商'],
    ad_id: r['广告ID'],
    creative_id: r['创意ID'],
    note_id: r['笔记ID'],
    note_title: r['笔记名称'],
    platform_user_id: r['平台用户ID'],
    platform_user_nickname: r['平台用户昵称'],
    producer: r['生产者'],
    enterprise_wechat_tags: r['企微标签'],
  }));

  return {
    items,
    total,
    page,
    page_size,
    total_pages: Math.ceil(total / page_size),
  };
}

/** 线索明细筛选选项（平台 / 代理商 / 员工） */
async function handleLeadsDetailFilterOptions(): Promise<any> {
  const platforms = await querySql<Row>(
    `SELECT DISTINCT "平台来源" as v FROM fact_conv_content
     WHERE "平台来源" IS NOT NULL AND "平台来源" != ''
     ORDER BY "平台来源"`
  );
  const agencies = await querySql<Row>(
    `SELECT DISTINCT "广告代理商" as v FROM fact_conv_content
     WHERE "广告代理商" IS NOT NULL AND "广告代理商" != ''
     ORDER BY "广告代理商"`
  );
  const employees = await querySql<Row>(
    `SELECT DISTINCT "添加员工姓名" as v FROM fact_conv_content
     WHERE "添加员工姓名" IS NOT NULL AND "添加员工姓名" != ''
     ORDER BY "添加员工姓名"`
  );
  // 注：移动端不做 full_to_short 简称归一化（无 dim_account 表），直接返回全称
  return {
    platforms: platforms.map(r => ({ value: r.v, label: r.v })),
    agencies: agencies.map(r => ({ value: r.v, label: r.v })),
    employees: employees.map(r => ({ value: r.v, label: r.v })),
  };
}

// ============================================================================
// 主播聚类 (anchor-clusters) — 直播获客 5 个页面共用
// ============================================================================
// 数据源：fact_conv_content.客户来源 + dim_anchor_live_type
// 业务规则：
//   - 存量剔除口径：是否为存量客户 = 0 OR IS NULL
//   - token 解析：客户来源 按 [,，;；、] 拆分，匹配 ^(平台)引流-(主播)$
//   - 平台归一化：视频号/视频号直播/微信 → 腾讯
//   - live_types 筛选：3 个 endpoint 拦截时机不同（见各 handler）

const ANCHOR_PATTERN = /^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$/;
const ANCHOR_SPLIT = /[,，;；、]+/;
const ANCHOR_PLATFORM_NORMALIZE: Record<string, string> = {
  '视频号': '腾讯',
  '视频号直播': '腾讯',
  '微信': '腾讯',
};

interface AnchorLiveTypeMap {
  token_to_anchor: Record<string, string>;
  token_to_live_type: Record<string, string>;
  anchor_to_live_types: Record<string, Set<string>>;
  plain_name_tokens: Set<string>;
}

/** 加载 dim_anchor_live_type 表，构建 token → anchor_name / live_type 映射 */
async function loadAnchorLiveTypeMap(): Promise<AnchorLiveTypeMap> {
  const m: AnchorLiveTypeMap = {
    token_to_anchor: {},
    token_to_live_type: {},
    anchor_to_live_types: {},
    plain_name_tokens: new Set(),
  };
  try {
    const rows = await querySql<Row>(
      `SELECT source_token, anchor_name, live_type, is_active FROM dim_anchor_live_type`
    );
    for (const r of rows) {
      if (!r.is_active) continue;
      const tok = String(r.source_token || '');
      const name = String(r.anchor_name || '');
      const lt = String(r.live_type || '');
      if (!tok || !name || !lt) continue;
      m.token_to_anchor[tok] = name;
      m.token_to_live_type[tok] = lt;
      if (!m.anchor_to_live_types[name]) m.anchor_to_live_types[name] = new Set();
      m.anchor_to_live_types[name].add(lt);
      if (!tok.includes('引流-') && !tok.includes('直播带货-')) {
        m.plain_name_tokens.add(tok);
      }
    }
  } catch {
    // dim_anchor_live_type 表缺失或为空，退化为无映射模式
  }
  return m;
}

/** 解析客户来源字段，返回 [{platform, anchor, segment}] */
function parseAnchorTokens(
  src: string,
  rowPlatform: string,
  ltMap: AnchorLiveTypeMap
): Array<{ platform: string; anchor: string; segment: string }> {
  const out: Array<{ platform: string; anchor: string; segment: string }> = [];
  for (const part of src.split(ANCHOR_SPLIT)) {
    const segment = part.trim();
    if (!segment) continue;
    const m = ANCHOR_PATTERN.exec(segment);
    if (m) {
      const anchorPlatform = ANCHOR_PLATFORM_NORMALIZE[m[1]] || m[1];
      const rawAnchorName = m[2].trim();
      if (!rawAnchorName) continue;
      const normalizedAnchor = ltMap.token_to_anchor[segment] || rawAnchorName;
      out.push({ platform: anchorPlatform, anchor: normalizedAnchor, segment });
    } else if (ltMap.plain_name_tokens.has(segment)) {
      const anchorPlatform = (rowPlatform || '').trim();
      const normalizedAnchor = ltMap.token_to_anchor[segment] || segment;
      out.push({ platform: anchorPlatform, anchor: normalizedAnchor, segment });
    }
  }
  return out;
}

/** 主播聚类：按 (平台, 主播) 聚合线索/开口/开户/有效户/资产 */
async function handleAnchorClusters(body: any): Promise<any> {
  const filters = body?.filters || {};
  const top_n = toInt(body?.top_n ?? 50);
  const sd = filters.start_date;
  const ed = filters.end_date;
  const platforms_filter = filters.platforms || [];
  const agencies_filter = filters.agencies || [];
  const live_types_filter: string[] = filters.live_types || [];

  const where = buildWhere([
    { sql: '"客户来源" IS NOT NULL AND "客户来源" != \'\'', params: [] as unknown[] },
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms_filter),
    inClause('广告代理商', agencies_filter),
  ]);

  const sql = `SELECT
    "客户来源" as customer_source,
    "平台来源" as platform,
    COUNT(id) as leads,
    COALESCE(SUM(CASE WHEN "是否为存量客户" = 1 THEN 1 ELSE 0 END), 0) as existing_leads,
    COALESCE(SUM(CASE WHEN ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL) THEN 1 ELSE 0 END), 0) as new_leads,
    COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
    COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
    COALESCE(SUM(CASE WHEN ("是否有效线索" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_valid_lead,
    COALESCE(SUM(CASE WHEN "是否开户" = 1 THEN 1 ELSE 0 END), 0) as opened,
    COALESCE(SUM(CASE WHEN ("是否开户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_opened,
    COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid,
    COALESCE(SUM(CASE WHEN ("是否为有效户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_valid,
    COALESCE(SUM(CASE WHEN ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL) THEN "资产" ELSE 0 END), 0) as new_assets,
    COALESCE(SUM(CASE WHEN "是否为存量客户" = 1 THEN "资产" ELSE 0 END), 0) as existing_assets,
    COALESCE(SUM("资产"), 0) as assets
  FROM fact_conv_content ${where.clause}
  GROUP BY "客户来源", "平台来源"`;
  const rows = await querySql<Row>(sql, where.params);

  const ltMap = await loadAnchorLiveTypeMap();

  interface AggItem {
    platform: string; anchor: string;
    leads: number; existing_leads: number; new_leads: number;
    mouth: number; valid_lead: number; new_valid_lead: number;
    opened: number; new_opened: number;
    valid: number; new_valid: number;
    new_assets: number; existing_assets: number; assets: number;
    raw_sources: Set<string>; live_types: Set<string>;
  }
  const aggMap: Record<string, AggItem> = {};

  for (const r of rows) {
    const src = String(r.customer_source || '').trim();
    const rowPlatform = String(r.platform || '').trim();
    const matches = parseAnchorTokens(src, rowPlatform, ltMap);
    // 同一原始来源里若重复出现同一主播，只归因一次
    const seen = new Set<string>();
    const sortedMatches = matches.slice().sort((a, b) =>
      `${a.platform}|||${a.anchor}`.localeCompare(`${b.platform}|||${b.anchor}`)
    );
    for (const match of sortedMatches) {
      const key = `${match.platform}|||${match.anchor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!aggMap[key]) {
        aggMap[key] = {
          platform: match.platform, anchor: match.anchor,
          leads: 0, existing_leads: 0, new_leads: 0,
          mouth: 0, valid_lead: 0, new_valid_lead: 0,
          opened: 0, new_opened: 0, valid: 0, new_valid: 0,
          new_assets: 0, existing_assets: 0, assets: 0,
          raw_sources: new Set(), live_types: new Set(),
        };
      }
      const a = aggMap[key];
      a.leads += toInt(r.leads);
      a.existing_leads += toInt(r.existing_leads);
      a.new_leads += toInt(r.new_leads);
      a.mouth += toInt(r.mouth);
      a.valid_lead += toInt(r.valid_lead);
      a.new_valid_lead += toInt(r.new_valid_lead);
      a.opened += toInt(r.opened);
      a.new_opened += toInt(r.new_opened);
      a.valid += toInt(r.valid);
      a.new_valid += toInt(r.new_valid);
      a.new_assets += toFloat(r.new_assets);
      a.existing_assets += toFloat(r.existing_assets);
      a.assets += toFloat(r.assets);
      a.raw_sources.add(match.segment);
      // 累加该 anchor 的直播类型（先查 token 精确匹配，回退到该主播所有 live_type）
      const segLt = ltMap.token_to_live_type[match.segment];
      if (segLt) {
        a.live_types.add(segLt);
      } else if (ltMap.anchor_to_live_types[match.anchor]) {
        for (const t of ltMap.anchor_to_live_types[match.anchor]) {
          a.live_types.add(t);
        }
      }
    }
  }

  // 组装 items
  const items: any[] = [];
  for (const a of Object.values(aggMap)) {
    const anchorLiveTypes = Array.from(a.live_types).sort();
    const primaryLiveType = anchorLiveTypes.length > 0 ? anchorLiveTypes[0] : null;
    const secondaryLiveTypes = anchorLiveTypes.length > 1 ? anchorLiveTypes.slice(1) : [];
    items.push({
      platform: a.platform,
      anchor: a.anchor,
      live_type: primaryLiveType,
      live_types: anchorLiveTypes,
      secondary_live_types: secondaryLiveTypes,
      leads: a.leads,
      existing_leads: a.existing_leads,
      new_leads: a.new_leads,
      mouth: a.mouth,
      valid_lead: a.valid_lead,
      new_valid_lead: a.new_valid_lead,
      opened: a.opened,
      new_opened: a.new_opened,
      existing_opened: a.opened - a.new_opened,
      valid: a.valid,
      new_valid: a.new_valid,
      existing_valid: a.valid - a.new_valid,
      new_assets: round2(a.new_assets),
      existing_assets: round2(a.existing_assets),
      assets: round2(a.assets),
      opening_rate: a.leads > 0 ? round2(a.new_opened / a.leads * 100) : 0,
      valid_rate: a.leads > 0 ? round2(a.new_valid / a.leads * 100) : 0,
      sources: Array.from(a.raw_sources).sort(),
    });
  }

  // live_types 筛选（保留 items 中 live_types 与筛选有交集的项）
  let filteredItems = items;
  if (live_types_filter.length > 0) {
    const wanted = new Set(live_types_filter);
    filteredItems = items.filter(i => i.live_types.some((lt: string) => wanted.has(lt)));
  }

  filteredItems.sort((a, b) => (b.leads - a.leads) || (b.new_opened - a.new_opened));

  const totals = {
    total_anchors: filteredItems.length,
    total_leads: filteredItems.reduce((s, i) => s + i.leads, 0),
    total_existing_leads: filteredItems.reduce((s, i) => s + i.existing_leads, 0),
    total_new_leads: filteredItems.reduce((s, i) => s + i.new_leads, 0),
    total_valid_lead: filteredItems.reduce((s, i) => s + i.valid_lead, 0),
    total_new_valid_lead: filteredItems.reduce((s, i) => s + i.new_valid_lead, 0),
    total_opened: filteredItems.reduce((s, i) => s + i.opened, 0),
    total_new_opened: filteredItems.reduce((s, i) => s + i.new_opened, 0),
    total_existing_opened: filteredItems.reduce((s, i) => s + i.existing_opened, 0),
    total_valid: filteredItems.reduce((s, i) => s + i.valid, 0),
    total_new_valid: filteredItems.reduce((s, i) => s + i.new_valid, 0),
    total_existing_valid: filteredItems.reduce((s, i) => s + i.existing_valid, 0),
    total_new_assets: round2(filteredItems.reduce((s, i) => s + i.new_assets, 0)),
    total_existing_assets: round2(filteredItems.reduce((s, i) => s + i.existing_assets, 0)),
    total_assets: round2(filteredItems.reduce((s, i) => s + i.assets, 0)),
  };

  // 按 live_type 拆分的汇总
  const liveTypeBreakdownMap: Record<string, any> = {};
  for (const i of filteredItems) {
    const lt = i.live_type || '未映射';
    if (!liveTypeBreakdownMap[lt]) {
      liveTypeBreakdownMap[lt] = {
        live_type: lt, anchors: 0, leads: 0, new_leads: 0,
        new_opened: 0, new_valid: 0, new_assets: 0,
      };
    }
    const b = liveTypeBreakdownMap[lt];
    b.anchors += 1;
    b.leads += i.leads;
    b.new_leads += i.new_leads;
    b.new_opened += i.new_opened;
    b.new_valid += i.new_valid;
    b.new_assets += i.new_assets;
  }
  const live_type_breakdown = Object.values(liveTypeBreakdownMap).map((b: any) => ({
    ...b,
    new_assets: round2(b.new_assets),
    opening_rate: b.leads > 0 ? round2(b.new_opened / b.leads * 100) : 0,
    valid_rate: b.leads > 0 ? round2(b.new_valid / b.leads * 100) : 0,
  }));

  return {
    items: filteredItems.slice(0, top_n),
    totals,
    live_type_breakdown,
    top_n,
    all_count: filteredItems.length,
    platforms: Array.from(new Set(filteredItems.map(i => i.platform))).sort(),
    live_types: Array.from(new Set(filteredItems.flatMap(i => i.live_types))).sort(),
  };
}

/** 主播引流走势：按粒度（日/周/月）聚合 period × 平台 */
async function handleAnchorClustersTrend(body: any): Promise<any> {
  const filters = body?.filters || {};
  const granularity = body?.granularity || 'daily';
  const sd = filters.start_date;
  const ed = filters.end_date;
  const platforms_filter = filters.platforms || [];
  const agencies_filter = filters.agencies || [];
  const live_types_filter: string[] = filters.live_types || [];

  const ltMap = await loadAnchorLiveTypeMap();

  // 周期表达式（SQLite）
  let periodExpr: string;
  if (granularity === 'weekly') {
    periodExpr = `strftime('%Y-%W', "线索日期")`;
  } else if (granularity === 'monthly') {
    periodExpr = `substr("线索日期", 1, 7)`;
  } else {
    periodExpr = `substr("线索日期", 1, 10)`;
  }

  // source 过滤：like('%引流-%') OR in plain_name_tokens
  const sourceConds: { sql: string; params: unknown[] }[] = [
    { sql: '"客户来源" IS NOT NULL AND "客户来源" != \'\'', params: [] as unknown[] },
  ];
  if (ltMap.plain_name_tokens.size > 0) {
    const tokensArr = Array.from(ltMap.plain_name_tokens);
    const placeholders = tokensArr.map(() => '?').join(', ');
    sourceConds.push({
      sql: `("客户来源" LIKE '%引流-%' OR "客户来源" IN (${placeholders}))`,
      params: tokensArr,
    });
  } else {
    sourceConds.push({ sql: `"客户来源" LIKE '%引流-%'`, params: [] as unknown[] });
  }

  const where = buildWhere([
    ...sourceConds,
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms_filter),
    inClause('广告代理商', agencies_filter),
  ]);

  const sql = `SELECT
    ${periodExpr} as period,
    "平台来源" as platform,
    "客户来源" as customer_source,
    COUNT(id) as leads,
    COALESCE(SUM(CASE WHEN ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL) THEN 1 ELSE 0 END), 0) as new_leads,
    COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
    COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
    COALESCE(SUM(CASE WHEN ("是否开户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_opened,
    COALESCE(SUM(CASE WHEN ("是否为有效户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_valid,
    COALESCE(SUM(CASE WHEN ("是否开户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN "资产" ELSE 0 END), 0) as new_assets
  FROM fact_conv_content ${where.clause}
  GROUP BY period, "平台来源", "客户来源"
  ORDER BY period, "平台来源"`;
  const rows = await querySql<Row>(sql, where.params);

  // wanted_tokens（用于 live_types 筛选：聚合前用）
  let wantedTokens: Set<string> | null = null;
  if (live_types_filter.length > 0) {
    const wanted = new Set(live_types_filter);
    wantedTokens = new Set();
    for (const [tok, lt] of Object.entries(ltMap.token_to_live_type)) {
      if (wanted.has(lt)) wantedTokens.add(tok);
    }
  }

  const periodTotals: Record<string, any> = {};
  const byPlatform: Record<string, Record<string, any>> = {};
  const allPlatforms = new Set<string>();

  for (const r of rows) {
    // live_types 筛选 — 拆 客户来源 token，看是否命中 wanted_tokens
    if (wantedTokens) {
      const src = String(r.customer_source || '').trim();
      const tokens = src.split(ANCHOR_SPLIT).map(t => t.trim()).filter(Boolean);
      if (!tokens.some(t => wantedTokens.has(t))) continue;
    }
    const period = String(r.period ?? '');
    const platform = String(r.platform || '未知');
    allPlatforms.add(platform);

    if (!periodTotals[period]) {
      periodTotals[period] = { leads: 0, new_leads: 0, mouth: 0, valid_lead: 0, new_opened: 0, new_valid: 0, new_assets: 0 };
    }
    const b = periodTotals[period];
    b.leads += toInt(r.leads);
    b.new_leads += toInt(r.new_leads);
    b.mouth += toInt(r.mouth);
    b.valid_lead += toInt(r.valid_lead);
    b.new_opened += toInt(r.new_opened);
    b.new_valid += toInt(r.new_valid);
    b.new_assets += toFloat(r.new_assets);

    if (!byPlatform[period]) byPlatform[period] = {};
    if (!byPlatform[period][platform]) {
      byPlatform[period][platform] = { leads: 0, new_leads: 0, mouth: 0, valid_lead: 0, new_opened: 0, new_valid: 0, new_assets: 0 };
    }
    const bx = byPlatform[period][platform];
    bx.leads += toInt(r.leads);
    bx.new_leads += toInt(r.new_leads);
    bx.mouth += toInt(r.mouth);
    bx.valid_lead += toInt(r.valid_lead);
    bx.new_opened += toInt(r.new_opened);
    bx.new_valid += toInt(r.new_valid);
    bx.new_assets += toFloat(r.new_assets);
  }

  const periods = Object.keys(periodTotals).sort();

  return {
    granularity,
    periods,
    totals: periodTotals,
    by_platform: byPlatform,
    platforms: Array.from(allPlatforms).sort(),
  };
}

/** 主播周度拿量 + 各环节转化率分析（主播 × 周交叉表） */
function anchorCalcRates(leads: number, mouth: number, valid_lead: number, new_valid_lead: number, new_opened: number, new_valid: number) {
  return {
    '线索_开口率': leads > 0 ? round2(mouth / leads * 100) : 0,
    '开口_有效率': mouth > 0 ? round2(valid_lead / mouth * 100) : 0,
    '有效_非存量率': valid_lead > 0 ? round2(new_valid_lead / valid_lead * 100) : 0,
    '非存量_新开户率': new_valid_lead > 0 ? round2(new_opened / new_valid_lead * 100) : 0,
    '新开户_新有效率': new_opened > 0 ? round2(new_valid / new_opened * 100) : 0,
  };
}

async function handleAnchorWeeklyAnalysis(body: any): Promise<any> {
  const filters = body?.filters || {};
  const top_n = toInt(body?.top_n ?? 30);
  const sd = filters.start_date;
  const ed = filters.end_date;
  const platforms_filter = filters.platforms || [];
  const live_types_filter: string[] = filters.live_types || [];

  const ltMap = await loadAnchorLiveTypeMap();
  const wantedLiveTypes = new Set(live_types_filter);

  // source 过滤
  const sourceConds: { sql: string; params: unknown[] }[] = [
    { sql: '"客户来源" IS NOT NULL AND "客户来源" != \'\'', params: [] as unknown[] },
  ];
  if (ltMap.plain_name_tokens.size > 0) {
    const tokensArr = Array.from(ltMap.plain_name_tokens);
    const placeholders = tokensArr.map(() => '?').join(', ');
    sourceConds.push({
      sql: `("客户来源" LIKE '%引流-%' OR "客户来源" IN (${placeholders}))`,
      params: tokensArr,
    });
  } else {
    sourceConds.push({ sql: `"客户来源" LIKE '%引流-%'`, params: [] as unknown[] });
  }

  const where = buildWhere([
    ...sourceConds,
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms_filter),
  ]);

  // SQLite 周起始日：date(d, 'weekday 0', '-6 days') = 周一
  const sql = `SELECT
    date("线索日期", 'weekday 0', '-6 days') as week_start,
    "平台来源" as platform,
    "客户来源" as customer_source,
    COUNT(id) as leads,
    COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
    COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
    COALESCE(SUM(CASE WHEN ("是否有效线索" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_valid_lead,
    COALESCE(SUM(CASE WHEN ("是否开户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_opened,
    COALESCE(SUM(CASE WHEN ("是否为有效户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)) THEN 1 ELSE 0 END), 0) as new_valid
  FROM fact_conv_content ${where.clause}
  GROUP BY week_start, "平台来源", "客户来源"`;
  const rows = await querySql<Row>(sql, where.params);

  interface AnchorAgg {
    anchor: string;
    live_type: string | null;
    totals: { leads: number; mouth: number; valid_lead: number; new_valid_lead: number; new_opened: number; new_valid: number };
    weekly: Record<string, { leads: number; mouth: number; valid_lead: number; new_valid_lead: number; new_opened: number; new_valid: number }>;
  }
  const anchorMap: Record<string, AnchorAgg> = {};
  const weeklyAgg: Record<string, { leads: number; mouth: number; valid_lead: number; new_valid_lead: number; new_opened: number; new_valid: number }> = {};
  const allAnchors = new Set<string>();

  for (const r of rows) {
    const week = r.week_start ? String(r.week_start).slice(0, 10) : '未知周';
    const src = String(r.customer_source || '').trim();
    const matches: Array<{ anchor: string; segment: string }> = [];
    for (const part of src.split(ANCHOR_SPLIT)) {
      const segment = part.trim();
      if (!segment) continue;
      const m = ANCHOR_PATTERN.exec(segment);
      let normalizedAnchor: string | null = null;
      if (m) {
        const rawAnchorName = m[2].trim();
        if (!rawAnchorName) continue;
        normalizedAnchor = ltMap.token_to_anchor[segment] || rawAnchorName;
      } else if (ltMap.plain_name_tokens.has(segment)) {
        normalizedAnchor = ltMap.token_to_anchor[segment] || segment;
      } else {
        continue;
      }

      // token 级 live_type：先查 token 精确匹配，回退到该主播的所有 live_type
      const segLt = ltMap.token_to_live_type[segment];
      let segLts: Set<string>;
      if (segLt) {
        segLts = new Set([segLt]);
      } else {
        segLts = ltMap.anchor_to_live_types[normalizedAnchor] || new Set();
      }

      // live_types 筛选：只保留 live_types 与 wanted 有交集的 (anchor, segment)
      if (wantedLiveTypes.size > 0) {
        let hasIntersection = false;
        for (const lt of segLts) {
          if (wantedLiveTypes.has(lt)) { hasIntersection = true; break; }
        }
        if (!hasIntersection) continue;
      }

      matches.push({ anchor: normalizedAnchor, segment });
    }

    if (matches.length === 0) continue;

    const seen = new Set<string>();
    const sortedMatches = matches.slice().sort((a, b) => a.anchor.localeCompare(b.anchor));
    for (const match of sortedMatches) {
      if (seen.has(match.anchor)) continue;
      seen.add(match.anchor);

      if (!anchorMap[match.anchor]) {
        const anchorLts = ltMap.anchor_to_live_types[match.anchor];
        const sortedLts = anchorLts ? Array.from(anchorLts).sort() : [];
        const primaryLt = sortedLts.length > 0 ? sortedLts[0] : null;
        anchorMap[match.anchor] = {
          anchor: match.anchor,
          live_type: primaryLt,
          totals: { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 },
          weekly: {},
        };
        allAnchors.add(match.anchor);
      }

      const a = anchorMap[match.anchor];
      a.totals.leads += toInt(r.leads);
      a.totals.mouth += toInt(r.mouth);
      a.totals.valid_lead += toInt(r.valid_lead);
      a.totals.new_valid_lead += toInt(r.new_valid_lead);
      a.totals.new_opened += toInt(r.new_opened);
      a.totals.new_valid += toInt(r.new_valid);

      if (!a.weekly[week]) {
        a.weekly[week] = { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 };
      }
      const w = a.weekly[week];
      w.leads += toInt(r.leads);
      w.mouth += toInt(r.mouth);
      w.valid_lead += toInt(r.valid_lead);
      w.new_valid_lead += toInt(r.new_valid_lead);
      w.new_opened += toInt(r.new_opened);
      w.new_valid += toInt(r.new_valid);

      if (!weeklyAgg[week]) {
        weeklyAgg[week] = { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 };
      }
      const wa = weeklyAgg[week];
      wa.leads += toInt(r.leads);
      wa.mouth += toInt(r.mouth);
      wa.valid_lead += toInt(r.valid_lead);
      wa.new_valid_lead += toInt(r.new_valid_lead);
      wa.new_opened += toInt(r.new_opened);
      wa.new_valid += toInt(r.new_valid);
    }
  }

  // 组装 anchor_items + 派生率
  const anchorItems: any[] = [];
  for (const a of Object.values(anchorMap)) {
    const t = a.totals;
    const totalsWithRates = {
      ...t,
      ...anchorCalcRates(t.leads, t.mouth, t.valid_lead, t.new_valid_lead, t.new_opened, t.new_valid),
    };
    const weeklyList: any[] = [];
    for (const wk of Object.keys(a.weekly).sort()) {
      const w = a.weekly[wk];
      weeklyList.push({
        week_start: wk,
        ...w,
        ...anchorCalcRates(w.leads, w.mouth, w.valid_lead, w.new_valid_lead, w.new_opened, w.new_valid),
      });
    }
    anchorItems.push({
      anchor: a.anchor,
      live_type: a.live_type,
      totals: totalsWithRates,
      weekly: weeklyList,
    });
  }

  // Top N 排序（按新开户 → 线索量 降序）
  anchorItems.sort((a, b) =>
    (b.totals.new_opened - a.totals.new_opened) || (b.totals.leads - a.totals.leads)
  );
  const topAnchors = anchorItems.slice(0, top_n);

  const weeklyTotals: any[] = [];
  for (const wk of Object.keys(weeklyAgg).sort()) {
    const t = weeklyAgg[wk];
    weeklyTotals.push({
      week_start: wk,
      ...t,
      ...anchorCalcRates(t.leads, t.mouth, t.valid_lead, t.new_valid_lead, t.new_opened, t.new_valid),
    });
  }

  const totals = {
    total_anchors: anchorItems.length,
    top_anchors: topAnchors.length,
    total_leads: anchorItems.reduce((s, a) => s + a.totals.leads, 0),
    total_new_valid_lead: anchorItems.reduce((s, a) => s + a.totals.new_valid_lead, 0),
    total_new_opened: anchorItems.reduce((s, a) => s + a.totals.new_opened, 0),
    total_new_valid: anchorItems.reduce((s, a) => s + a.totals.new_valid, 0),
    total_weeks: weeklyTotals.length,
  };

  return {
    anchors: Array.from(allAnchors).sort(),
    weekly_totals: weeklyTotals,
    anchor_items: topAnchors,
    totals,
    top_n,
    all_count: anchorItems.length,
  };
}

// ============================================================================
// 投放评审 (investment-review)
// ============================================================================

/**
 * 投放评审：按厂商 × 月度展示消耗/企微/开口/开户/加微成本/开户成本
 * 数据源：agg_vendor_daily（与厂商分析共用）
 */
async function handleInvestmentReview(url: string, body: any): Promise<any> {
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

  // 按 厂商 × 月(substr(日期,1,7)) 聚合
  const sql = `SELECT "厂商" as agency,
    substr("日期", 1, 7) as month,
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开口人数"), 0) as opened_conversation,
    COALESCE(SUM("开户人数"), 0) as opened_account
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "厂商", month ORDER BY "厂商", month`;
  const rows = await querySql<Row>(sql, where.params);

  // 按厂商分桶
  const byAgency: Record<string, any[]> = {};
  for (const r of rows) {
    const agency = r.agency || '未归因';
    if (!byAgency[agency]) byAgency[agency] = [];
    const cost = toFloat(r.cost);
    const leads = toInt(r.leads);
    const opened_conv = toInt(r.opened_conversation);
    const opened_acc = toInt(r.opened_account);
    byAgency[agency].push({
      month: r.month || '',
      cost: round2(cost),
      leads,
      opened_conversation: opened_conv,
      opened_account: opened_acc,
      lead_cost: leads > 0 ? round2(cost / leads) : null,
      account_cost: opened_acc > 0 ? round2(cost / opened_acc) : null,
    });
  }

  // 每个厂商追加"总计"行
  const monthly_payload: Record<string, any[]> = {};
  const trend_payload: Record<string, any[]> = {};
  for (const agency in byAgency) {
    const items = byAgency[agency];
    const total_cost = items.reduce((s, it) => s + it.cost, 0);
    const total_leads = items.reduce((s, it) => s + it.leads, 0);
    const total_conv = items.reduce((s, it) => s + it.opened_conversation, 0);
    const total_acc = items.reduce((s, it) => s + it.opened_account, 0);
    const total_row = {
      month: '总计',
      cost: round2(total_cost),
      leads: total_leads,
      opened_conversation: total_conv,
      opened_account: total_acc,
      lead_cost: total_leads > 0 ? round2(total_cost / total_leads) : null,
      account_cost: total_acc > 0 ? round2(total_cost / total_acc) : null,
      is_total: true,
    };
    monthly_payload[agency] = items.concat([total_row]);
    trend_payload[agency] = items;
  }

  // 厂商列表（按消耗降序）
  const agency_list = Object.keys(byAgency).sort(
    (a, b) => byAgency[b].reduce((s, it) => s + it.cost, 0) - byAgency[a].reduce((s, it) => s + it.cost, 0)
  );
  // 移动端无 full_to_short，简称=全称
  const agency_short_map: Record<string, string> = {};
  for (const a of agency_list) agency_short_map[a] = a;

  const month_set = new Set<string>();
  for (const items of Object.values(byAgency)) {
    for (const it of items) month_set.add(it.month);
  }

  return {
    agencies: agency_list,
    agency_short_map,
    monthly: monthly_payload,
    trend: trend_payload,
    meta: { agency_count: agency_list.length, month_count: month_set.size },
  };
}

// ============================================================================
// 应用市场计划分析 (reports/app-market/plan-analysis)
// ============================================================================

/** SQLite 周起始日（周一）：date(d, 'weekday 0', '-6 days') */
const WEEK_START_EXPR = `date("下载日期", 'weekday 0', '-6 days')`;

async function handleAppMarketPlanAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const app_market = filters.app_market || filters.app_markets?.[0];
  const top_n = Math.max(1, toInt(body?.top_n) || 30);

  // 强制 渠道类型='互联网引流'
  const where = buildWhere([
    dateClause('下载日期', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
    app_market ? { sql: '"应用市场" = ?', params: [app_market] } : null,
  ]);

  // 5 阶段漏斗
  const funnelCols: [string, string][] = [
    ['是否激活APP', '激活APP'],
    ['是否开户成功', '开户成功'],
    ['是否新开户', '新开户'],
    ['是否入金', '入金'],
    ['是否有效户', '有效户'],
  ];
  const selectCols = funnelCols.map(([c, a]) => `COALESCE(SUM("${c}"), 0) as "${a}"`).join(', ');

  // 整体周度走势
  const weeklySql = `SELECT ${WEEK_START_EXPR} as week_start, ${selectCols}
    FROM fact_conv_appmarket ${where.clause}
    GROUP BY week_start ORDER BY week_start`;
  const weeklyRows = await querySql<Row>(weeklySql, where.params);
  const weekly_totals = weeklyRows.map(r => {
    const cnt: Record<string, number> = {};
    for (const [, a] of funnelCols) cnt[a] = toInt(r[a]);
    return {
      week_start: String(r.week_start).slice(0, 10),
      ...cnt,
      激活_开户率: cnt['激活APP'] > 0 ? round2(cnt['开户成功'] / cnt['激活APP'] * 100) : 0,
      激活_新开户率: cnt['激活APP'] > 0 ? round2(cnt['新开户'] / cnt['激活APP'] * 100) : 0,
      激活_有效率: cnt['激活APP'] > 0 ? round2(cnt['有效户'] / cnt['激活APP'] * 100) : 0,
      开户_新开户率: cnt['开户成功'] > 0 ? round2(cnt['新开户'] / cnt['开户成功'] * 100) : 0,
      开户_有效率: cnt['开户成功'] > 0 ? round2(cnt['有效户'] / cnt['开户成功'] * 100) : 0,
    };
  });

  // plan_key：广告计划ID NULL/0 fallback 投放账号
  const planExpr = `CASE WHEN "广告计划ID" IS NULL OR "广告计划ID" = 0 THEN COALESCE("投放账号", '未归因') ELSE CAST("广告计划ID" AS TEXT) END`;
  const planSql = `SELECT ${planExpr} as plan_key, "投放账号", ${WEEK_START_EXPR} as week_start, ${selectCols}
    FROM fact_conv_appmarket ${where.clause}
    GROUP BY plan_key, "投放账号", week_start ORDER BY week_start`;
  const planRows = await querySql<Row>(planSql, where.params);

  // 按 plan_key 聚合
  const planMap: Record<string, { plan_id: string; 投放账号: string; totals: any; weekly: any[] }> = {};
  for (const r of planRows) {
    const pk = String(r.plan_key || '未归因');
    if (!planMap[pk]) {
      planMap[pk] = {
        plan_id: pk,
        投放账号: r['投放账号'] || '-',
        totals: { 激活APP: 0, 开户成功: 0, 新开户: 0, 入金: 0, 有效户: 0 },
        weekly: [],
      };
    }
    const cnt: Record<string, number> = {};
    for (const [, a] of funnelCols) cnt[a] = toInt(r[a]);
    for (const [, a] of funnelCols) planMap[pk].totals[a] += cnt[a];
    planMap[pk].weekly.push({
      week_start: String(r.week_start).slice(0, 10),
      ...cnt,
      激活_开户率: cnt['激活APP'] > 0 ? round2(cnt['开户成功'] / cnt['激活APP'] * 100) : 0,
      激活_新开户率: cnt['激活APP'] > 0 ? round2(cnt['新开户'] / cnt['激活APP'] * 100) : 0,
      激活_有效率: cnt['激活APP'] > 0 ? round2(cnt['有效户'] / cnt['激活APP'] * 100) : 0,
      开户_新开户率: cnt['开户成功'] > 0 ? round2(cnt['新开户'] / cnt['开户成功'] * 100) : 0,
      开户_有效率: cnt['开户成功'] > 0 ? round2(cnt['有效户'] / cnt['开户成功'] * 100) : 0,
    });
  }

  // 补算每个 plan 的 totals 5 个转化率派生（对齐后端 app_market.py:488-490 的 _calc_rates）
  for (const pk in planMap) {
    const t = planMap[pk].totals;
    t.激活_开户率 = t['激活APP'] > 0 ? round2(t['开户成功'] / t['激活APP'] * 100) : 0;
    t.激活_新开户率 = t['激活APP'] > 0 ? round2(t['新开户'] / t['激活APP'] * 100) : 0;
    t.激活_有效率 = t['激活APP'] > 0 ? round2(t['有效户'] / t['激活APP'] * 100) : 0;
    t.开户_新开户率 = t['开户成功'] > 0 ? round2(t['新开户'] / t['开户成功'] * 100) : 0;
    t.开户_有效率 = t['开户成功'] > 0 ? round2(t['有效户'] / t['开户成功'] * 100) : 0;
  }

  const all_plans = Object.values(planMap);
  // Top N 排序（按 新开户 → 开户成功 → 激活APP 降序）
  all_plans.sort((a, b) =>
    b.totals['新开户'] - a.totals['新开户'] ||
    b.totals['开户成功'] - a.totals['开户成功'] ||
    b.totals['激活APP'] - a.totals['激活APP']
  );
  const top_plans = all_plans.slice(0, top_n);

  // 平台列表
  const platSql = `SELECT DISTINCT "应用市场" as v FROM fact_conv_appmarket
    WHERE "渠道类型" = '互联网引流' AND "应用市场" IS NOT NULL`;
  const platRows = await querySql<Row>(platSql);
  const platforms = platRows.map(r => r.v).filter(Boolean).sort();

  const totals = {
    total_plans: all_plans.length,
    top_plans: top_plans.length,
    total_activate: all_plans.reduce((s, p) => s + p.totals['激活APP'], 0),
    total_open: all_plans.reduce((s, p) => s + p.totals['开户成功'], 0),
    total_new_open: all_plans.reduce((s, p) => s + p.totals['新开户'], 0),
    total_deposit: all_plans.reduce((s, p) => s + p.totals['入金'], 0),
    total_valid: all_plans.reduce((s, p) => s + p.totals['有效户'], 0),
    total_weeks: weekly_totals.length,
  };

  return {
    platforms,
    selected_platform: app_market || null,
    weekly_totals,
    plan_items: top_plans,
    totals,
    top_n,
    all_count: all_plans.length,
  };
}

// ============================================================================
// 应用市场创意 (reports/app-market/creative)
// ============================================================================

async function handleAppMarketCreative(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const top_n = Math.max(1, toInt(body?.top_n) || 50);

  // 强制 渠道类型='互联网引流'（_funnel_filters 业务规则）
  const where = buildWhere([
    dateClause('下载日期', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
    inClause('应用市场', filters.app_markets),
  ]);

  const planExpr = `CASE WHEN "广告计划ID" IS NULL OR "广告计划ID" = 0 THEN COALESCE("投放账号", '未归因') ELSE CAST("广告计划ID" AS TEXT) END`;
  const sql = `SELECT ${planExpr} as plan_key,
    "投放账号", "应用市场", "渠道类型",
    COALESCE(SUM("是否激活APP"), 0) as 激活APP,
    COALESCE(SUM("是否开户成功"), 0) as 开户成功,
    COALESCE(SUM("是否新开户"), 0) as 新开户,
    COALESCE(SUM("是否入金"), 0) as 入金,
    COALESCE(SUM("是否有效户"), 0) as 有效户
  FROM fact_conv_appmarket ${where.clause}
  GROUP BY plan_key, "投放账号", "应用市场", "渠道类型"`;
  const rows = await querySql<Row>(sql, where.params);

  const items = rows.map(r => {
    const activate = toInt(r['激活APP']);
    const opened = toInt(r['开户成功']);
    const newOpen = toInt(r['新开户']);
    const deposit = toInt(r['入金']);
    const valid = toInt(r['有效户']);
    const planId = String(r.plan_key || '未归因');
    return {
      plan_id: planId,
      plan_label: planId,
      投放账号: r['投放账号'] || '-',
      应用市场: r['应用市场'] || '未归因',
      渠道类型: r['渠道类型'] || '未归因',
      激活APP: activate, 开户成功: opened, 新开户: newOpen, 入金: deposit, 有效户: valid,
      激活_开户率: activate > 0 ? round2(opened / activate * 100) : 0,
      激活_新开户率: activate > 0 ? round2(newOpen / activate * 100) : 0,
      激活_有效率: activate > 0 ? round2(valid / activate * 100) : 0,
      开户_有效率: opened > 0 ? round2(valid / opened * 100) : 0,
      开户_新开户率: opened > 0 ? round2(newOpen / opened * 100) : 0,
    };
  });
  items.sort((a, b) => b.新开户 - a.新开户 || b.开户成功 - a.开户成功 || b.激活APP - a.激活APP);
  const top_items = items.slice(0, top_n);

  return {
    items: top_items,
    totals: {
      total_plans: items.length,
      top_plans: top_items.length,
      total_activate: items.reduce((s, i) => s + i.激活APP, 0),
      total_open: items.reduce((s, i) => s + i.开户成功, 0),
      total_new_open: items.reduce((s, i) => s + i.新开户, 0),
      total_deposit: items.reduce((s, i) => s + i.入金, 0),
      total_valid: items.reduce((s, i) => s + i.有效户, 0),
    },
    top_n,
    all_count: items.length,
  };
}

// ============================================================================
// 小红书笔记列表 (xhs-notes-list / xhs-notes/list)
// ============================================================================

/** agg_xhs_note 字段白名单（用于 sort_field 校验） */
const XHS_NOTE_SORT_FIELDS = new Set([
  '发布时间', '消费金额', '总展现量', '点击量', '总互动量', '私信进线人数',
  '添加企微人数', '企微成功添加人数', '开户人数', '加微成本', '开户成本', '推广展现量', '推广点击量',
]);

/** 小红书笔记列表（POST 与 GET 共享） */
async function handleXhsNotesList(url: string, body: any): Promise<any> {
  // 参数解析：POST 在 body.filters；GET 在 URL query
  let filters: any, page: number, page_size: number, sort_field: string, sort_order: string;
  if (body?.filters || body?.page) {
    filters = body.filters || {};
    page = Math.max(1, toInt(body.page) || 1);
    page_size = Math.max(1, Math.min(200, toInt(body.page_size) || 50));
    sort_field = (body.sort_field || '').trim() || '开户人数';
    sort_order = (body.sort_order || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  } else {
    const q = parseQueryParams(url);
    filters = {};
    if (q.publish_start_date) filters.publish_start_date = q.publish_start_date;
    if (q.publish_end_date) filters.publish_end_date = q.publish_end_date;
    if (q.creator) filters.creators = [q.creator];
    if (q.ad_strategies) filters.ad_strategies = q.ad_strategies.split(',').filter(Boolean);
    if (q.content_types) filters.content_types = q.content_types.split(',').filter(Boolean);
    if (q.account) filters.account = q.account;
    page = Math.max(1, toInt(q.page) || 1);
    page_size = Math.max(1, Math.min(200, toInt(q.page_size) || 50));
    sort_field = (q.sort_field || '').trim() || '开户人数';
    sort_order = (q.sort_order || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  }

  // 兼容 filters.date_range → publish_start/end
  const publish_start = filters.publish_start_date || (filters.date_range?.[0]);
  let publish_end = filters.publish_end_date || (filters.date_range?.[1]);
  if (publish_end && publish_end.length === 10) publish_end = publish_end + ' 23:59:59';

  const conditions: ({ sql: string; params: unknown[] } | null)[] = [];
  if (publish_start && publish_end) {
    conditions.push({ sql: '"发布时间" >= ? AND "发布时间" <= ?', params: [publish_start, publish_end] });
  } else if (publish_start) {
    conditions.push({ sql: '"发布时间" >= ?', params: [publish_start] });
  } else if (publish_end) {
    conditions.push({ sql: '"发布时间" <= ?', params: [publish_end] });
  }
  if (filters.creators) conditions.push(inClause('创作者', filters.creators));
  if (filters.ad_strategies) conditions.push(inClause('广告策略', filters.ad_strategies));
  if (filters.content_types) conditions.push(inClause('内容类型', filters.content_types));
  if (filters.account) conditions.push({ sql: '"笔记账号" = ?', params: [filters.account] });
  const where = buildWhere(conditions);

  // 排序字段校验：白名单内才用，否则 fallback 到 发布时间
  const sort_col = XHS_NOTE_SORT_FIELDS.has(sort_field) ? sort_field : '发布时间';

  // 总数
  const totalSql = `SELECT COUNT(*) as c FROM agg_xhs_note ${where.clause}`;
  const totalRows = await querySql<Row>(totalSql, where.params);
  const total = toInt(totalRows[0]?.c);
  const offset = (page - 1) * page_size;

  const sql = `SELECT * FROM agg_xhs_note ${where.clause}
    ORDER BY "${sort_col}" ${sort_order === 'asc' ? 'ASC' : 'DESC'}
    LIMIT ${page_size} OFFSET ${offset}`;
  const rows = await querySql<Row>(sql, where.params);

  const notes = rows.map(r => ({
    id: r.id,
    note_id: r['笔记ID'],
    note_title: r['笔记标题'] || '',
    note_type: r['笔记类型'] || '',
    content_type: r['内容类型'] || '',
    publish_account: r['笔记账号'] || '',
    creator_name: r['创作者'] || '',
    producer: r['创作者'] || '',
    ad_strategy: r['广告策略'] || '',
    publish_time: r['发布时间'] || '',
    note_url: r['笔记链接'] || '',
    impressions: toInt(r['总展现量']),
    clicks: toInt(r['点击量']),
    click_rate: toFloat(r['总点击率']),
    interactions: toInt(r['总互动量']),
    cost: toFloat(r['消费金额']),
    ad_impressions: toInt(r['推广展现量']),
    ad_clicks: toInt(r['推广点击量']),
    ad_click_rate: toFloat(r['推广点击率']),
    ad_interactions: toInt(r['推广互动量']),
    private_messages: toInt(r['私信进线人数']),
    lead_users: toInt(r['添加企微人数']),
    customer_mouth_users: toInt(r['企微成功添加人数']),
    add_wechat_cost: toFloat(r['加微成本']),
    opened_account_users: toInt(r['开户人数']),
    open_account_cost: toFloat(r['开户成本']),
  }));

  return {
    notes,
    pagination: {
      page, page_size, total,
      total_pages: Math.ceil(total / page_size) || 0,
    },
  };
}

/** 小红书筛选选项（distinct 枚举） */
async function handleXhsNotesFilterOptions(): Promise<any> {
  const mkOpts = async (col: string) => {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "${col}" as v FROM agg_xhs_note
       WHERE "${col}" IS NOT NULL AND "${col}" != ''
       ORDER BY "${col}"`
    );
    return rows.map(r => ({ value: r.v, label: String(r.v) }));
  };
  return {
    creators: await mkOpts('创作者'),
    content_types: await mkOpts('内容类型'),
    ad_strategies: await mkOpts('广告策略'),
    publish_accounts: await mkOpts('笔记账号'),
  };
}

// ============================================================================
// 小红书运营分析 (xhs-notes-operation-analysis)
// ============================================================================

const XHS_ASSISTANTS = ['史菡漾', '何泳萍', '杨华', '贾芳', '陈鸿', '袁孝春', '赵梅', '张杰明'];

/** 上周五到本周四的周标签（与后端 _week_label 一致） */
function xhsWeekLabel(dateStr: string): string | null {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  const weekday = d.getUTCDay();           // Sun=0...Sat=6
  const wd = (weekday + 6) % 7;            // Mon=0...Sun=6（与 Python weekday() 对齐）
  const weekStart = new Date(d);
  if (wd >= 4) {                            // Fri/Sat/Sun → 本周五
    weekStart.setUTCDate(d.getUTCDate() - (wd - 4));
  } else {                                   // Mon-Thu → 上周五
    weekStart.setUTCDate(d.getUTCDate() - (wd + 3));
  }
  return weekStart.toISOString().slice(0, 10);
}

async function handleXhsNotesOperationAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const date_range = filters.date_range || [];
  const publish_start = date_range[0];
  let publish_end = date_range[1];
  if (publish_end && publish_end.length === 10) publish_end = publish_end + ' 23:59:59';

  const tn_range = filters.top_notes_date_range || [];
  const ca_range = filters.creator_annual_date_range || [];

  // ---- A. notes 基础集合（按 publish_start/publish_end 过滤发布时间） ----
  const baseWhere = buildWhere([
    publish_start && publish_end
      ? { sql: '"发布时间" >= ? AND "发布时间" <= ?', params: [publish_start, publish_end] }
      : null,
  ]);
  const notesSql = `SELECT * FROM agg_xhs_note ${baseWhere.clause}`;
  const notes = await querySql<Row>(notesSql, baseWhere.params);

  // ---- B. top_notes_subset（独立时间范围） ----
  const tnConditions: ({ sql: string; params: unknown[] } | null)[] = [];
  if (tn_range[0]) tnConditions.push({ sql: '"发布时间" >= ?', params: [tn_range[0]] });
  if (tn_range[1]) {
    const te = tn_range[1].length === 10 ? tn_range[1] + ' 23:59:59' : tn_range[1];
    tnConditions.push({ sql: '"发布时间" <= ?', params: [te] });
  }
  const tnWhere = buildWhere(tnConditions);
  const top_notes_subset = tn_range[0] || tn_range[1]
    ? await querySql<Row>(`SELECT * FROM agg_xhs_note ${tnWhere.clause}`, tnWhere.params)
    : notes;

  // ---- C. creator_annual_subset（独立时间范围） ----
  const caConditions: ({ sql: string; params: unknown[] } | null)[] = [];
  if (ca_range[0]) caConditions.push({ sql: '"发布时间" >= ?', params: [ca_range[0]] });
  if (ca_range[1]) {
    const ce = ca_range[1].length === 10 ? ca_range[1] + ' 23:59:59' : ca_range[1];
    caConditions.push({ sql: '"发布时间" <= ?', params: [ce] });
  }
  const caWhere = buildWhere(caConditions);
  const creator_annual_subset = ca_range[0] || ca_range[1]
    ? await querySql<Row>(`SELECT * FROM agg_xhs_note ${caWhere.clause}`, caWhere.params)
    : notes;

  // ---- core_metrics ----
  let total_cost = 0, total_impressions = 0, total_clicks = 0, total_interactions = 0;
  let total_pmsg = 0, total_lead_users = 0, _total_mouth_users = 0, total_opened = 0;
  const note_id_set = new Set<string>();
  for (const n of notes) {
    total_cost += toFloat(n['消费金额']);
    total_impressions += toInt(n['总展现量']);
    total_clicks += toInt(n['点击量']);
    total_interactions += toInt(n['总互动量']);
    total_pmsg += toInt(n['私信进线人数']);
    total_lead_users += toInt(n['添加企微人数']);
    _total_mouth_users += toInt(n['企微成功添加人数']);
    total_opened += toInt(n['开户人数']);
    if (n['笔记ID']) note_id_set.add(String(n['笔记ID']));
  }
  const pct = (a: number, b: number) => b > 0 ? round2(a / b * 100) : 0;
  const core_metrics = {
    new_notes_count: note_id_set.size,
    ad_notes_count: notes.length,
    total_cost: round2(total_cost),
    total_impressions,
    total_clicks,
    total_interactions,
    total_private_messages: total_pmsg,
    total_lead_users,
    total_opened_accounts: total_opened,
    impression_click_rate: pct(total_clicks, total_impressions),
    click_interaction_rate: pct(total_interactions, total_clicks),
    click_lead_rate: pct(total_pmsg, total_clicks),
    cost_per_private_message: total_pmsg > 0 ? round2(total_cost / total_pmsg) : 0,
    cost_per_lead_user: total_lead_users > 0 ? round2(total_cost / total_lead_users) : 0,
    cost_per_opened_account: total_opened > 0 ? round2(total_cost / total_opened) : 0,
    lead_to_wechat_rate: pct(total_lead_users, total_pmsg),
    wechat_to_account_rate: pct(total_opened, total_lead_users),
    cost_per_mille: total_impressions > 0 ? round2(total_cost / total_impressions * 1000) : 0,
    cost_per_click: total_clicks > 0 ? round2(total_cost / total_clicks) : 0,
  };

  // ---- creator_content / creator_conversion ----
  const creator_content: Record<string, any> = {};
  const creator_conversion: Record<string, any> = {};
  for (const n of notes) {
    const c = n['创作者'] || '未知';
    if (!creator_content[c]) {
      creator_content[c] = { note_count: 0, total_impressions: 0, total_clicks: 0, total_interactions: 0, total_cost: 0 };
    }
    if (!creator_conversion[c]) {
      creator_conversion[c] = { lead_users: 0, opened_account_users: 0, total_cost: 0, private_messages: 0, customer_mouth_users: 0, valid_lead_users: 0, valid_customer_users: 0 };
    }
    const cc = creator_content[c];
    cc.note_count++;
    cc.total_impressions += toInt(n['总展现量']);
    cc.total_clicks += toInt(n['点击量']);
    cc.total_interactions += toInt(n['总互动量']);
    cc.total_cost += toFloat(n['消费金额']);
    const cv = creator_conversion[c];
    cv.lead_users += toInt(n['添加企微人数']);
    cv.opened_account_users += toInt(n['开户人数']);
    cv.total_cost += toFloat(n['消费金额']);
    cv.private_messages += toInt(n['私信进线人数']);
    cv.customer_mouth_users += toInt(n['企微成功添加人数']);
  }
  const creator_content_data = Object.entries(creator_content).map(([k, v]) => ({
    producer: k, note_count: v.note_count,
    total_impressions: v.total_impressions, total_clicks: v.total_clicks,
    total_interactions: v.total_interactions, total_cost: round2(v.total_cost),
    avg_click_rate: v.total_impressions > 0 ? round2(v.total_clicks / v.total_impressions * 100) : 0,
    avg_interaction_rate: v.total_impressions > 0 ? round2(v.total_interactions / v.total_impressions * 100) : 0,
  }));
  const creator_conversion_data = Object.entries(creator_conversion).map(([k, v]) => ({
    producer: k, lead_users: v.lead_users, opened_account_users: v.opened_account_users,
    total_cost: round2(v.total_cost), private_messages: v.private_messages,
    customer_mouth_users: v.customer_mouth_users, valid_lead_users: 0, valid_customer_users: 0,
  }));

  // ---- creation_trend（按月聚合，限 2026+） ----
  const by_month: Record<string, any> = {};
  const by_month_producer: Record<string, Record<string, number>> = {};
  for (const n of notes) {
    const pt = String(n['发布时间'] || '');
    if (!pt || pt.slice(0, 4) < '2026') continue;
    const m = pt.slice(0, 7);
    if (!by_month[m]) by_month[m] = { note_count: 0, impressions: 0, interactions: 0, cost: 0 };
    by_month[m].note_count++;
    by_month[m].impressions += toInt(n['总展现量']);
    by_month[m].interactions += toInt(n['总互动量']);
    by_month[m].cost += toFloat(n['消费金额']);
    const prod = n['创作者'] || '未知';
    if (!by_month_producer[m]) by_month_producer[m] = {};
    by_month_producer[m][prod] = (by_month_producer[m][prod] || 0) + 1;
  }
  const sorted_months = Object.keys(by_month).sort();
  // Top 10 创作者
  const producer_total: Record<string, number> = {};
  for (const m in by_month_producer) {
    for (const p in by_month_producer[m]) {
      producer_total[p] = (producer_total[p] || 0) + by_month_producer[m][p];
    }
  }
  const top_producers = Object.entries(producer_total)
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
  const creation_trend = {
    dates: sorted_months,
    note_counts: sorted_months.map(m => by_month[m].note_count),
    impression_series: sorted_months.map(m => by_month[m].impressions),
    interaction_series: sorted_months.map(m => by_month[m].interactions),
    cost_series: sorted_months.map(m => round2(by_month[m].cost)),
    click_series: [],
    interaction_rate_series: sorted_months.map(m => by_month[m].impressions > 0 ? round2(by_month[m].interactions / by_month[m].impressions * 100) : 0),
    cost_per_mille_series: sorted_months.map(m => by_month[m].impressions > 0 ? round2(by_month[m].cost / by_month[m].impressions * 1000) : 0),
    producer_matrix: {
      producers: top_producers,
      months: sorted_months,
      matrix: Object.fromEntries(top_producers.map(p => [p, sorted_months.map(m => by_month_producer[m]?.[p] || 0)])),
    },
  };

  // ---- top_notes（按消费金额 desc Top 20） ----
  const top_notes = [...top_notes_subset]
    .sort((a, b) => toFloat(b['消费金额']) - toFloat(a['消费金额']))
    .slice(0, 20)
    .map(n => {
      const cost_v = toFloat(n['消费金额']);
      const interactions = toInt(n['总互动量']);
      return {
        note_id: n['笔记ID'],
        note_title: n['笔记标题'] || '',
        producer: n['创作者'] || '',
        publish_time: n['发布时间'] || '',
        ad_strategy: n['广告策略'] || '',
        total_impressions: toInt(n['总展现量']),
        total_clicks: toInt(n['点击量']),
        total_private_messages: toInt(n['私信进线人数']),
        interaction_count: interactions,
        lead_users: toInt(n['添加企微人数']),
        opened_account_users: toInt(n['开户人数']),
        total_cost: round2(cost_v),
        cost_per_interaction: interactions > 0 ? round2(cost_v / interactions) : 0,
      };
    });

  // ---- creator_annual_ranking（前 50，按 total_score desc） ----
  const by_creator: Record<string, any> = {};
  for (const n of creator_annual_subset) {
    const c = n['创作者'] || '未知';
    if (!by_creator[c]) {
      by_creator[c] = { cost: 0, lead_users: 0, opened: 0, interactions: 0, note_count: 0, total_impressions: 0, total_clicks: 0, total_private_messages: 0 };
    }
    const v = by_creator[c];
    v.cost += toFloat(n['消费金额']);
    v.lead_users += toInt(n['添加企微人数']);
    v.opened += toInt(n['开户人数']);
    v.interactions += toInt(n['总互动量']);
    v.note_count++;
    v.total_impressions += toInt(n['总展现量']);
    v.total_clicks += toInt(n['点击量']);
    v.total_private_messages += toInt(n['私信进线人数']);
  }
  const creator_annual_ranking = Object.entries(by_creator).map(([k, v]) => ({
    producer: k, note_count: v.note_count,
    total_impressions: v.total_impressions, total_clicks: v.total_clicks,
    total_private_messages: v.total_private_messages, total_cost: round2(v.cost),
    total_interactions: v.interactions, lead_users: v.lead_users,
    opened_account_users: v.opened,
    total_score: v.lead_users * 10 + v.opened * 100 + v.interactions * 0.01,
  })).sort((a, b) => b.total_score - a.total_score).slice(0, 50);

  // ---- agency_data（agg_vendor_daily 平台='小红书'） ----
  const agWhere = buildWhere([
    { sql: '"厂商" IS NOT NULL AND "厂商" != \'\'', params: [] as unknown[] },
    { sql: '"平台" = ?', params: ['小红书'] },
    publish_start && publish_end
      ? { sql: '"日期" >= ? AND "日期" <= ?', params: [publish_start, publish_end.slice(0, 10)] }
      : null,
  ]);
  const agSql = `SELECT "厂商",
    COALESCE(SUM("花费"), 0) as total_cost,
    COALESCE(SUM("展示量"), 0) as total_impressions,
    COALESCE(SUM("点击量"), 0) as total_clicks,
    COALESCE(SUM("线索数"), 0) as lead_users,
    COALESCE(SUM("开口人数"), 0) as customer_mouth_users,
    COALESCE(SUM("有效线索数"), 0) as valid_lead_users,
    COALESCE(SUM("开户人数"), 0) as opened_account_users,
    COALESCE(SUM("有效户人数"), 0) as valid_customer_users
  FROM agg_vendor_daily ${agWhere.clause}
  GROUP BY "厂商"`;
  const agRows = await querySql<Row>(agSql, agWhere.params);
  const agency_data = agRows.map(r => ({
    agency: r['厂商'] || '未归因',
    total_cost: round2(toFloat(r.total_cost)),
    total_impressions: toInt(r.total_impressions),
    total_clicks: toInt(r.total_clicks),
    lead_users: toInt(r.lead_users),
    potential_customers: toInt(r.customer_mouth_users),
    customer_mouth_users: toInt(r.customer_mouth_users),
    valid_lead_users: toInt(r.valid_lead_users),
    opened_account_users: toInt(r.opened_account_users),
    valid_customer_users: toInt(r.valid_customer_users),
  })).sort((a, b) => b.total_cost - a.total_cost);

  // ---- conversion_trend（fact_conv_content 平台来源='小红书'，周维度） ----
  const convWhere = buildWhere([
    { sql: '"平台来源" = ?', params: ['小红书'] },
    publish_start && publish_end
      ? { sql: '"线索日期" >= ? AND "线索日期" <= ?', params: [publish_start, publish_end.slice(0, 10)] }
      : null,
  ]);
  const convSql = `SELECT "线索日期", "是否客户开口", "是否有效线索", "是否开户"
    FROM fact_conv_content ${convWhere.clause}`;
  const convRows = await querySql<Row>(convSql, convWhere.params);
  const by_week: Record<string, { leads: number; mouth: number; valid_lead: number; opened: number }> = {};
  for (const r of convRows) {
    const ld = String(r['线索日期'] || '');
    if (!ld || ld.slice(0, 4) < '2026') continue;
    const w = xhsWeekLabel(ld);
    if (!w || w < '2026-01-01') continue;
    if (!by_week[w]) by_week[w] = { leads: 0, mouth: 0, valid_lead: 0, opened: 0 };
    by_week[w].leads++;
    by_week[w].mouth += toInt(r['是否客户开口']);
    by_week[w].valid_lead += toInt(r['是否有效线索']);
    by_week[w].opened += toInt(r['是否开户']);
  }
  const sorted_weeks = Object.keys(by_week).sort();
  const conversion_trend = {
    weeks: sorted_weeks,
    dateRanges: sorted_weeks,
    lead_users: sorted_weeks.map(w => by_week[w].leads),
    customer_mouth_users: sorted_weeks.map(w => by_week[w].mouth),
    valid_lead_users: sorted_weeks.map(w => by_week[w].valid_lead),
    opened_account_users: sorted_weeks.map(w => by_week[w].opened),
  };

  // ---- note_conversion_ranking（前 10，按 lead_users desc） ----
  const note_conversion_ranking = notes
    .filter(n => n['笔记ID'] && toInt(n['添加企微人数']) > 0)
    .map(n => ({
      note_id: n['笔记ID'],
      note_title: n['笔记标题'] || '',
      producer: n['创作者'] || '',
      lead_users: toInt(n['添加企微人数']),
      opened_account_users: toInt(n['开户人数']),
      conversion_rate: pct(toInt(n['开户人数']), toInt(n['添加企微人数'])),
    }))
    .sort((a, b) => b.lead_users - a.lead_users)
    .slice(0, 10);

  const creator_creation_data = Object.entries(creator_content).map(([k, v]) => ({
    producer: k, note_count: v.note_count, impressions: v.total_impressions,
  }));
  const creator_interaction_data = Object.entries(creator_content).map(([k, v]) => ({
    producer: k, total_interactions: v.total_interactions,
  }));

  // ---- employee_conversion_ranking（fact_conv_content 平台来源='小红书'，按员工分组，固定 8 人） ----
  const empWhere = buildWhere([
    { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
    { sql: '"平台来源" = ?', params: ['小红书'] },
    publish_start && publish_end
      ? { sql: '"线索日期" >= ? AND "线索日期" <= ?', params: [publish_start, publish_end.slice(0, 10)] }
      : null,
  ]);
  const empSql = `SELECT "添加员工姓名",
    COUNT(id) as leads,
    COALESCE(SUM("是否有效线索"), 0) as valid_leads,
    COALESCE(SUM("是否开户"), 0) as opened,
    COALESCE(SUM("是否为有效户"), 0) as valid,
    COALESCE(SUM("资产"), 0) as assets
  FROM fact_conv_content ${empWhere.clause}
  GROUP BY "添加员工姓名"`;
  const empRows = await querySql<Row>(empSql, empWhere.params);
  const xhs_set = new Set(XHS_ASSISTANTS);
  const emp_ranking = empRows
    .filter(r => xhs_set.has(r['添加员工姓名']))
    .map(r => {
      const leads = toInt(r.leads); const opened = toInt(r.opened); const valid = toInt(r.valid);
      return {
        employee_name: r['添加员工姓名'],
        lead_users: leads, wechat_adds: leads,
        valid_lead_users: toInt(r.valid_leads), opened_account_users: opened,
        valid_customer_users: valid,
        opening_rate: leads > 0 ? round2(opened / leads * 100) : 0,
        valid_customer_rate: opened > 0 ? round2(valid / opened * 100) : 0,
        total_assets: round2(toFloat(r.assets)),
      };
    })
    .sort((a, b) => b.opened_account_users - a.opened_account_users);
  // 补齐名单中没数据的员工
  const existing_names = new Set(emp_ranking.map(r => r.employee_name));
  for (const name of XHS_ASSISTANTS) {
    if (!existing_names.has(name)) {
      emp_ranking.push({
        employee_name: name, lead_users: 0, wechat_adds: 0,
        valid_lead_users: 0, opened_account_users: 0, valid_customer_users: 0,
        opening_rate: 0, valid_customer_rate: 0, total_assets: 0,
      });
    }
  }

  return {
    core_metrics,
    creator_content_data,
    creator_conversion_data,
    creation_trend,
    top_notes,
    creator_annual_ranking,
    agency_data,
    conversion_trend,
    note_conversion_ranking,
    creator_creation_data,
    creator_interaction_data,
    employee_conversion_ranking: emp_ranking,
  };
}

// ============================================================================
// 小红书计划分析 (reports/xhs/plan-analysis)
// ============================================================================

const XHS_TARGET_AGENCIES = ['直投', '量子', '绩牛', '美洋'];
const XHS_PLAN_FUNNEL_KEYS = ['企微', '开口', '有效线索', '有效线索_不含存量', '新开户', '有效户'] as const;

/** 计算小红书计划分析的 7 个转化率 */
function xhsPlanCalcRates(qiwei: number, kaihou: number, youxiao: number, youxiao_bcq: number, xinkaihu: number, youxiao_hu: number) {
  return {
    '企微_开口率': qiwei > 0 ? round2(kaihou / qiwei * 100) : 0,
    '企微_有效线索率': qiwei > 0 ? round2(youxiao / qiwei * 100) : 0,
    '企微_不含存量率': qiwei > 0 ? round2(youxiao_bcq / qiwei * 100) : 0,
    '企微_新开户率': qiwei > 0 ? round2(xinkaihu / qiwei * 100) : 0,
    '企微_有效户率': qiwei > 0 ? round2(youxiao_hu / qiwei * 100) : 0,
    '开口_新开户率': kaihou > 0 ? round2(xinkaihu / kaihou * 100) : 0,
    '不含存量_有效户率': youxiao_bcq > 0 ? round2(youxiao_hu / youxiao_bcq * 100) : 0,
  };
}

async function handleXhsPlanAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const agency = filters.agency;
  const top_n = Math.max(1, toInt(body?.top_n) || 30);

  // 主聚合 SQL（plan × week）
  const planExpr = `CASE WHEN "广告ID" IS NULL OR "广告ID" = '' THEN COALESCE("广告账号", '未归因') ELSE "广告ID" END`;
  const conditions: ({ sql: string; params: unknown[] } | null)[] = [
    { sql: '"平台来源" = ?', params: ['小红书'] },
    dateClause('线索日期', sd, ed),
  ];
  if (agency) conditions.push({ sql: '"广告代理商" = ?', params: [String(agency)] });
  const where = buildWhere(conditions);

  const sql = `SELECT ${planExpr} as plan_key,
    "广告账号", "广告代理商",
    date("线索日期", 'weekday 0', '-6 days') as week_start,
    COUNT(id) as "企微",
    COALESCE(SUM("是否客户开口"), 0) as "开口",
    COALESCE(SUM("是否有效线索"), 0) as "有效线索",
    COALESCE(SUM(CASE WHEN "是否有效线索" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL) THEN 1 ELSE 0 END), 0) as "有效线索_不含存量",
    COALESCE(SUM(CASE WHEN "是否开户" = 1 AND ("是否为存量客户" = 0 OR "是否为存量客户" IS NULL) THEN 1 ELSE 0 END), 0) as "新开户",
    COALESCE(SUM("是否为有效户"), 0) as "有效户"
  FROM fact_conv_content ${where.clause}
  GROUP BY plan_key, "广告账号", "广告代理商", week_start
  ORDER BY week_start`;
  const rows = await querySql<Row>(sql, where.params);

  // plan_map + weekly_agg
  const plan_map: Record<string, any> = {};
  const weekly_agg: Record<string, any> = {};
  for (const r of rows) {
    const plan_key = String(r.plan_key ?? '未归因');
    const week = String(r.week_start ?? '未知周');
    const vals: Record<string, number> = {};
    for (const k of XHS_PLAN_FUNNEL_KEYS) vals[k] = toInt(r[k]);

    if (!plan_map[plan_key]) {
      plan_map[plan_key] = {
        plan_id: plan_key,
        '广告账号': r['广告账号'] || '-',
        '广告代理商': r['广告代理商'] || '-',
        totals: Object.fromEntries(XHS_PLAN_FUNNEL_KEYS.map(k => [k, 0])),
        weekly: [],
      };
    }
    const p = plan_map[plan_key];
    for (const k of XHS_PLAN_FUNNEL_KEYS) p.totals[k] += vals[k];
    p.weekly.push({
      week_start: week,
      ...vals,
      ...xhsPlanCalcRates(vals['企微'], vals['开口'], vals['有效线索'], vals['有效线索_不含存量'], vals['新开户'], vals['有效户']),
    });
    if (!weekly_agg[week]) weekly_agg[week] = Object.fromEntries(XHS_PLAN_FUNNEL_KEYS.map(k => [k, 0]));
    for (const k of XHS_PLAN_FUNNEL_KEYS) weekly_agg[week][k] += vals[k];
  }

  // plan_items 加 rates + 排序
  const plan_items = Object.values(plan_map) as any[];
  for (const p of plan_items) {
    const t = p.totals;
    p.totals = { ...t, ...xhsPlanCalcRates(t['企微'], t['开口'], t['有效线索'], t['有效线索_不含存量'], t['新开户'], t['有效户']) };
    p.weekly.sort((a: any, b: any) => a.week_start.localeCompare(b.week_start));
  }
  plan_items.sort((a, b) =>
    (b.totals['新开户'] - a.totals['新开户']) ||
    (b.totals['有效线索_不含存量'] - a.totals['有效线索_不含存量']) ||
    (b.totals['开口'] - a.totals['开口'])
  );
  const top_plans = plan_items.slice(0, top_n);

  // 整体周度走势
  const weekly_totals = Object.keys(weekly_agg).sort().map(week => {
    const t = weekly_agg[week];
    return {
      week_start: week,
      ...t,
      ...xhsPlanCalcRates(t['企微'], t['开口'], t['有效线索'], t['有效线索_不含存量'], t['新开户'], t['有效户']),
    };
  });

  // 代理商列表
  const agCond: ({ sql: string; params: unknown[] } | null)[] = [
    { sql: '"平台来源" = ?', params: ['小红书'] },
    { sql: '"广告代理商" IS NOT NULL AND "广告代理商" != \'\'', params: [] as unknown[] },
    dateClause('线索日期', sd, ed),
  ];
  if (agency) agCond.push({ sql: '"广告代理商" = ?', params: [String(agency)] });
  const agWhere = buildWhere(agCond);
  const agSql = `SELECT DISTINCT "广告代理商" as v FROM fact_conv_content ${agWhere.clause} ORDER BY "广告代理商"`;
  const agRows = await querySql<Row>(agSql, agWhere.params);
  const agencies = agRows.map(r => r.v).filter(Boolean);

  const totals = {
    total_plans: plan_items.length,
    top_plans: top_plans.length,
    total_qiwei: plan_items.reduce((s, p) => s + p.totals['企微'], 0),
    total_kaihou: plan_items.reduce((s, p) => s + p.totals['开口'], 0),
    total_youxiao: plan_items.reduce((s, p) => s + p.totals['有效线索'], 0),
    total_youxiao_bcq: plan_items.reduce((s, p) => s + p.totals['有效线索_不含存量'], 0),
    total_xinkaihu: plan_items.reduce((s, p) => s + p.totals['新开户'], 0),
    total_youxiao_hu: plan_items.reduce((s, p) => s + p.totals['有效户'], 0),
    total_weeks: weekly_totals.length,
  };

  return {
    agencies,
    target_agencies: XHS_TARGET_AGENCIES,
    selected_agency: agency || null,
    weekly_totals,
    plan_items: top_plans,
    totals,
    top_n,
    all_count: plan_items.length,
  };
}

// ============================================================================
// 员工转化 (employee-conversion)
// ============================================================================

const EMP_CONTENT_PLATFORMS = ['小红书', '腾讯', '抖音', '快手', '财联社'];
const EMP_WEEKLY_ASSISTANTS = [
  '陈鸿', '荣杜娟', '贾芳', '赵梅', '袁孝春', '张杰明',
  '吴茂秋', '何泳萍', '李兆俊', '史菡漾', '朱橙青', '杨华',
];

/** 全表合格员工名单（总线索数 ≥ min_leads） */
async function empGetQualifiedEmployees(min_leads: number): Promise<string[]> {
  const rows = await querySql<Row>(
    `SELECT "添加员工姓名" as emp, COUNT(id) as n
     FROM fact_conv_content
     WHERE "添加员工姓名" IS NOT NULL AND "添加员工姓名" != ''
     GROUP BY "添加员工姓名"`
  );
  return rows.filter(r => toInt(r.n) >= min_leads).map(r => r.emp).filter(Boolean) as string[];
}

/** 月度趋势（实际聚合粒度是月） */
async function empGetWeeklyTrend(platforms: string[], sd?: string, ed?: string, employees?: string[]): Promise<any[]> {
  const where = buildWhere([
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    inClause('添加员工姓名', employees),
  ]);
  const sql = `SELECT substr("线索日期", 1, 7) as period,
    COUNT(id) as leads,
    COALESCE(SUM(CASE WHEN "是否开户" = 1 THEN 1 ELSE 0 END), 0) as opened,
    COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid
  FROM fact_conv_content ${where.clause}
  GROUP BY period ORDER BY period`;
  const rows = await querySql<Row>(sql, where.params);
  return rows.map(r => ({ period: r.period, leads: toInt(r.leads), opened: toInt(r.opened), valid: toInt(r.valid) }));
}

/** 平台概览（每平台一次查询） */
async function empGetPlatformOverview(platforms: string[], sd?: string, ed?: string, employees?: string[]): Promise<Record<string, any>> {
  const overview: Record<string, any> = {};
  for (const p of platforms) {
    const where = buildWhere([
      { sql: '"平台来源" = ?', params: [p] },
      dateClause('线索日期', sd, ed),
      inClause('添加员工姓名', employees),
    ]);
    const sql = `SELECT
      COUNT(id) as leads,
      COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
      COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
      COALESCE(SUM(CASE WHEN "是否开户" = 1 THEN 1 ELSE 0 END), 0) as opened,
      COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid,
      COALESCE(SUM("资产"), 0) as assets
    FROM fact_conv_content ${where.clause}`;
    const rows = await querySql<Row>(sql, where.params);
    const r = rows[0] || {};
    const leads = toInt(r.leads); const opened = toInt(r.opened);
    overview[p] = {
      total_leads: leads,
      mouth_count: toInt(r.mouth),
      valid_lead_count: toInt(r.valid_lead),
      opened_count: opened,
      valid_customer_count: toInt(r.valid),
      total_assets: round2(toFloat(r.assets)),
      opening_rate: leads > 0 ? round2(opened / leads * 100) : 0,
    };
  }
  return overview;
}

/** 员工转化排行（4 种 lead_type） */
async function empGetRanking(
  platforms: string[], sd?: string, ed?: string,
  lead_type: 'all' | 'existing' | 'new' | 'existing_new_open' = 'all',
  employees?: string[]
): Promise<any[]> {
  // existing_new_open 分支：双查询
  if (lead_type === 'existing_new_open' && sd) {
    // 查询 1：存量线索总数（线索日期 < start_date）
    const leadsWhere = buildWhere([
      { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
      { sql: '"线索日期" < ?', params: [sd] },
      inClause('添加员工姓名', employees),
      inClause('平台来源', platforms),
    ]);
    const leadsSql = `SELECT "添加员工姓名" as emp, "平台来源" as platform, COUNT(id) as total_leads
      FROM fact_conv_content ${leadsWhere.clause}
      GROUP BY "添加员工姓名", "平台来源"`;
    const leadsRows = await querySql<Row>(leadsSql, leadsWhere.params);
    const leads_map: Record<string, number> = {};
    for (const r of leadsRows) {
      leads_map[`${r.emp}|||${r.platform}`] = toInt(r.total_leads);
    }

    // 查询 2：本周新开户的存量线索
    const q2Where = buildWhere([
      { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
      { sql: '"线索日期" < ?', params: [sd] },
      { sql: '"开户时间" IS NOT NULL AND "开户时间" != \'\'', params: [] as unknown[] },
      dateClause('开户时间', sd, ed),
      { sql: '"是否开户" = 1', params: [] as unknown[] },
      inClause('添加员工姓名', employees),
      inClause('平台来源', platforms),
    ]);
    const q2Sql = `SELECT "添加员工姓名" as emp, "平台来源" as platform,
      COUNT(id) as opened,
      COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
      COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
      COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid_customer,
      COALESCE(SUM("资产"), 0) as assets
    FROM fact_conv_content ${q2Where.clause}
    GROUP BY "添加员工姓名", "平台来源"`;
    const q2Rows = await querySql<Row>(q2Sql, q2Where.params);

    const ranking: any[] = [];
    const ranked_keys = new Set<string>();
    for (const r of q2Rows) {
      const emp = r.emp; const platform = r.platform;
      const key = `${emp}|||${platform}`;
      ranked_keys.add(key);
      const total_leads = leads_map[key] || 0;
      const opened = toInt(r.opened);
      const valid_customer = toInt(r.valid_customer);
      ranking.push({
        employee_name: emp, platform,
        total_leads,
        mouth_count: toInt(r.mouth),
        valid_lead_count: toInt(r.valid_lead),
        opened_count: opened,
        valid_customer_count: valid_customer,
        total_assets: round2(toFloat(r.assets)),
        opening_rate: total_leads > 0 ? round2(opened / total_leads * 100) : 0,
        valid_customer_rate: opened > 0 ? round2(valid_customer / opened * 100) : 0,
      });
    }
    // 补全：有存量线索但本周未新开户的固定员工
    if (employees) {
      for (const emp of employees) {
        for (const p of platforms) {
          const key = `${emp}|||${p}`;
          if (ranked_keys.has(key)) continue;
          const leads = leads_map[key] || 0;
          if (leads > 0) {
            ranking.push({
              employee_name: emp, platform: p,
              total_leads: leads, mouth_count: 0, valid_lead_count: 0,
              opened_count: 0, valid_customer_count: 0, total_assets: 0,
              opening_rate: 0, valid_customer_rate: 0,
            });
          }
        }
      }
    }
    ranking.sort((a, b) => (b.opened_count - a.opened_count) || (b.total_leads - a.total_leads));
    return ranking;
  }

  // all / existing / new 分支：单查询
  const lead_type_cond = lead_type === 'existing'
    ? { sql: '"是否为存量客户" = 1', params: [] as unknown[] }
    : lead_type === 'new'
      ? { sql: '("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)', params: [] as unknown[] }
      : null;
  const where = buildWhere([
    { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
    dateClause('线索日期', sd, ed),
    inClause('平台来源', platforms),
    inClause('添加员工姓名', employees),
    lead_type_cond,
  ]);
  const sql = `SELECT "添加员工姓名" as emp, "平台来源" as platform,
    COUNT(id) as total_leads,
    COALESCE(SUM(CASE WHEN "是否客户开口" = 1 THEN 1 ELSE 0 END), 0) as mouth,
    COALESCE(SUM(CASE WHEN "是否有效线索" = 1 THEN 1 ELSE 0 END), 0) as valid_lead,
    COALESCE(SUM(CASE WHEN "是否开户" = 1 THEN 1 ELSE 0 END), 0) as opened,
    COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid_customer,
    COALESCE(SUM("资产"), 0) as assets
  FROM fact_conv_content ${where.clause}
  GROUP BY "添加员工姓名", "平台来源"`;
  const rows = await querySql<Row>(sql, where.params);
  const ranking = rows.map(r => {
    const leads = toInt(r.total_leads); const opened = toInt(r.opened); const valid = toInt(r.valid_customer);
    return {
      employee_name: r.emp, platform: r.platform,
      total_leads: leads,
      mouth_count: toInt(r.mouth),
      valid_lead_count: toInt(r.valid_lead),
      opened_count: opened,
      valid_customer_count: valid,
      total_assets: round2(toFloat(r.assets)),
      opening_rate: leads > 0 ? round2(opened / leads * 100) : 0,
      valid_customer_rate: opened > 0 ? round2(valid / opened * 100) : 0,
    };
  });
  ranking.sort((a, b) => b.opening_rate - a.opening_rate);
  return ranking;
}

/** 年度拆分（2025/2026） */
async function empGetYearlyBreakdown(platforms: string[], ed?: string, employees?: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const qualified = await empGetQualifiedEmployees(5);
  for (const year of [2025, 2026]) {
    const ys = `${year}-01-01`; const ye = `${year}-12-31`;
    const conditions: ({ sql: string; params: unknown[] } | null)[] = [
      { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
      { sql: '"线索日期" >= ? AND "线索日期" <= ?', params: [ys, ye] },
      { sql: '"线索日期" <= ?', params: [ed || ye] },
      inClause('平台来源', platforms),
      inClause('添加员工姓名', qualified.length > 0 ? qualified : employees),
      inClause('添加员工姓名', employees),
    ];
    const where = buildWhere(conditions);
    const sql = `SELECT
      COUNT(id) as total_leads,
      COALESCE(SUM(CASE WHEN "是否开户" = 1 THEN 1 ELSE 0 END), 0) as opened,
      COALESCE(SUM(CASE WHEN "是否为有效户" = 1 THEN 1 ELSE 0 END), 0) as valid_customer,
      COALESCE(SUM("资产"), 0) as assets
    FROM fact_conv_content ${where.clause}`;
    const rows = await querySql<Row>(sql, where.params);
    const r = rows[0] || {};
    const leads = toInt(r.total_leads); const opened = toInt(r.opened); const valid = toInt(r.valid_customer);
    result[`y${year}`] = {
      label: `${year % 100}年线索\n${year % 100}年开户`,
      total_leads: leads,
      opened_count: opened,
      valid_customer_count: valid,
      total_assets: round2(toFloat(r.assets)),
      opening_rate: leads > 0 ? round2(opened / leads * 100) : 0,
      valid_customer_rate: opened > 0 ? round2(valid / opened * 100) : 0,
    };
  }
  return result;
}

/** 获取默认周范围（latest_date 所在周的周一到周日） */
async function empGetDefaultWeekRange(): Promise<{ latest_date: string; default_week_start: string; default_week_end: string }> {
  const rows = await querySql<Row>(`SELECT MAX("线索日期") as v FROM fact_conv_content`);
  const latest = rows[0]?.v ? String(rows[0].v).slice(0, 10) : '';
  if (!latest) {
    const today = new Date().toISOString().slice(0, 10);
    const td = new Date(today + 'T00:00:00Z');
    const jsDay = td.getUTCDay();
    const wd = jsDay === 0 ? 6 : jsDay - 1;
    const start = new Date(td);
    start.setUTCDate(td.getUTCDate() - wd);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      latest_date: '',
      default_week_start: start.toISOString().slice(0, 10),
      default_week_end: end.toISOString().slice(0, 10),
    };
  }
  const d = new Date(latest + 'T00:00:00Z');
  const jsDay = d.getUTCDay();
  const wd = jsDay === 0 ? 6 : jsDay - 1;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - wd);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    latest_date: latest,
    default_week_start: start.toISOString().slice(0, 10),
    default_week_end: end.toISOString().slice(0, 10),
  };
}

async function handleEmployeeConversionAnalysis(body: any): Promise<any> {
  const platforms = body?.platforms || EMP_CONTENT_PLATFORMS;
  const sd = body?.start_date;
  const ed = body?.end_date;
  const employees = body?.employees || [];
  const lead_type = body?.lead_type || 'all';

  const qualified = await empGetQualifiedEmployees(5);
  const filter_emps = employees.length > 0 ? employees : qualified;

  const ranking = await empGetRanking(platforms, sd, ed, lead_type, filter_emps);
  const overview = await empGetPlatformOverview(platforms, sd, ed, filter_emps);
  const trend = await empGetWeeklyTrend(platforms, sd, ed, filter_emps);
  const rate_trend = trend; // 后端用同一个函数

  const total_leads = ranking.reduce((s, r) => s + r.total_leads, 0);
  const total_opened = ranking.reduce((s, r) => s + r.opened_count, 0);
  const total_valid = ranking.reduce((s, r) => s + r.valid_customer_count, 0);
  const total_mouth = ranking.reduce((s, r) => s + r.mouth_count, 0);
  const total_assets = ranking.reduce((s, r) => s + r.total_assets, 0);

  const core = {
    total_leads,
    total_mouth,
    total_valid_lead: ranking.reduce((s, r) => s + r.valid_lead_count, 0),
    total_opened,
    total_valid_customer: total_valid,
    avg_opening_rate: total_leads > 0 ? round2(total_opened * 100 / total_leads) : 0,
    total_assets: round2(total_assets),
  };

  return {
    core_metrics: core,
    platform_overview: Object.entries(overview).map(([p, v]) => ({ platform: p, ...v })),
    conversion_trend: { weeks: trend },
    employee_rate_trend: { periods: rate_trend },
    ranking,
  };
}

async function handleEmployeeConversionWeekly(body: any): Promise<any> {
  const platforms = body?.platforms || EMP_CONTENT_PLATFORMS;
  const sd = body?.start_date;
  const ed = body?.end_date;

  const rankings: Record<string, any> = {};
  const year_breakdown: Record<string, any> = {};
  for (const p of platforms) {
    rankings[p] = {
      total: await empGetRanking([p], undefined, ed, 'all', EMP_WEEKLY_ASSISTANTS),
      existing: await empGetRanking([p], sd, ed, 'existing', EMP_WEEKLY_ASSISTANTS),
      new: await empGetRanking([p], sd, ed, 'new', EMP_WEEKLY_ASSISTANTS),
      existing_new_open: await empGetRanking([p], sd, ed, 'existing_new_open', EMP_WEEKLY_ASSISTANTS),
    };
    year_breakdown[p] = await empGetYearlyBreakdown([p], ed, EMP_WEEKLY_ASSISTANTS);
  }

  const overview = await empGetPlatformOverview(platforms, sd, ed, EMP_WEEKLY_ASSISTANTS);
  const trend = await empGetWeeklyTrend(platforms, sd, ed, EMP_WEEKLY_ASSISTANTS);

  return {
    roster_count: EMP_WEEKLY_ASSISTANTS.length,
    rankings,
    year_breakdown,
    overview,
    trend,
  };
}

async function handleEmployeeConversionAnalysisChannelOverview(body: any): Promise<any> {
  const sd = body?.start_date;
  const ed = body?.end_date;
  const employees = body?.employees || [];
  let platforms_param = body?.platforms || EMP_CONTENT_PLATFORMS;
  if (typeof platforms_param === 'string') {
    platforms_param = (platforms_param as string).split(',').map(s => s.trim()).filter(Boolean);
  }
  const lead_type = body?.lead_type || 'all';

  // 员工明细口径（fact_conv_content）
  const qualified = await empGetQualifiedEmployees(5);
  const filter_emps = employees.length > 0 ? employees : qualified;
  const detailWhere = buildWhere([
    { sql: '"添加员工姓名" IS NOT NULL AND "添加员工姓名" != \'\'', params: [] as unknown[] },
    dateClause('线索日期', sd, ed),
    inClause('添加员工姓名', filter_emps),
    inClause('平台来源', platforms_param),
    lead_type === 'existing'
      ? { sql: '"是否为存量客户" = 1', params: [] as unknown[] }
      : lead_type === 'new'
        ? { sql: '("是否为存量客户" = 0 OR "是否为存量客户" IS NULL)', params: [] as unknown[] }
        : null,
  ]);
  const detailSql = `SELECT
    COUNT(id) as leads,
    COALESCE(SUM("是否客户开口"), 0) as mouth,
    COALESCE(SUM("是否有效线索"), 0) as valid_lead,
    COALESCE(SUM("是否开户"), 0) as opened,
    COALESCE(SUM("是否为有效户"), 0) as valid,
    COALESCE(SUM("资产"), 0) as assets
  FROM fact_conv_content ${detailWhere.clause}`;
  const detailRows = await querySql<Row>(detailSql, detailWhere.params);
  const dr = detailRows[0] || {};

  // 渠道参考口径（agg_daily_channel_open，仅互联网引流）
  const chanWhere = buildWhere([
    { sql: '"渠道类别" = ?', params: ['互联网引流'] },
    dateClause('时间区间', sd, ed),
  ]);
  const chanSql = `SELECT
    COALESCE(SUM("开户成功人数"), 0) as opens,
    COALESCE(SUM("入金户数"), 0) as deposit,
    COALESCE(SUM("有效户数"), 0) as valid
  FROM agg_daily_channel_open ${chanWhere.clause}`;
  const chanRows = await querySql<Row>(chanSql, chanWhere.params);
  const cr = chanRows[0] || {};

  return {
    detail_caliber: {
      source: 'fact_conv_content',
      scope: '内容平台·员工级（添加员工姓名 非空）',
      leads: toInt(dr.leads),
      mouth: toInt(dr.mouth),
      valid_lead: toInt(dr.valid_lead),
      opened: toInt(dr.opened),
      valid: toInt(dr.valid),
      assets: round2(toFloat(dr.assets)),
    },
    channel_caliber: {
      source: 'agg_daily_channel_open',
      scope: '互联网引流·渠道级（仅互联网引流）',
      opens: toInt(cr.opens),
      deposit: toInt(cr.deposit),
      valid: toInt(cr.valid),
    },
    note: '核心指标只统计内容平台中已填写员工姓名的线索；互联网引流数据来自独立渠道汇总表，仅作外部参考，不纳入员工核心指标。',
  };
}

async function handleEmployeeConversionFilterOptions(): Promise<any> {
  const default_range = await empGetDefaultWeekRange();
  const employees = await empGetQualifiedEmployees(5);
  return {
    platforms: EMP_CONTENT_PLATFORMS,
    content_platform_label: '内容平台（抖音 / 小红书 / 腾讯 / 快手 / 财联社），员工承接营销转化的核心口径',
    default_platforms: EMP_CONTENT_PLATFORMS,
    employees: employees.sort(),
    lead_types: [
      { value: 'all', label: '全部线索' },
      { value: 'existing', label: '存量线索' },
      { value: 'new', label: '新增线索' },
    ],
    ...default_range,
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

// ============================================================================
// 周报（reports/weekly/*）— 移植自 backend/routes/weekly_reports.py
// ============================================================================

// 应用市场渠道名称集合（与后端 APP_MARKET_CHANNELS 一致）
const WEEKLY_APP_MARKET_CHANNELS = ['华为', '荣耀', '小米', 'oppo', 'vivo', '苹果', '鸿蒙'];

// 渠道名称 → 渠道类别映射（与后端 weekly_reports.py 一致）
const WEEKLY_CHANNEL_CATEGORY_MAP: Record<string, string> = {
  小红书: '内容平台', 腾讯: '内容平台', 抖音: '内容平台',
  快手: '内容平台', 财联社: '内容平台', yj: '内容平台',
  云极: '内容平台', 其他: '内容平台',
  华为: '应用市场', 荣耀: '应用市场', 小米: '应用市场',
  oppo: '应用市场', vivo: '应用市场', 苹果: '应用市场', 鸿蒙: '应用市场',
  高德: '本地生活',
};

const KPI_TARGETS = { opens: 20000, valid: 10000, assets: 5_0000_0000 };

/** 根据周五日期计算周信息（移植自 weekly_utils.get_week_info） */
function getWeekInfo(friday: Date): {
  report_year: number; report_month: number; report_week: number;
  report_month_week: number; start_date: string; end_date: string;
  report_name: string; date_range: string; report_sequence: number;
} {
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);

  const year = friday.getFullYear();
  const month = friday.getMonth() + 1;

  // 计算该年第一个周五
  const jan1 = new Date(year, 0, 1);
  const wJan1 = jan1.getDay(); // 0=Sun, 5=Fri
  const weekdayMonToFri = wJan1 === 0 ? 6 : wJan1 - 1; // 0=Mon..6=Sun
  const daysToFirstFriday = weekdayMonToFri <= 4 ? (4 - weekdayMonToFri) : (4 + (7 - weekdayMonToFri));
  const firstFriday = new Date(jan1);
  firstFriday.setDate(jan1.getDate() + daysToFirstFriday);

  const daysDiff = Math.round((friday.getTime() - firstFriday.getTime()) / 86400000);
  const report_week = Math.floor(daysDiff / 7) + 1;

  // 月内第几周
  const month1 = new Date(year, month - 1, 1);
  const wMonth1 = month1.getDay();
  const wdMonToFri2 = wMonth1 === 0 ? 6 : wMonth1 - 1;
  const daysToFirstFridayMonth = wdMonToFri2 <= 4 ? (4 - wdMonToFri2) : (4 + (7 - wdMonToFri2));
  const firstFridayMonth = new Date(month1);
  firstFridayMonth.setDate(month1.getDate() + daysToFirstFridayMonth);

  const daysDiffMonth = Math.round((friday.getTime() - firstFridayMonth.getTime()) / 86400000);
  const report_month_week = Math.floor(daysDiffMonth / 7) + 1;

  const pad = (n: number) => String(n).padStart(2, '0');
  const start_date = `${friday.getFullYear()}-${pad(friday.getMonth() + 1)}-${pad(friday.getDate())}`;
  const end_date = `${thursday.getFullYear()}-${pad(thursday.getMonth() + 1)}-${pad(thursday.getDate())}`;
  const date_range = `${pad(friday.getMonth() + 1)}/${pad(friday.getDate())}-${pad(thursday.getMonth() + 1)}/${pad(thursday.getDate())}`;
  const report_name = `${year}年${pad(month)}月第${report_month_week}周(${date_range})`;

  return {
    report_year: year, report_month: month, report_week,
    report_month_week, start_date, end_date, report_name, date_range,
    report_sequence: report_week,
  };
}

/** 获取指定年份所有周五日期（移植自 weekly_utils.get_all_fridays_in_year） */
function getAllFridaysInYear(year: number): Date[] {
  const fridays: Date[] = [];
  const jan1 = new Date(year, 0, 1);
  const wJan1 = jan1.getDay();
  const weekdayMonToFri = wJan1 === 0 ? 6 : wJan1 - 1;
  const daysToFirstFriday = weekdayMonToFri <= 4 ? (4 - weekdayMonToFri) : (4 + (7 - weekdayMonToFri));
  const current = new Date(jan1);
  current.setDate(jan1.getDate() + daysToFirstFriday);

  while (current.getFullYear() === year) {
    fridays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return fridays;
}

/** 生成最近 N 周选项（移植自 weekly_utils.generate_week_options） */
function generateWeekOptions(weeksCount = 12): any[] {
  const options: any[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  const allFridays = [...getAllFridaysInYear(currentYear - 1), ...getAllFridaysInYear(currentYear)];

  let currentIndex = -1;
  for (let i = 0; i < allFridays.length; i++) {
    const thursday = new Date(allFridays[i]);
    thursday.setDate(allFridays[i].getDate() + 6);
    if (allFridays[i] <= today && today <= thursday) {
      currentIndex = i;
      break;
    }
  }
  if (currentIndex === -1) {
    for (let i = allFridays.length - 1; i >= 0; i--) {
      if (allFridays[i] < today) {
        currentIndex = i;
        break;
      }
    }
  }
  if (currentIndex === -1) currentIndex = allFridays.length - 1;

  const startIndex = Math.max(0, currentIndex - weeksCount + 1);
  const endIndex = currentIndex + 1;

  for (let i = startIndex; i < endIndex; i++) {
    if (i >= allFridays.length) break;
    const friday = allFridays[i];
    const wi = getWeekInfo(friday);
    const thursday = new Date(friday);
    thursday.setDate(friday.getDate() + 6);
    const isWeekEnded = today > thursday;

    options.push({
      value: `${wi.report_year}-${String(wi.report_week).padStart(2, '0')}`,
      label: wi.report_name,
      sequence: wi.report_sequence,
      disabled: !isWeekEnded,
      disabled_reason: isWeekEnded ? undefined : '本周报告（未结束，不可选）',
      ...wi,
    });
  }

  options.reverse();
  return options;
}

/** 查询某时间区间的核心指标（移植自 weekly_reports._query_metrics） */
async function queryWeeklyMetrics(sd: string, ed: string): Promise<any> {
  // 1. agg_vendor_daily: cost / impressions / leads_app / assets
  const adSql = `SELECT
      COALESCE(SUM("花费"), 0) as cost,
      COALESCE(SUM("展示量"), 0) as impressions,
      COALESCE(SUM("APP激活人数"), 0) as leads_app,
      COALESCE(SUM("客户资产"), 0) as assets
    FROM agg_vendor_daily WHERE "日期" >= ? AND "日期" <= ?`;
  const adRows = await querySql<Row>(adSql, [sd, ed]);
  const ad = adRows[0] || {};

  // 2. fact_conv_content COUNT(*): leads_wx
  const wxSql = `SELECT COUNT(*) as c FROM fact_conv_content
    WHERE "线索日期" >= ? AND "线索日期" <= ?`;
  const wxRows = await querySql<Row>(wxSql, [sd, ed]);
  const leads_wx = toInt(wxRows[0]?.c);

  // 3. agg_daily_channel_open WHERE 渠道类别='互联网引流': opens, valid
  const chSql = `SELECT
      COALESCE(SUM("开户成功人数"), 0) as opens,
      COALESCE(SUM("有效户数"), 0) as valid
    FROM agg_daily_channel_open
    WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?`;
  const chRows = await querySql<Row>(chSql, [sd, ed]);
  const opens_total = toInt(chRows[0]?.opens);
  const valid = toInt(chRows[0]?.valid);

  // 4. 应用市场开户数（互联网引流里渠道名称属于应用市场大类的部分）
  const placeholders = WEEKLY_APP_MARKET_CHANNELS.map(() => '?').join(', ');
  const appSql = `SELECT COALESCE(SUM("开户成功人数"), 0) as v
    FROM agg_daily_channel_open
    WHERE "渠道类别" = '互联网引流'
      AND "渠道名称" IN (${placeholders})
      AND "时间区间" >= ? AND "时间区间" <= ?`;
  const appRows = await querySql<Row>(appSql, [...WEEKLY_APP_MARKET_CHANNELS, sd, ed]);
  const opens_app = toInt(appRows[0]?.v);

  return {
    cost: toFloat(ad.cost),
    impressions: toInt(ad.impressions),
    leads_wx,
    leads_app: toInt(ad.leads_app),
    opens_app,
    opens_other: opens_total - opens_app,
    opens: opens_total,
    valid,
    assets: toFloat(ad.assets),
  };
}

/** 计算环比百分比 */
function calcWow(curr: number, prev: number): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 10000) / 100;
}

/** 安全除法 */
function safeDiv(num: number, den: number, pct = false): number {
  if (!den) return 0;
  const r = num / den;
  return pct ? Math.round(r * 10000) / 100 : Math.round(r * 10000) / 10000;
}

/** GET /reports/weekly/periods — 生成最近 12 周选项 */
async function handleWeeklyPeriods(): Promise<any[]> {
  return generateWeekOptions(12);
}

/** POST /reports/weekly/data — 纯数据周报 */
async function handleWeeklyData(body: any): Promise<any> {
  const report_year = toInt(body?.report_year);
  const report_week = toInt(body?.report_week);
  const start_date = body?.start_date;
  const end_date = body?.end_date;

  let sd: string, ed: string, reportName: string, reportSequence: number;

  if (report_year && report_week) {
    const fridays = getAllFridaysInYear(report_year);
    if (report_week - 1 >= fridays.length) {
      throw new Error(`无效的周次: ${report_year}年第${report_week}周`);
    }
    const friday = fridays[report_week - 1];
    const wi = getWeekInfo(friday);
    sd = wi.start_date;
    ed = wi.end_date;
    reportName = wi.report_name;
    reportSequence = wi.report_sequence;
  } else if (start_date && end_date) {
    sd = start_date;
    ed = end_date;
    reportName = `${sd.slice(0, 4)}年${sd.slice(5, 7)}月第${report_week || 1}周`;
    reportSequence = report_week || 1;
  } else {
    throw new Error('需要 report_year+report_week 或 start_date+end_date');
  }

  const sdDt = new Date(sd);
  const edDt = new Date(ed);
  const prevSd = new Date(sdDt);
  prevSd.setDate(prevSd.getDate() - 7);
  const prevEd = new Date(edDt);
  prevEd.setDate(prevEd.getDate() - 7);
  const prev_sd = `${prevSd.getFullYear()}-${String(prevSd.getMonth() + 1).padStart(2, '0')}-${String(prevSd.getDate()).padStart(2, '0')}`;
  const prev_ed = `${prevEd.getFullYear()}-${String(prevEd.getMonth() + 1).padStart(2, '0')}-${String(prevEd.getDate()).padStart(2, '0')}`;

  const year_start = `${report_year || sdDt.getFullYear()}-01-01`;

  const [current_week, year_to_date, prev_week] = await Promise.all([
    queryWeeklyMetrics(sd, ed),
    queryWeeklyMetrics(year_start, ed),
    queryWeeklyMetrics(prev_sd, prev_ed),
  ]);

  const wowKeys = ['cost', 'impressions', 'leads_wx', 'leads_app', 'opens_app', 'opens_other', 'opens', 'valid', 'assets'];
  const week_over_week: Record<string, number | null> = {};
  for (const k of wowKeys) {
    week_over_week[k] = calcWow(current_week[k], prev_week[k]);
  }

  // 本周按日堆叠
  const dailyRows = await querySql<Row>(
    `SELECT "时间区间" as date, "渠道名称" as channel, COALESCE(SUM("开户成功人数"), 0) as val
     FROM agg_daily_channel_open
     WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?
     GROUP BY "时间区间", "渠道名称"`,
    [sd, ed]
  );
  const dailyDates = [...new Set(dailyRows.map(r => r.date))].sort();
  const dailyMap: Record<string, any> = {};
  for (const r of dailyRows) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date };
    dailyMap[r.date][r.channel || '未分类'] = toInt(r.val);
  }
  const daily_opens_stacked = dailyDates.map(d => dailyMap[d] || { date: d });

  // 全年按周次堆叠
  const yearlyRows = await querySql<Row>(
    `SELECT "时间区间" as date, "渠道名称" as channel, COALESCE(SUM("开户成功人数"), 0) as val
     FROM agg_daily_channel_open
     WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?
     GROUP BY "时间区间", "渠道名称"`,
    [year_start, ed]
  );

  // 构建周列表
  const fridays = getAllFridaysInYear(sdDt.getFullYear());
  const weekList: { week: string; sd: string; ed: string }[] = [];
  for (let i = 0; i < fridays.length; i++) {
    const wi = getWeekInfo(fridays[i]);
    if (wi.start_date > ed) continue;
    const wed = wi.end_date > ed ? ed : wi.end_date;
    weekList.push({ week: `W${String(i + 1).padStart(2, '0')}`, sd: wi.start_date, ed: wed });
  }
  const findWeek = (d: string): string | null => {
    for (const w of weekList) {
      if (w.sd <= d && d <= w.ed) return w.week;
    }
    return null;
  };

  const channelSet: Record<string, number> = {};
  for (const r of yearlyRows) {
    const ch = r.channel || '未分类';
    channelSet[ch] = (channelSet[ch] || 0) + toInt(r.val);
  }

  const CATEGORY_ORDER_MAP: Record<string, number> = { 内容平台: 0, 应用市场: 1, 本地生活: 2 };
  const channels = Object.keys(channelSet).sort((a, b) => {
    const ca = CATEGORY_ORDER_MAP[WEEKLY_CHANNEL_CATEGORY_MAP[a] || '内容平台'] ?? 99;
    const cb = CATEGORY_ORDER_MAP[WEEKLY_CHANNEL_CATEGORY_MAP[b] || '内容平台'] ?? 99;
    if (ca !== cb) return ca - cb;
    return channelSet[b] - channelSet[a];
  });

  // 透视到周
  const weeklyMap: Record<string, any> = {};
  for (const r of yearlyRows) {
    const wk = findWeek(r.date);
    if (!wk) continue;
    if (!weeklyMap[wk]) weeklyMap[wk] = { week: wk };
    const ch = r.channel || '未分类';
    weeklyMap[wk][ch] = (weeklyMap[wk][ch] || 0) + toInt(r.val);
  }
  const weekly_opens_stacked = weekList.map(w => weeklyMap[w.week] || { week: w.week });

  // 互联网渠道占公司开户占比
  const weekAllOpensRows = await querySql<Row>(
    `SELECT COALESCE(SUM("开户成功人数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [sd, ed]
  );
  const weekAllValidRows = await querySql<Row>(
    `SELECT COALESCE(SUM("有效户数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [sd, ed]
  );
  const yearAllOpensRows = await querySql<Row>(
    `SELECT COALESCE(SUM("开户成功人数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [year_start, ed]
  );
  const yearAllValidRows = await querySql<Row>(
    `SELECT COALESCE(SUM("有效户数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [year_start, ed]
  );

  const week_all_opens = toInt(weekAllOpensRows[0]?.v);
  const week_all_valid = toInt(weekAllValidRows[0]?.v);
  const year_all_opens = toInt(yearAllOpensRows[0]?.v);
  const year_all_valid = toInt(yearAllValidRows[0]?.v);

  const internet_ratio = {
    opens_ratio: week_all_opens ? safeDiv(current_week.opens, week_all_opens, true) : 0,
    valid_ratio: week_all_valid ? safeDiv(current_week.valid, week_all_valid, true) : 0,
    year_opens_ratio: year_all_opens ? safeDiv(year_to_date.opens, year_all_opens, true) : 0,
    year_valid_ratio: year_all_valid ? safeDiv(year_to_date.valid, year_all_valid, true) : 0,
  };

  // KPI
  const yearTotalDays = (new Date(sdDt.getFullYear(), 11, 31).getTime() - new Date(sdDt.getFullYear(), 0, 1).getTime()) / 86400000 + 1;
  const passedDays = (edDt.getTime() - new Date(sdDt.getFullYear(), 0, 1).getTime()) / 86400000 + 1;
  const time_progress = passedDays / yearTotalDays;

  const kpiRate = (key: 'opens' | 'valid' | 'assets') => {
    const target = KPI_TARGETS[key];
    const actual = year_to_date[key];
    const expected = target * time_progress;
    return expected ? safeDiv(actual, expected, true) : 0;
  };

  const kpi = {
    time_progress: Math.round(time_progress * 10000) / 100,
    opens: { target: KPI_TARGETS.opens, actual: year_to_date.opens, rate: kpiRate('opens') },
    valid: { target: KPI_TARGETS.valid, actual: year_to_date.valid, rate: kpiRate('valid') },
    assets: { target: KPI_TARGETS.assets, actual: year_to_date.assets, rate: kpiRate('assets') },
  };

  return {
    period: {
      start_date: sd, end_date: ed, prev_start: prev_sd, prev_end: prev_ed,
      report_year: report_year || sdDt.getFullYear(),
      report_week: report_week || 1,
      report_name: reportName,
      report_sequence: reportSequence,
    },
    current_week,
    year_to_date,
    prev_week,
    week_over_week,
    daily_opens_stacked,
    weekly_opens_stacked,
    channels,
    internet_ratio,
    kpi,
  };
}

// ============================================================================
// 元数据 (metadata) — 全局筛选项数据源
// ============================================================================
// 对齐后端 backend/routes/metadata.py 的 /metadata 路由
// 供 AgencyFilter / PlatformFilter / BusinessModelFilter 三个筛选器使用
// 移动端无 dim_account 表，代理商直接用 agg_vendor_daily.厂商 全称（无简称归一化）

async function handleMetadata(): Promise<any> {
  // 平台列表（与后端兜底一致：失败时返回 ['腾讯', '抖音', '小红书']）
  let platforms: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "平台" as v FROM agg_vendor_daily
       WHERE "平台" IS NOT NULL AND "平台" != ''
       ORDER BY "平台"`
    );
    platforms = rows.map(r => String(r.v));
  } catch {
    platforms = ['腾讯', '抖音', '小红书'];
  }

  // 代理商（移动端无 dim_account，直接用 厂商 全称，简称=全称）
  let agency_names: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "厂商" as v FROM agg_vendor_daily
       WHERE "厂商" IS NOT NULL AND "厂商" != ''
       ORDER BY "厂商"`
    );
    agency_names = rows.map(r => String(r.v));
  } catch {
    agency_names = [];
  }
  const agencies = agency_names.map(a => ({ value: a, label: a, full_names: [a] }));
  const agency_full_map: Record<string, string[]> = {};
  for (const a of agency_names) agency_full_map[a] = [a];

  // 业务模式
  let business_models: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "业务模式" as v FROM agg_vendor_daily
       WHERE "业务模式" IS NOT NULL AND "业务模式" != ''
       ORDER BY "业务模式"`
    );
    business_models = rows.map(r => String(r.v));
  } catch {
    business_models = [];
  }

  // 日期范围（agg_vendor_daily.日期）
  const date_range: { start: string | null; end: string | null } = { start: null, end: null };
  try {
    const rows = await querySql<Row>(
      `SELECT MIN("日期") as min, MAX("日期") as max FROM agg_vendor_daily`
    );
    const r = rows[0];
    if (r?.min) date_range.start = String(r.min).slice(0, 10);
    if (r?.max) date_range.end = String(r.max).slice(0, 10);
  } catch {
    // 保持 null
  }

  // 小红书笔记日期范围（agg_xhs_note.发布时间，截取前 10 位 YYYY-MM-DD）
  const xhs_notes_date_range: { start: string | null; end: string | null } = { start: null, end: null };
  try {
    const rows = await querySql<Row>(
      `SELECT MIN("发布时间") as min, MAX("发布时间") as max FROM agg_xhs_note`
    );
    const r = rows[0];
    if (r?.min) xhs_notes_date_range.start = String(r.min).slice(0, 10);
    if (r?.max) xhs_notes_date_range.end = String(r.max).slice(0, 10);
  } catch {
    // 保持 null
  }

  return {
    platforms,
    agencies,
    agency_full_map,
    business_models,
    date_range,
    xhs_notes_date_range,
    accounts: [],  // 移动端不提供账号映射列表（features 已禁用相关页面）
  };
}

/**
 * 移动端路由处理器入口
 *
 * 将前端 API 请求 URL + body 映射到本地 SQLite 查询，返回与 Flask 后端一致的 data 结构。
 */
export async function mobileRouteHandler(url: string, body: any): Promise<any> {
  const path = extractApiPath(url);

  switch (path) {
    // 元数据（全局筛选项数据源，供 FilterBar 使用）
    case 'metadata':
      return handleMetadata();

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

    // 转化漏斗（POST 走 split；GET 兼容旧版）
    case 'conversion-funnel/split':
      return handleConversionFunnelSplit(url, body);

    // 线索明细（GET 请求，参数在 URL query）
    case 'leads-detail':
      return handleLeadsDetail(url);
    case 'leads-detail/filter-options':
      return handleLeadsDetailFilterOptions();

    // 主播聚类（直播获客：直播漏斗 / 直播带货 / 投顾IP / 分析师 / 主播分析 共用）
    case 'leads-detail/anchor-clusters':
      return handleAnchorClusters(body);
    case 'leads-detail/anchor-clusters-trend':
      return handleAnchorClustersTrend(body);
    case 'leads-detail/anchor-weekly-analysis':
      return handleAnchorWeeklyAnalysis(body);

    // 投放评审（GET 请求，参数在 URL query）
    case 'investment-review':
      return handleInvestmentReview(url, body);

    // 应用市场计划分析 + 创意 + 消耗成本
    case 'reports/app-market/plan-analysis':
      return handleAppMarketPlanAnalysis(body);
    case 'reports/app-market/creative':
      return handleAppMarketCreative(body);
    case 'reports/app-market/cost-analysis':
      return handleAppMarketCostAnalysis(body);

    // 小红书
    case 'xhs-notes-list':
    case 'xhs-notes/list':
      return handleXhsNotesList(url, body);
    case 'xhs-notes/filter-options':
      return handleXhsNotesFilterOptions();
    case 'xhs-notes-operation-analysis':
      return handleXhsNotesOperationAnalysis(body);
    case 'reports/xhs/plan-analysis':
      return handleXhsPlanAnalysis(body);

    // 员工转化
    case 'employee-conversion/analysis':
      return handleEmployeeConversionAnalysis(body);
    case 'employee-conversion/weekly':
      return handleEmployeeConversionWeekly(body);
    case 'employee-conversion/analysis-channel-overview':
      return handleEmployeeConversionAnalysisChannelOverview(body);
    case 'employee-conversion/filter-options':
      return handleEmployeeConversionFilterOptions();

    // v3.5.5：周报（报告生成页面）
    case 'reports/weekly/periods':
      return handleWeeklyPeriods();
    case 'reports/weekly/data':
      return handleWeeklyData(body);

    // v3.6.4：版本信息（关于页），由 vite define 在构建时注入，无需数据库查询
    case 'version/local':
      return APP_VERSION_INFO;

    default:
      throw new Error(`Mobile API not implemented: ${path}`);
  }
}
