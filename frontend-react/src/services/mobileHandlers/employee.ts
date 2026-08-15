/**
 * 移动端本地路由处理器 —— 员工转化 (employee-conversion/*)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, type Row } from './shared';
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

export async function handleEmployeeConversionAnalysis(body: any): Promise<any> {
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

export async function handleEmployeeConversionWeekly(body: any): Promise<any> {
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

export async function handleEmployeeConversionAnalysisChannelOverview(body: any): Promise<any> {
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

export async function handleEmployeeConversionFilterOptions(): Promise<any> {
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
