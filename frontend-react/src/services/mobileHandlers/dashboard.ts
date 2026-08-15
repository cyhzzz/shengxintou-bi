/**
 * 移动端本地路由处理器 —— 仪表盘 (dashboard/core-metrics, dashboard/trend-data)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, round4, dateClause, inClause, buildWhere, getDateRange, type Row } from './shared';
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

export async function handleDashboardCoreMetrics(body: any): Promise<any> {
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

export async function handleDashboardTrendData(body: any): Promise<any> {
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
