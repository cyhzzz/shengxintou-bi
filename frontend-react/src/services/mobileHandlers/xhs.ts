/**
 * 移动端本地路由处理器 —— 小红书笔记 / 运营分析 / 计划分析 (xhs-notes/*, xhs/*)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, getFilters, getDateRange, parseQueryParams, type Row } from './shared';
// ============================================================================
// 小红书笔记列表 (xhs-notes-list / xhs-notes/list)
// ============================================================================

/** agg_xhs_note 字段白名单（用于 sort_field 校验） */
const XHS_NOTE_SORT_FIELDS = new Set([
  '发布时间', '消费金额', '总展现量', '点击量', '总互动量', '私信进线人数',
  '添加企微人数', '企微成功添加人数', '开户人数', '加微成本', '开户成本', '推广展现量', '推广点击量',
]);

/** 小红书笔记列表（POST 与 GET 共享） */
export async function handleXhsNotesList(url: string, body: any): Promise<any> {
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
export async function handleXhsNotesFilterOptions(): Promise<any> {
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

export async function handleXhsNotesOperationAnalysis(body: any): Promise<any> {
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

export async function handleXhsPlanAnalysis(body: any): Promise<any> {
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
