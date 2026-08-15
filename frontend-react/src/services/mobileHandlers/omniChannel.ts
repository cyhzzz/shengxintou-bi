/**
 * 移动端本地路由处理器 —— 全渠道获客 (reports/omni-channel/*)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, round2, dateClause, inClause, buildWhere, getFilters, getDateRange, type Row } from './shared';
// ============================================================================
// 全渠道获客 (omni-channel)
// ============================================================================

const CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流'];

export async function handleOmniChannelSummary(body: any): Promise<any> {
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

export async function handleOmniChannelFilterOptions(): Promise<any> {
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

export async function handleOmniChannelDailyCalendar(body: any): Promise<any> {
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

export async function handleOmniChannelDailyTrend(body: any): Promise<any> {
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

export async function handleOmniChannelByChannel(body: any): Promise<any> {
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
