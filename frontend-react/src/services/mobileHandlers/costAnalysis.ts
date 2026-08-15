/**
 * 移动端本地路由处理器 —— 内容平台成本分析 (cost-analysis)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, getFilters, getDateRange, type Row } from './shared';
// ============================================================================
// 成本分析 (cost-analysis)
// ============================================================================

export async function handleCostAnalysis(body: any): Promise<any> {
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
