/**
 * 移动端本地路由处理器 —— 转化漏斗拆分 (conversion-funnel/split)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, parseQueryParams, type Row } from './shared';
export async function handleConversionFunnelSplit(url: string, body: any): Promise<any> {
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
  // 漏斗按「下载日期」做下载 cohort（追踪下载后各阶段转化）；新开户资产(aAssetWhere)仍按资金账号创建完成时间。
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
    ['是否创建完资金账号', '开户成功'],
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
    dateClause('资金账号创建完成时间', sd, ed),
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
