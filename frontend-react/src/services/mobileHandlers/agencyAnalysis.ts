/**
 * 移动端本地路由处理器 —— 代理商分析 (agency-analysis)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, parseQueryParams, type Row } from './shared';
// ============================================================================
// 代理商分析 (agency-analysis)
// ============================================================================


export async function handleAgencyAnalysis(url: string, body: any): Promise<any> {
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
  // v3.7.1：APP 下载链路指标（kiwi/哇棒/有米 走 APP 下载链路，不走加微链路）
  const sumSql = `SELECT "平台", "业务模式", "厂商",
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("展示量"), 0) as impressions,
    COALESCE(SUM("点击量"), 0) as clicks,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开户人数"), 0) as opened,
    COALESCE(SUM("有效户人数"), 0) as valid,
    COALESCE(SUM("客户资产"), 0) as assets,
    COALESCE(SUM("存量客户资产"), 0) as existing_assets,
    COALESCE(SUM("APP激活人数"), 0) as app_act
  FROM agg_vendor_daily ${where.clause}
  GROUP BY "平台", "业务模式", "厂商"`;
  const sumRows = await querySql<Row>(sumSql, where.params);

  const summary: any[] = [];
  const plat_sub: Record<string, any> = {};
  const grand = { cost: 0, impressions: 0, clicks: 0, leads: 0, opened: 0, valid: 0, assets: 0, existing_assets: 0, app_act: 0 };

  for (const r of sumRows) {
    const cost = toFloat(r.cost), leads = toInt(r.leads), opened = toInt(r.opened);
    const valid = toInt(r.valid), assets = toFloat(r.assets), exAssets = toFloat(r.existing_assets);
    const appAct = toInt(r.app_act);
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
        app_activation_users: appAct,
        app_activation_cost: appAct > 0 ? round2(cost / appAct) : 0,
      },
    };
    summary.push(item);

    // 平台小计
    const p = item.platform;
    if (!plat_sub[p]) {
      plat_sub[p] = { platform: p, business_model: '', agency: `[${p} 小计]`, is_subtotal: true,
        metrics: { cost: 0, impressions: 0, clicks: 0, lead_users: 0, opened_account_users: 0, valid_customer_users: 0, opened_account_assets: 0, existing_customer_assets: 0, app_activation_users: 0 } };
    }
    const sm = plat_sub[p].metrics;
    sm.cost += cost; sm.impressions += item.metrics.impressions; sm.clicks += item.metrics.clicks;
    sm.lead_users += leads; sm.opened_account_users += opened; sm.valid_customer_users += valid;
    sm.opened_account_assets += assets; sm.existing_customer_assets += exAssets;
    sm.app_activation_users += appAct;

    // 合计
    grand.cost += cost; grand.impressions += item.metrics.impressions; grand.clicks += item.metrics.clicks;
    grand.leads += leads; grand.opened += opened; grand.valid += valid;
    grand.assets += assets; grand.existing_assets += exAssets;
    grand.app_act += appAct;
  }

  // 小计四舍五入
  for (const p in plat_sub) {
    const m = plat_sub[p].metrics;
    m.cost = round2(m.cost); m.opened_account_assets = round2(m.opened_account_assets);
    m.existing_customer_assets = round2(m.existing_customer_assets);
    m.app_activation_cost = m.app_activation_users > 0 ? round2(m.cost / m.app_activation_users) : 0;
  }

  const grand_row = {
    platform: '', business_model: '', agency: '[合计]', is_total: true,
    metrics: {
      cost: round2(grand.cost), impressions: grand.impressions, clicks: grand.clicks,
      lead_users: grand.leads, opened_account_users: grand.opened, valid_customer_users: grand.valid,
      opened_account_assets: round2(grand.assets), existing_customer_assets: round2(grand.existing_assets),
      lead_cost: grand.leads > 0 ? round2(grand.cost / grand.leads) : 0,
      account_cost: grand.opened > 0 ? round2(grand.cost / grand.opened) : 0,
      app_activation_users: grand.app_act,
      app_activation_cost: grand.app_act > 0 ? round2(grand.cost / grand.app_act) : 0,
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
    COALESCE(SUM("有效户人数"), 0) as valid,
    COALESCE(SUM("APP激活人数"), 0) as app_act
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
      app_activation_users: toInt(r.app_act),
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
