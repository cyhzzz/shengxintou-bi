/**
 * 移动端本地路由处理器 —— 线索明细 / 主播聚类 / 投放评审 (leads-detail/*, investment-review)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, parseQueryParams, type Row } from './shared';
export async function handleLeadsDetail(url: string): Promise<any> {
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
export async function handleLeadsDetailFilterOptions(): Promise<any> {
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
export async function handleAnchorClusters(body: any): Promise<any> {
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
    // v3.7.3: 复合来源（如"抖音引流-周乐意,抖音引流-杨毅"）按匹配主播数均分，
    // 避免总线索数因重复计算而虚高（与后端 leads.py anchor-clusters 一致）
    const n = new Set(sortedMatches.map(m => `${m.platform}|||${m.anchor}`)).size;
    const div = Math.max(n, 1);
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
      a.leads += Math.round(toInt(r.leads) / div);
      a.existing_leads += Math.round(toInt(r.existing_leads) / div);
      a.new_leads += Math.round(toInt(r.new_leads) / div);
      a.mouth += Math.round(toInt(r.mouth) / div);
      a.valid_lead += Math.round(toInt(r.valid_lead) / div);
      a.new_valid_lead += Math.round(toInt(r.new_valid_lead) / div);
      a.opened += Math.round(toInt(r.opened) / div);
      a.new_opened += Math.round(toInt(r.new_opened) / div);
      a.valid += Math.round(toInt(r.valid) / div);
      a.new_valid += Math.round(toInt(r.new_valid) / div);
      a.new_assets += toFloat(r.new_assets) / div;
      a.existing_assets += toFloat(r.existing_assets) / div;
      a.assets += toFloat(r.assets) / div;
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
export async function handleAnchorClustersTrend(body: any): Promise<any> {
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
    const src = String(r.customer_source || '').trim();
    const tokens = src.split(ANCHOR_SPLIT).map(t => t.trim()).filter(Boolean);
    // live_types 筛选 — 拆 客户来源 token，看是否命中 wanted_tokens
    if (wantedTokens) {
      if (!tokens.some(t => wantedTokens.has(t))) continue;
    }
    // 复合来源（如"抖音引流-周乐意,抖音引流-杨毅"）按匹配主播数均分，
    // 与 anchor-clusters / anchor-weekly-analysis 口径一致，避免 period totals 虚高
    const n = new Set(tokens.filter(t => ANCHOR_PATTERN.test(t) || ltMap.plain_name_tokens.has(t))).size;
    const div = Math.max(n, 1);
    const period = String(r.period ?? '');
    const platform = String(r.platform || '未知');
    allPlatforms.add(platform);

    if (!periodTotals[period]) {
      periodTotals[period] = { leads: 0, new_leads: 0, mouth: 0, valid_lead: 0, new_opened: 0, new_valid: 0, new_assets: 0 };
    }
    const b = periodTotals[period];
    b.leads += Math.round(toInt(r.leads) / div);
    b.new_leads += Math.round(toInt(r.new_leads) / div);
    b.mouth += Math.round(toInt(r.mouth) / div);
    b.valid_lead += Math.round(toInt(r.valid_lead) / div);
    b.new_opened += Math.round(toInt(r.new_opened) / div);
    b.new_valid += Math.round(toInt(r.new_valid) / div);
    b.new_assets += toFloat(r.new_assets) / div;

    if (!byPlatform[period]) byPlatform[period] = {};
    if (!byPlatform[period][platform]) {
      byPlatform[period][platform] = { leads: 0, new_leads: 0, mouth: 0, valid_lead: 0, new_opened: 0, new_valid: 0, new_assets: 0 };
    }
    const bx = byPlatform[period][platform];
    bx.leads += Math.round(toInt(r.leads) / div);
    bx.new_leads += Math.round(toInt(r.new_leads) / div);
    bx.mouth += Math.round(toInt(r.mouth) / div);
    bx.valid_lead += Math.round(toInt(r.valid_lead) / div);
    bx.new_opened += Math.round(toInt(r.new_opened) / div);
    bx.new_valid += Math.round(toInt(r.new_valid) / div);
    bx.new_assets += toFloat(r.new_assets) / div;
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

export async function handleAnchorWeeklyAnalysis(body: any): Promise<any> {
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
    // v3.7.3: 复合来源（如"抖音引流-周乐意,抖音引流-杨毅"）按匹配主播数均分，
    // 避免总线索数因重复计算而虚高（与后端 leads.py anchor-weekly-analysis 一致）
    const n = new Set(sortedMatches.map(m => m.anchor)).size;
    const div = Math.max(n, 1);
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
      a.totals.leads += Math.round(toInt(r.leads) / div);
      a.totals.mouth += Math.round(toInt(r.mouth) / div);
      a.totals.valid_lead += Math.round(toInt(r.valid_lead) / div);
      a.totals.new_valid_lead += Math.round(toInt(r.new_valid_lead) / div);
      a.totals.new_opened += Math.round(toInt(r.new_opened) / div);
      a.totals.new_valid += Math.round(toInt(r.new_valid) / div);

      if (!a.weekly[week]) {
        a.weekly[week] = { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 };
      }
      const w = a.weekly[week];
      w.leads += Math.round(toInt(r.leads) / div);
      w.mouth += Math.round(toInt(r.mouth) / div);
      w.valid_lead += Math.round(toInt(r.valid_lead) / div);
      w.new_valid_lead += Math.round(toInt(r.new_valid_lead) / div);
      w.new_opened += Math.round(toInt(r.new_opened) / div);
      w.new_valid += Math.round(toInt(r.new_valid) / div);

      if (!weeklyAgg[week]) {
        weeklyAgg[week] = { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 };
      }
      // v3.8.7: 同步均分，避免 weekly_totals > 各主播之和（与后端 leads.py 一致）
      const wa = weeklyAgg[week];
      wa.leads += Math.round(toInt(r.leads) / div);
      wa.mouth += Math.round(toInt(r.mouth) / div);
      wa.valid_lead += Math.round(toInt(r.valid_lead) / div);
      wa.new_valid_lead += Math.round(toInt(r.new_valid_lead) / div);
      wa.new_opened += Math.round(toInt(r.new_opened) / div);
      wa.new_valid += Math.round(toInt(r.new_valid) / div);
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
export async function handleInvestmentReview(url: string, body: any): Promise<any> {
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
  // v3.7.1：APP 下载链路指标（kiwi/哇棒/有米 走 APP 下载链路，不走加微链路）
  const sql = `SELECT "厂商" as agency,
    substr("日期", 1, 7) as month,
    COALESCE(SUM("花费"), 0) as cost,
    COALESCE(SUM("线索数"), 0) as leads,
    COALESCE(SUM("开口人数"), 0) as opened_conversation,
    COALESCE(SUM("开户人数"), 0) as opened_account,
    COALESCE(SUM("APP激活人数"), 0) as app_activation
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
    const app_act = toInt(r.app_activation);
    byAgency[agency].push({
      month: r.month || '',
      cost: round2(cost),
      leads,
      opened_conversation: opened_conv,
      opened_account: opened_acc,
      app_activation: app_act,
      app_activation_cost: app_act > 0 ? round2(cost / app_act) : null,
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
    const total_app_act = items.reduce((s, it) => s + it.app_activation, 0);
    const total_row = {
      month: '总计',
      cost: round2(total_cost),
      leads: total_leads,
      opened_conversation: total_conv,
      opened_account: total_acc,
      app_activation: total_app_act,
      app_activation_cost: total_app_act > 0 ? round2(total_cost / total_app_act) : null,
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
