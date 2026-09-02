/**
 * 移动端本地路由处理器 —— 应用市场 (app-market 漏斗/汇总/明细/成本/归因/计划/素材)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, round4, dateClause, inClause, buildWhere, getFilters, getDateRange, type Row } from './shared';
// ============================================================================
// 应用市场 (app-market)
// ============================================================================

const FUNNEL_STAGES: [string, string][] = [
  ['是否激活APP', '激活APP'],
  ['是否开户注册', '开户注册'],
  ['是否注册身份证', '注册身份证'],
  ['是否注册银行卡', '注册银行卡'],
  ['是否提交开户', '提交开户'],
  ['是否创建完资金账号', '开户成功'],
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
    // 开户漏斗按「下载日期」做下载 cohort（与后端 app_market_funnel / conversionFunnel 一致）；
    // 开户数据报（如月度/各市场获客量）按「资金账号创建完成时间」在别处处理。
    dateClause('下载日期', sd, ed),
    inClause('应用市场', filters.app_markets),
  ]);
}

export async function handleAppMarketFunnel(body: any): Promise<any> {
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

export async function handleAppMarketFilterOptions(): Promise<any> {
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

export async function handleAppMarketCostAnalysis(body: any): Promise<any> {
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
// 应用市场 · 归因转化率 (app-market/attribution-conversion)
// 数据源: fact_conv_appmarket（1 行=1 APP 下载），按周(周一~周日)聚合各步骤转化率
// 与后端 backend/routes/reports/app_market_attribution.py 逻辑一致
// ============================================================================

function _attributionWeekEnd(weekStart: string): string {
  // weekStart 是周一（YYYY-MM-DD），+6 天为周日
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _rate4(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

export async function handleAppMarketAttributionConversion(body: any): Promise<any> {
  const filters = body?.filters || {};
  const platforms = filters.platforms || [];
  const { start_date: sd, end_date: ed } = getDateRange(filters);

  // 平台列表（与后端 available_platforms 一致：表中实际存在的去重值）
  const platformSql = `SELECT DISTINCT "应用市场" AS p FROM fact_conv_appmarket WHERE "应用市场" IS NOT NULL AND "应用市场" != '' ORDER BY "应用市场"`;
  const platformRows = await querySql<Row>(platformSql);
  const available_platforms = platformRows.map((r) => String(r.p)).sort((a, b) => a.localeCompare(b, 'zh'));

  const conditions: ({ sql: string; params: unknown[] } | null)[] = [];
  if (platforms.length > 0) {
    conditions.push(inClause('应用市场', platforms));
  }
  conditions.push(dateClause('资金账号创建完成时间', sd, ed));
  const whereClause = buildWhere(conditions.filter(Boolean) as { sql: string; params: unknown[] }[]);

  // 日聚合（SQL 层按资金账号创建完成时间分组求和）
  const dailySql = `SELECT "资金账号创建完成时间" AS d,
    COALESCE(SUM("是否激活APP"), 0) AS activate,
    COALESCE(SUM("是否开户注册"), 0) AS register,
    COALESCE(SUM("是否注册身份证"), 0) AS id_card,
    COALESCE(SUM("是否注册银行卡"), 0) AS bank_card,
    COALESCE(SUM("是否提交开户"), 0) AS submit,
    COALESCE(SUM("是否创建完资金账号"), 0) AS success
    FROM fact_conv_appmarket ${whereClause.clause}
    GROUP BY "资金账号创建完成时间" ORDER BY "资金账号创建完成时间"`;
  const dailyRows = await querySql<Row>(dailySql, whereClause.params);

  const WEEKDAY_MAP = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const daily_data: any[] = [];
  const weekMap: Record<string, any> = {};

  for (const r of dailyRows) {
    const dateStr = String(r.d).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const dObj = new Date(dateStr + 'T00:00:00');
    const weekday = WEEKDAY_MAP[dObj.getDay()];
    const ws = _weekStart(dateStr);
    const rec: any = {
      date: dateStr,
      weekday,
      week_start: ws,
      activate: toInt(r.activate),
      register: toInt(r.register),
      id_card: toInt(r.id_card),
      bank_card: toInt(r.bank_card),
      submit: toInt(r.submit),
      success: toInt(r.success),
    };
    rec['rate_activate_register'] = _rate4(rec.register, rec.activate);
    rec['rate_register_idcard'] = _rate4(rec.id_card, rec.register);
    rec['rate_idcard_bankcard'] = _rate4(rec.bank_card, rec.id_card);
    rec['rate_bankcard_submit'] = _rate4(rec.submit, rec.bank_card);
    rec['rate_submit_success'] = _rate4(rec.success, rec.submit);
    daily_data.push(rec);

    const wk = weekMap[ws] || { activate: 0, register: 0, id_card: 0, bank_card: 0, submit: 0, success: 0 };
    wk.activate += rec.activate;
    wk.register += rec.register;
    wk.id_card += rec.id_card;
    wk.bank_card += rec.bank_card;
    wk.submit += rec.submit;
    wk.success += rec.success;
    weekMap[ws] = wk;
  }

  const weekly_data = Object.entries(weekMap)
    .map(([ws, w]: [string, any]) => {
      const rec: any = {
        week_start: ws,
        week_end: _attributionWeekEnd(ws),
        activate: w.activate,
        register: w.register,
        id_card: w.id_card,
        bank_card: w.bank_card,
        submit: w.submit,
        success: w.success,
      };
      rec['rate_activate_register'] = _rate4(rec.register, rec.activate);
      rec['rate_register_idcard'] = _rate4(rec.id_card, rec.register);
      rec['rate_idcard_bankcard'] = _rate4(rec.bank_card, rec.id_card);
      rec['rate_bankcard_submit'] = _rate4(rec.submit, rec.bank_card);
      rec['rate_submit_success'] = _rate4(rec.success, rec.submit);
      return rec;
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  // 注意：与其他 handler 一致，这里返回纯数据对象（http.ts 移动端路径会包装为 { success, data }）。
  // 若带 success/data/meta 包装，页面 res.data 会多包一层，取不到 daily_data/weekly_data → 「暂无周度数据」。
  return {
    daily_data,
    weekly_data,
    platforms: available_platforms,
    selected_platforms: platforms,
  };
}

// ============================================================================
// 应用市场总览 (app-market/summary)
// ============================================================================

/** 应用市场漏斗过滤（强制渠道类型=互联网引流）+ 通用过滤 */
function appMarketWhere(filters: any, includeChannelTypeFilter = true): { clause: string; params: unknown[] } {
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const conditions: ({ sql: string; params: unknown[] } | null)[] = [
    dateClause('资金账号创建完成时间', sd, ed),
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

export async function handleAppMarketSummary(body: any): Promise<any> {
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
    const monthSql = `SELECT substr("资金账号创建完成时间", 1, 7) as month, "应用市场" as app_market, ${FUNNEL_SUMS}
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
export async function handleAppMarketDetail(body: any): Promise<any> {
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
    '开户成功': !!r['是否创建完资金账号'],
    '新开户': !!r['是否新开户'],
    '入金': !!r['是否入金'],
    '有效户': !!r['是否有效户'],
    '总资产': r['总资产'] != null ? toFloat(r['总资产']) : null,
    '累计创收': r['累计创收'] != null ? toFloat(r['累计创收']) : null,
  }));

  return { detail, page, page_size, total };
}
// ============================================================================
// 应用市场计划分析 (reports/app-market/plan-analysis)
// ============================================================================

export async function handleAppMarketPlanAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const app_market = filters.app_market || filters.app_markets?.[0];
  const top_n = Math.max(1, toInt(body?.top_n) || 30);

  // 强制 渠道类型='互联网引流'
  const where = buildWhere([
    dateClause('资金账号创建完成时间', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
    app_market ? { sql: '"应用市场" = ?', params: [app_market] } : null,
  ]);

  // 5 阶段漏斗
  const funnelCols: [string, string][] = [
    ['是否激活APP', '激活APP'],
    ['是否创建完资金账号', '开户成功'],
    ['是否新开户', '新开户'],
    ['是否入金', '入金'],
    ['是否有效户', '有效户'],
  ];
  const selectCols = funnelCols.map(([c, a]) => `COALESCE(SUM("${c}"), 0) as "${a}"`).join(', ');

  // 整体周度走势
  const weeklySql = `SELECT ${fridayWeekExpr('资金账号创建完成时间')} as week_start, ${selectCols}
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
  const planSql = `SELECT ${planExpr} as plan_key, "投放账号", ${fridayWeekExpr('资金账号创建完成时间')} as week_start, ${selectCols}
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

export async function handleAppMarketCreative(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const top_n = Math.max(1, toInt(body?.top_n) || 50);

  // 强制 渠道类型='互联网引流'（_funnel_filters 业务规则）
  const where = buildWhere([
    dateClause('资金账号创建完成时间', sd, ed),
    { sql: '"渠道类型" = ?', params: ['互联网引流'] },
    inClause('应用市场', filters.app_markets),
  ]);

  const planExpr = `CASE WHEN "广告计划ID" IS NULL OR "广告计划ID" = 0 THEN COALESCE("投放账号", '未归因') ELSE CAST("广告计划ID" AS TEXT) END`;
  const sql = `SELECT ${planExpr} as plan_key,
    "投放账号", "应用市场", "渠道类型",
    COALESCE(SUM("是否激活APP"), 0) as 激活APP,
    COALESCE(SUM("是否创建完资金账号"), 0) as 开户成功,
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
// 应用市场 · 广告计划分析 (reports/app-market/ad-plan-analysis)
// 结合三个数据源：dim_ad_plan_class + fact_conv_appmarket + agg_vendor_daily
// 复刻 backend/routes/reports/app_market_ad_plan.py（周度口径：上周五~本周四）
// ============================================================================

// 7 大应用市场（与归因转化率 / 计划分解口径一致）
const AD_PLAN_ALLOWED_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果'];

// 广告开户复合条件（固定常量，无参数绑定）
const AD_ACCOUNT_COND = `"是否创建完资金账号" = 1 AND "渠道类型" = '互联网引流' AND "是否新开户" = 1`;

/** 周五起始周（上周五~本周四）SQLite 表达式：date(col, 'weekday 4', '-6 days') */
function fridayWeekExpr(col: string): string {
  return `date("${col}", 'weekday 4', '-6 days')`;
}

/** 周五起始周结束日（周四）= 周起始 + 6 天 */
function _adWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 步骤间转化率（分母为 0 返回 0，前端展示 '-'） */
function adRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

/** 由各阶段原始计数构建指标行（含步骤间转化率与广告开户成本） */
function buildAdMetrics(
  spend: number, impressions: number, clicks: number,
  downloads: number, activate: number, register: number, id_card: number,
  bank_card: number, submit: number, success: number, ad_account: number
): Record<string, any> {
  return {
    '消耗': round2(toFloat(spend)),
    '展示': toInt(impressions),
    '点击': toInt(clicks),
    '点击率': adRate(clicks, impressions),
    '下载量': toInt(downloads),
    '下载率': adRate(downloads, clicks),
    '激活量': toInt(activate),
    '激活率': adRate(activate, downloads),
    '开户注册量': toInt(register),
    '开户注册率': adRate(register, activate),
    '身份证上传量': toInt(id_card),
    '身份证上传率': adRate(id_card, register),
    '银行卡上传量': toInt(bank_card),
    '银行卡上传率': adRate(bank_card, id_card),
    '开户提交量': toInt(submit),
    '开户提交率': adRate(submit, bank_card),
    '开户成功量': toInt(success),
    '开户成功率': adRate(success, submit),
    '广告开户量': toInt(ad_account),
    '广告开户率': adRate(ad_account, success),
    '广告开户成本': toInt(ad_account) > 0 ? round2(spend / toInt(ad_account)) : null,
  };
}

export async function handleAppMarketAdPlanAnalysis(body: any): Promise<any> {
  const filters = getFilters(body);
  const { start_date: sd, end_date: ed } = getDateRange(filters);
  const platforms: string[] = Array.isArray(filters.platforms) ? filters.platforms : [];
  const week_start: string | undefined = filters.week_start;

  // 市场解析：空 -> 全部 7 大市场（与后端 _resolve_markets 一致）
  const requested = platforms.filter(p => AD_PLAN_ALLOWED_PLATFORMS.includes(p));
  const markets = requested.length > 0 ? requested : AD_PLAN_ALLOWED_PLATFORMS;

  const marketIn = (col: string) => inClause(col, markets)!;
  const marketWhere = buildWhere([marketIn('应用市场'), dateClause('资金账号创建完成时间', sd, ed)]);
  const platformWhere = buildWhere([marketIn('平台'), { sql: '"花费" > 0', params: [] }, dateClause('日期', sd, ed)]);

  // ---- 开户概览：按应用市场聚合 开户 + 消耗 ----
  const openRows = await querySql<Row>(
    `SELECT "应用市场" as market,
       COALESCE(SUM(CASE WHEN ${AD_ACCOUNT_COND} THEN 1 ELSE 0 END), 0) as open_cnt
     FROM fact_conv_appmarket ${marketWhere.clause}
     GROUP BY "应用市场"`,
    marketWhere.params
  );
  const openMap: Record<string, number> = {};
  for (const r of openRows) openMap[r.market] = toInt(r.open_cnt);

  const spendRows = await querySql<Row>(
    `SELECT "平台" as platform, COALESCE(SUM("花费"), 0) as spend
     FROM agg_vendor_daily ${platformWhere.clause}
     GROUP BY "平台"`,
    platformWhere.params
  );
  const spendMap: Record<string, number> = {};
  for (const r of spendRows) spendMap[r.platform] = toFloat(r.spend);

  const total_open = Object.values(openMap).reduce((s, v) => s + v, 0);
  const total_spend = round2(Object.values(spendMap).reduce((s, v) => s + v, 0));
  const overview = {
    total_open,
    total_spend,
    total_open_cost: total_open ? round2(total_spend / total_open) : null,
  };

  const by_market = markets.map(m => {
    const oc = openMap[m] || 0;
    const sp = round2(spendMap[m] || 0);
    return { market: m, open_count: oc, spend: sp, open_cost: oc ? round2(sp / oc) : null };
  }).sort((a, b) => b.open_count - a.open_count);

  // ---- 计划分解维度 (dim_ad_plan_class) ----
  const planRows = await querySql<Row>(
    `SELECT "应用市场" as market, "广告分组ID" as plan_id, "广告分组名称" as plan_name,
       "版位" as placement, "子版位" as sub_placement, "出价" as bid
     FROM dim_ad_plan_class ${buildWhere([marketIn('应用市场')]).clause}`,
    buildWhere([marketIn('应用市场')]).params
  );
  const plans = planRows.map(r => ({
    plan_id: Number(r.plan_id),
    market: r.market,
    plan_name: r.plan_name,
    placement: r.placement,
    sub_placement: r.sub_placement,
    bid: r.bid,
  }));
  const planIds = Array.from(new Set(plans.map(p => p.plan_id)));
  // SQLite 中整数列与字符串参数比较会做数值转换，IN 参数统一传字符串
  const planIdStrs = planIds.map(String);

  // ---- 计划级 开户 / 消耗 映射（plan 分解 5 大市场）----
  const poMap: Record<number, number> = {};
  const psMap: Record<number, number> = {};
  if (planIds.length > 0) {
    const poWhere = buildWhere([inClause('广告计划ID', planIdStrs), dateClause('资金账号创建完成时间', sd, ed)]);
    const poRows = await querySql<Row>(
      `SELECT "广告计划ID" as plan_id, COALESCE(SUM(CASE WHEN ${AD_ACCOUNT_COND} THEN 1 ELSE 0 END), 0) as open_cnt
       FROM fact_conv_appmarket ${poWhere.clause}
       GROUP BY "广告计划ID"`,
      poWhere.params
    );
    for (const r of poRows) poMap[Number(r.plan_id)] = toInt(r.open_cnt);

    const psWhere = buildWhere([{ sql: '"花费" > 0', params: [] }, inClause('计划ID', planIdStrs), dateClause('日期', sd, ed)]);
    const psRows = await querySql<Row>(
      `SELECT "计划ID" as plan_id, COALESCE(SUM("花费"), 0) as spend
       FROM agg_vendor_daily ${psWhere.clause}
       GROUP BY "计划ID"`,
      psWhere.params
    );
    for (const r of psRows) psMap[Number(r.plan_id)] = toFloat(r.spend);
  }

  // 计划明细 + 版位聚合
  const plan_detail = plans.map(p => {
    const oc = poMap[p.plan_id] || 0;
    const sp = round2(psMap[p.plan_id] || 0);
    return {
      plan_id: String(p.plan_id),
      market: p.market, plan_name: p.plan_name, placement: p.placement,
      sub_placement: p.sub_placement, bid: p.bid,
      open_count: oc, spend: sp, open_cost: oc ? round2(sp / oc) : null,
    };
  }).sort((a, b) => (b.open_count || 0) - (a.open_count || 0) || (b.spend || 0) - (a.spend || 0));

  const placementAgg: Record<string, { open_count: number; spend: number }> = {};
  for (const p of plan_detail) {
    const key = `${p.placement || '未分类'}|${p.sub_placement || '未分类'}`;
    const agg = placementAgg[key] || { open_count: 0, spend: 0 };
    agg.open_count += p.open_count;
    agg.spend += p.spend;
    placementAgg[key] = agg;
  }
  const by_placement = Object.entries(placementAgg).map(([key, agg]) => {
    const [placement, sub_placement] = key.split('|');
    return {
      placement, sub_placement,
      open_count: agg.open_count,
      spend: round2(agg.spend),
      open_cost: agg.open_count ? round2(agg.spend / agg.open_count) : null,
    };
  }).sort((a, b) => b.open_count - a.open_count);

  // ---- 按周开户量（周五起始周），per-market ----
  const weeklyOpenRows = await querySql<Row>(
    `SELECT "应用市场" as market, ${fridayWeekExpr('资金账号创建完成时间')} as week_start,
       COALESCE(SUM(CASE WHEN ${AD_ACCOUNT_COND} THEN 1 ELSE 0 END), 0) as open_count
     FROM fact_conv_appmarket ${marketWhere.clause}
     GROUP BY "应用市场", week_start ORDER BY "应用市场", week_start`,
    marketWhere.params
  );
  const weekly_open = weeklyOpenRows.map(r => {
    const ws = String(r.week_start).slice(0, 10);
    return { market: r.market, week_start: ws, week_end: _adWeekEnd(ws), open_count: toInt(r.open_count) };
  });

  // ---- 按周分计划 + 分计划展开 ----
  const aggBy: Record<string, { spend: number; impressions: number; clicks: number }> = {};
  const factBy: Record<string, { downloads: number; activate: number; register: number; id_card: number; bank_card: number; submit: number; success: number; ad_account: number }> = {};
  if (planIds.length > 0) {
    const aggWeekWhere = buildWhere([
      inClause('计划ID', planIdStrs),
      { sql: '("花费" > 0 OR "展示量" > 0 OR "点击量" > 0)', params: [] },
      dateClause('日期', sd, ed),
    ]);
    const aggWeekRows = await querySql<Row>(
      `SELECT "计划ID" as plan_id, ${fridayWeekExpr('日期')} as week_start,
         COALESCE(SUM("花费"), 0) as spend, COALESCE(SUM("展示量"), 0) as impressions, COALESCE(SUM("点击量"), 0) as clicks
       FROM agg_vendor_daily ${aggWeekWhere.clause}
       GROUP BY "计划ID", week_start`,
      aggWeekWhere.params
    );
    for (const r of aggWeekRows) {
      aggBy[`${Number(r.plan_id)}|${String(r.week_start).slice(0, 10)}`] = {
        spend: toFloat(r.spend), impressions: toFloat(r.impressions), clicks: toFloat(r.clicks),
      };
    }

    const factWeekWhere = buildWhere([
      inClause('广告计划ID', planIdStrs),
      { sql: '"渠道类型" = ?', params: ['互联网引流'] },
      dateClause('资金账号创建完成时间', sd, ed),
    ]);
    const factWeekRows = await querySql<Row>(
      `SELECT "广告计划ID" as plan_id, ${fridayWeekExpr('资金账号创建完成时间')} as week_start,
         COUNT(DISTINCT "设备号") as downloads,
         COUNT(DISTINCT CASE WHEN "是否激活APP" = 1 THEN "设备号" END) as activate,
         COUNT(DISTINCT CASE WHEN "是否开户注册" = 1 THEN "设备号" END) as register,
         COUNT(DISTINCT CASE WHEN "是否注册身份证" = 1 THEN "设备号" END) as id_card,
         COUNT(DISTINCT CASE WHEN "是否注册银行卡" = 1 THEN "设备号" END) as bank_card,
         COUNT(DISTINCT CASE WHEN "是否提交开户" = 1 THEN "设备号" END) as submit,
         COUNT(DISTINCT CASE WHEN "是否创建完资金账号" = 1 THEN "设备号" END) as success,
         COUNT(DISTINCT CASE WHEN ${AD_ACCOUNT_COND} THEN "设备号" END) as ad_account
       FROM fact_conv_appmarket ${factWeekWhere.clause}
       GROUP BY "广告计划ID", week_start`,
      factWeekWhere.params
    );
    for (const r of factWeekRows) {
      factBy[`${Number(r.plan_id)}|${String(r.week_start).slice(0, 10)}`] = {
        downloads: toFloat(r.downloads), activate: toFloat(r.activate), register: toFloat(r.register),
        id_card: toFloat(r.id_card), bank_card: toFloat(r.bank_card), submit: toFloat(r.submit),
        success: toFloat(r.success), ad_account: toFloat(r.ad_account),
      };
    }
  }

  const plan_week_detail: any[] = [];
  const allWeeks = new Set<string>();
  for (const p of plans) {
    const pid = p.plan_id;
    const weekSet = new Set<string>();
    for (const k in aggBy) if (k.startsWith(`${pid}|`)) weekSet.add(k.split('|')[1]);
    for (const k in factBy) if (k.startsWith(`${pid}|`)) weekSet.add(k.split('|')[1]);
    const keys = Array.from(weekSet);

    const week_rows = keys.map(wk => {
      const a = aggBy[`${pid}|${wk}`] || { spend: 0, impressions: 0, clicks: 0 };
      const f = factBy[`${pid}|${wk}`] || { downloads: 0, activate: 0, register: 0, id_card: 0, bank_card: 0, submit: 0, success: 0, ad_account: 0 };
      const m = buildAdMetrics(a.spend, a.impressions, a.clicks, f.downloads, f.activate, f.register, f.id_card, f.bank_card, f.submit, f.success, f.ad_account);
      m['week_start'] = wk;
      m['week_end'] = _adWeekEnd(wk);
      return m;
    }).sort((x, y) => y.week_start.localeCompare(x.week_start));

    keys.forEach(wk => allWeeks.add(wk));

    const sumMetrics = buildAdMetrics(
      keys.reduce((s, wk) => s + (aggBy[`${pid}|${wk}`]?.spend || 0), 0),
      keys.reduce((s, wk) => s + (aggBy[`${pid}|${wk}`]?.impressions || 0), 0),
      keys.reduce((s, wk) => s + (aggBy[`${pid}|${wk}`]?.clicks || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.downloads || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.activate || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.register || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.id_card || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.bank_card || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.submit || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.success || 0), 0),
      keys.reduce((s, wk) => s + (factBy[`${pid}|${wk}`]?.ad_account || 0), 0),
    );
    plan_week_detail.push({
      plan_id: String(pid),
      market: p.market, plan_name: p.plan_name, placement: p.placement,
      sub_placement: p.sub_placement, bid: p.bid,
      summary: sumMetrics,
      weeks: week_rows,
    });
  }
  plan_week_detail.sort((a, b) => (b.summary['消耗'] || 0) - (a.summary['消耗'] || 0));

  const weeks = Array.from(allWeeks).sort((a, b) => b.localeCompare(a));
  const selected = week_start && weeks.includes(week_start) ? week_start : (weeks[0] || null);

  const week_plans: any[] = [];
  if (selected) {
    for (const pl of plan_week_detail) {
      const row = pl.weeks.find((w: any) => w.week_start === selected);
      if (row) {
        week_plans.push({
          plan_id: pl.plan_id, market: pl.market, plan_name: pl.plan_name,
          placement: pl.placement, sub_placement: pl.sub_placement, ...row,
        });
      }
    }
    week_plans.sort((a, b) => (b['消耗'] || 0) - (a['消耗'] || 0));
  }

  return {
    platforms: AD_PLAN_ALLOWED_PLATFORMS,
    selected_platforms: platforms,
    overview,
    plan_detail,
    by_placement,
    by_market,
    weekly_open,
    weeks,
    selected_week: selected,
    week_plans,
    plan_week_detail,
  };
}
