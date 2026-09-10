/**
 * 移动端 AI 分析报告 business 证据包（v4.2.6）—— 与 backend/utils/llm_evidence.py 同口径复刻。
 *
 * 三包结构：vendor（厂商经营）/ note（小红书笔记分层）/ appmarket（应用市场经营），
 * 单包取数失败降级为 null（SYSTEM_PROMPT 明示 null 子包跳过解读不编造）。
 *
 * 口径红线（与后端一致）：
 * - 应用市场聚合强制 渠道类型='互联网引流'（对齐获客报表 _funnel_filters）；
 *   「是否新开户」是漏斗末段指标，绝不用 WHERE 过滤（漏斗变平红线）
 * - 内容平台转化侧沿用非存量口径（是否为存量客户 = 0 OR IS NULL）
 * - agg_vendor_daily 是统一漏斗超集：开口/有效线索列=内容平台值，APP下载/激活列=应用市场值
 * - 笔记衰退基于转化侧月度（fact_conv_content 按笔记×月）；agg_xhs_note 为累计快照，只做当前分层
 * - 只做 SELECT/SUM/GROUP BY 聚合，不输出任何设备/线索级明细（数据安全红线）
 */
import { querySql } from '../mobileSqlite';
import { round4, type Row } from './shared';

// ==== 证据包瘦身限制（与 llm_evidence.py 常量逐字对齐）====

const NOTE_TOP_LIMIT = 10;
const NOTE_DECLINE_LIMIT = 5;
const NOTE_STOP_LIMIT = 5;
const NOTE_NEW_LIMIT = 5;
const PLACEMENT_TOP_LIMIT = 5;
const PLACEMENT_BOTTOM_LIMIT = 5;
const PLAN_TOP_LIMIT = 5;
const TITLE_MAX_LEN = 24;
const VENDOR_PLATFORM_LIMIT = 6;

// 笔记衰退判定（转化侧）：前 3 月月均开口达下限、当月跌破均值的指定比例
const DECLINE_MIN_AVG_OPENED = 10;
const DECLINE_DROP_RATIO = 0.3;
// 停投候选（投放侧累计快照）：消费达下限且企微加微几乎为零
const STOP_MIN_COST = 1000.0;
const STOP_MAX_ADDS = 2;

const VENDOR_FIELDS = [
  'cost', 'leads', 'opened', 'valid', 'accounts', 'eff_accounts',
  'app_downloads', 'app_activations', 'asset', 'revenue',
] as const;
const APPMARKET_FUNNEL_FIELDS = [
  'downloads', 'activated', 'registered', 'funded', 'opened_accounts',
  'new_accounts', 'deposited', 'eff_accounts',
] as const;
// 商店聚合字段 = 漏斗字段 + 资产/创收（与后端 APPMARKET_FUNNEL_FIELDS + ('asset','revenue') 一致）
const APPMARKET_ACCUM_FIELDS = [...APPMARKET_FUNNEL_FIELDS, 'asset', 'revenue'] as const;

// ==== 类型 ====

type VendorField = typeof VENDOR_FIELDS[number];
type AppmarketAccumField = typeof APPMARKET_ACCUM_FIELDS[number];
type VendorAccum = Record<VendorField, number>;
type FunnelAccum = Record<AppmarketAccumField, number>;

export type VendorSide = VendorAccum & {
  open_rate: number | null; lead_cost: number | null;
  account_cost: number | null; eff_account_cost: number | null;
};
export type StoreSide = FunnelAccum & {
  activation_rate: number | null; new_account_rate: number | null;
  asset_per_new_account: number | null; revenue_per_new_account: number | null;
};

export interface VendorPlatform { platform: string; cost: number; leads: number; opened: number; valid: number; accounts: number; eff_accounts: number; app_downloads: number; app_activations: number; asset: number; revenue: number; }
export interface VendorPackage {
  vendor: string; current: VendorSide; prev3: VendorSide; platforms_current: VendorPlatform[];
}

export interface NoteSnapshotBrief {
  type: string; published: string; impressions: number; ctr: number | null;
  adds: number; add_cost: number | null; accounts: number; cost: number | null;
}
export interface NoteWatchItem { note: string; opened: number; leads: number; valid: number; accounts: number; snapshot: NoteSnapshotBrief | null; }
export interface NoteDeclineItem { note: string; prev3_avg_opened: number; current_opened: number; snapshot: NoteSnapshotBrief | null; }
export interface NoteStopItem { note: string; cost: number | null; impressions: number; ctr: number | null; adds: number; accounts: number; }
export interface NoteTypeAgg { type: string; notes: number; impressions: number; avg_ctr: number | null; dm: number; adds: number; accounts: number; cost: number | null; }
export interface NoteNewItem { note: string; type: string; published: string; impressions: number; ctr: number | null; adds: number; accounts: number; cost: number | null; }
export interface NotePackage {
  watch_top: NoteWatchItem[]; declining: NoteDeclineItem[]; stop_candidates: NoteStopItem[];
  content_types: NoteTypeAgg[]; new_notes: NoteNewItem[];
  snapshot_note_count: number; conversion_tracked_note_count: number;
}

export interface PlacementRow { store: string; placement: string; downloads: number; new_accounts: number; asset: number | null; revenue: number | null; }
export interface PlanRow { store: string; plan: string; downloads: number; new_accounts: number; }
export interface AppmarketPackage {
  stores: Array<{ store: string; current: StoreSide; prev3: StoreSide }>;
  placement_potential: PlacementRow[];
  placement_watchlist: PlacementRow[];
  plans_top: PlanRow[];
}

export interface BusinessEvidence {
  vendor: VendorPackage[] | null;
  note: NotePackage | null;
  appmarket: AppmarketPackage | null;
}

// 归一化后的中间行（fetch 输出 / build 输入，字段语义与后端 fetch_* 返回 dict 一致）
interface VendorMonthlyRow {
  month: string; vendor: string; platform: string;
  cost: number | null; leads: number; opened: number; valid: number; accounts: number;
  eff_accounts: number; app_downloads: number; app_activations: number;
  asset: number | null; revenue: number | null;
}
interface NoteConvRow { note_id: string; note_name: string | null; month: string; leads: number; opened: number; valid: number; accounts: number; }
interface NoteSnapRow {
  note_id: string | null; title: string | null; type: string | null; published: string | null;
  impressions: number; ctr: number | null; dm: number; adds: number;
  add_cost: number | null; accounts: number; cost: number | null;
}
interface StoreMonthlyRow {
  store: string; month: string;
  downloads: number; activated: number; registered: number; funded: number;
  opened_accounts: number; new_accounts: number; deposited: number; eff_accounts: number;
  asset: number | null; revenue: number | null;
}

// ==== 数值与日期辅助 ====

// 对齐后端 _num：None → None，否则保留 4 位小数（shared.toFloat 会把 null 归零，故本地实现）
function num4(v: unknown): number | null {
  return v === null || v === undefined ? null : round4(Number(v));
}

// 对齐后端 metrics.ratio：分母为 0/空 → None，否则保留 4 位小数
function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return round4(numerator / denominator);
}

// 对齐后端 _clip_title：strip 后截断 24 字，空值回退「未命名」
function clipTitle(title: unknown): string {
  const text = String(title ?? '').trim();
  return text ? text.slice(0, TITLE_MAX_LEN) : '未命名';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 与 diagnosis.ts shiftMonth 同实现（原函数未导出，本地复刻）
function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${pad2((total % 12) + 1)}`;
}

function prevMonthsOf(month: string): string[] {
  return [shiftMonth(month, -3), shiftMonth(month, -2), shiftMonth(month, -1)];
}

function trendMonthsOf(month: string): string[] {
  return [...prevMonthsOf(month), month];
}

function zeroVendorAccum(): VendorAccum {
  return { cost: 0, leads: 0, opened: 0, valid: 0, accounts: 0, eff_accounts: 0, app_downloads: 0, app_activations: 0, asset: 0, revenue: 0 };
}

function zeroFunnelAccum(): FunnelAccum {
  return { downloads: 0, activated: 0, registered: 0, funded: 0, opened_accounts: 0, new_accounts: 0, deposited: 0, eff_accounts: 0, asset: 0, revenue: 0 };
}

// ============================================================
// 厂商经营（agg_vendor_daily）
// ============================================================

/** 按月×厂商×平台聚合统一漏斗超集（内容平台与应用市场指标混合在同一行集） */
async function fetchVendorMonthly(months: string[]): Promise<VendorMonthlyRow[]> {
  const sql = `SELECT substr("日期", 1, 7) AS month,
      COALESCE(NULLIF("厂商", ''), '未归因') AS vendor,
      COALESCE(NULLIF("平台", ''), '未知') AS platform,
      SUM("花费") AS cost,
      SUM("线索数") AS leads,
      SUM("开口人数") AS opened,
      SUM("有效线索数") AS valid,
      SUM("开户人数") AS accounts,
      SUM("有效户人数") AS eff_accounts,
      SUM("APP下载数") AS app_downloads,
      SUM("APP激活人数") AS app_activations,
      SUM("客户资产") AS asset,
      SUM("客户创收") AS revenue
    FROM agg_vendor_daily
    WHERE substr("日期", 1, 7) IN (?, ?, ?, ?)
    GROUP BY substr("日期", 1, 7), COALESCE(NULLIF("厂商", ''), '未归因'), COALESCE(NULLIF("平台", ''), '未知')`;
  const rows = await querySql<Row>(sql, months);
  return rows.map((r) => ({
    month: String(r.month ?? ''),
    vendor: String(r.vendor ?? ''),
    platform: String(r.platform ?? ''),
    cost: num4(r.cost),
    leads: toIntSafe(r.leads),
    opened: toIntSafe(r.opened),
    valid: toIntSafe(r.valid),
    accounts: toIntSafe(r.accounts),
    eff_accounts: toIntSafe(r.eff_accounts),
    app_downloads: toIntSafe(r.app_downloads),
    app_activations: toIntSafe(r.app_activations),
    asset: num4(r.asset),
    revenue: num4(r.revenue),
  }));
}

// 对齐后端 int(x or 0)：null/非有限值回退 0
function toIntSafe(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function vendorSide(bucket: VendorAccum): VendorSide {
  return {
    ...bucket,
    open_rate: ratio(bucket.opened, bucket.leads),
    lead_cost: ratio(bucket.cost, bucket.leads),
    account_cost: ratio(bucket.cost, bucket.accounts),
    eff_account_cost: ratio(bucket.cost, bucket.eff_accounts),
  };
}

/** 厂商×（当月 vs 前 3 月）聚合 + 当月平台拆分，按当月花费降序 */
function buildVendorEvidence(month: string, rows: VendorMonthlyRow[]): VendorPackage[] {
  const agg = new Map<string, { current: VendorAccum; prev3: VendorAccum; platforms: Map<string, VendorAccum> }>();
  for (const row of rows) {
    let bucket = agg.get(row.vendor);
    if (!bucket) {
      bucket = { current: zeroVendorAccum(), prev3: zeroVendorAccum(), platforms: new Map() };
      agg.set(row.vendor, bucket);
    }
    const side = row.month === month ? bucket.current : bucket.prev3;
    for (const field of VENDOR_FIELDS) side[field] += row[field] ?? 0;
    if (row.month === month) {
      let plat = bucket.platforms.get(row.platform);
      if (!plat) {
        plat = zeroVendorAccum();
        bucket.platforms.set(row.platform, plat);
      }
      for (const field of VENDOR_FIELDS) plat[field] += row[field] ?? 0;
    }
  }
  return [...agg.entries()]
    .sort((a, b) => (b[1].current.cost || 0) - (a[1].current.cost || 0))
    .map(([vendor, bucket]) => ({
      vendor,
      current: vendorSide(bucket.current),
      prev3: vendorSide(bucket.prev3),
      platforms_current: [...bucket.platforms.entries()]
        .sort((a, b) => (b[1].cost || 0) - (a[1].cost || 0))
        .slice(0, VENDOR_PLATFORM_LIMIT)
        .map(([platform, vals]) => ({ platform, ...vals })),
    }));
}

// ============================================================
// 小红书笔记（转化侧月度趋势 + 投放侧累计快照）
// ============================================================

/** 转化侧：按笔记×月聚合非存量线索、开口、有效线索、开户 */
async function fetchNoteConversionMonthly(months: string[]): Promise<NoteConvRow[]> {
  const nonStock = '("是否为存量客户" IS NULL OR "是否为存量客户" = 0)';
  const sql = `SELECT COALESCE(NULLIF("笔记ID", ''), '未标注') AS note_id,
      MAX("笔记名称") AS note_name,
      substr("线索日期", 1, 7) AS month,
      COUNT(*) AS leads,
      SUM(CASE WHEN ${nonStock} AND "是否客户开口" = 1 THEN 1 ELSE 0 END) AS opened,
      SUM(CASE WHEN ${nonStock} AND "是否有效线索" = 1 THEN 1 ELSE 0 END) AS valid,
      SUM(CASE WHEN ${nonStock} AND "是否开户" = 1 THEN 1 ELSE 0 END) AS accounts
    FROM fact_conv_content
    WHERE substr("线索日期", 1, 7) IN (?, ?, ?, ?)
      AND ${nonStock}
      AND "笔记ID" IS NOT NULL AND "笔记ID" != ''
    GROUP BY COALESCE(NULLIF("笔记ID", ''), '未标注'), substr("线索日期", 1, 7)`;
  const rows = await querySql<Row>(sql, months);
  return rows.map((r) => ({
    note_id: String(r.note_id ?? ''),
    note_name: r.note_name === null || r.note_name === undefined ? null : String(r.note_name),
    month: String(r.month ?? ''),
    leads: toIntSafe(r.leads),
    opened: toIntSafe(r.opened),
    valid: toIntSafe(r.valid),
    accounts: toIntSafe(r.accounts),
  }));
}

/** 投放侧：agg_xhs_note 累计快照关键列（全量读入内存做分层） */
async function fetchNoteSnapshot(): Promise<NoteSnapRow[]> {
  const sql = `SELECT "笔记ID" AS note_id, "笔记标题" AS title, "内容类型" AS type,
      "发布时间" AS published, "总展现量" AS impressions, "总点击率" AS ctr,
      "私信进线人数" AS dm, "企微成功添加人数" AS adds, "加微成本" AS add_cost,
      "开户人数" AS accounts, "消费金额" AS cost
    FROM agg_xhs_note`;
  const rows = await querySql<Row>(sql);
  return rows.map((r) => ({
    note_id: r.note_id === null || r.note_id === undefined ? null : String(r.note_id),
    title: r.title === null || r.title === undefined ? null : String(r.title),
    type: r.type === null || r.type === undefined ? null : String(r.type),
    published: r.published === null || r.published === undefined ? null : String(r.published),
    impressions: toIntSafe(r.impressions),
    ctr: num4(r.ctr),
    dm: toIntSafe(r.dm),
    adds: toIntSafe(r.adds),
    add_cost: num4(r.add_cost),
    accounts: toIntSafe(r.accounts),
    cost: num4(r.cost),
  }));
}

function noteSnapshotBrief(snapshot: NoteSnapRow | undefined): NoteSnapshotBrief | null {
  if (!snapshot) return null;
  return {
    type: snapshot.type || '未分类',
    published: String(snapshot.published ?? '').slice(0, 10),
    impressions: snapshot.impressions,
    ctr: snapshot.ctr,
    adds: snapshot.adds,
    add_cost: snapshot.add_cost,
    accounts: snapshot.accounts,
    cost: snapshot.cost,
  };
}

/** 笔记分层：值得关注 TOP / 衰退 / 停投候选 / 内容类型选题聚合 / 当月新笔记 */
function buildNoteEvidence(month: string, convRows: NoteConvRow[], snapRows: NoteSnapRow[]): NotePackage {
  const snapshotById = new Map<string, NoteSnapRow>();
  for (const row of snapRows) {
    if (row.note_id) snapshotById.set(String(row.note_id), row);
  }
  const trend = new Map<string, Map<string, NoteConvRow>>();
  for (const row of convRows) {
    let monthsMap = trend.get(row.note_id);
    if (!monthsMap) {
      monthsMap = new Map();
      trend.set(row.note_id, monthsMap);
    }
    monthsMap.set(row.month, row);
  }

  const prevMonths = prevMonthsOf(month);
  const watch: NoteWatchItem[] = [];
  const decline: NoteDeclineItem[] = [];
  for (const [noteId, monthsMap] of trend) {
    const cur = monthsMap.get(month);
    const curOpened = cur ? cur.opened : 0;
    const prevOpened = prevMonths
      .filter((m) => monthsMap.has(m))
      .map((m) => (monthsMap.get(m) as NoteConvRow).opened);
    // 当月无转化时回退到最早插入月份的名称（Map 保持插入序，对齐 next(iter(months_map.values()))）
    const nameRow = cur ?? (monthsMap.values().next().value as NoteConvRow);
    const name = clipTitle(nameRow.note_name);
    if (cur && curOpened > 0) {
      watch.push({
        note: name, opened: curOpened, leads: cur.leads, valid: cur.valid,
        accounts: cur.accounts, snapshot: noteSnapshotBrief(snapshotById.get(noteId)),
      });
    }
    if (prevOpened.length > 0) {
      const avgOpened = prevOpened.reduce((sum, v) => sum + v, 0) / prevOpened.length;
      if (avgOpened >= DECLINE_MIN_AVG_OPENED && curOpened <= avgOpened * DECLINE_DROP_RATIO) {
        decline.push({
          note: name,
          prev3_avg_opened: Math.round(avgOpened * 10) / 10,
          current_opened: curOpened,
          snapshot: noteSnapshotBrief(snapshotById.get(noteId)),
        });
      }
    }
  }
  watch.sort((a, b) => b.opened - a.opened);
  decline.sort((a, b) => (b.prev3_avg_opened - b.current_opened) - (a.prev3_avg_opened - a.current_opened));
  const watchTop = watch.slice(0, NOTE_TOP_LIMIT);
  const declining = decline.slice(0, NOTE_DECLINE_LIMIT);
  const watchNames = new Set(watchTop.map((item) => item.note));

  const stop = snapRows
    .filter((row) => (row.cost || 0) >= STOP_MIN_COST && row.adds <= STOP_MAX_ADDS
      && !watchNames.has(clipTitle(row.title)))
    .map((row) => ({
      note: clipTitle(row.title), cost: row.cost, impressions: row.impressions,
      ctr: row.ctr, adds: row.adds, accounts: row.accounts,
    }))
    .sort((a, b) => (b.cost || 0) - (a.cost || 0))
    .slice(0, NOTE_STOP_LIMIT);

  const types = new Map<string, { notes: number; impressions: number; ctr_sum: number; ctr_n: number; dm: number; adds: number; accounts: number; cost: number }>();
  for (const row of snapRows) {
    const kind = (row.type || '').trim() || '未分类';
    let bucket = types.get(kind);
    if (!bucket) {
      bucket = { notes: 0, impressions: 0, ctr_sum: 0, ctr_n: 0, dm: 0, adds: 0, accounts: 0, cost: 0 };
      types.set(kind, bucket);
    }
    bucket.notes += 1;
    bucket.impressions += row.impressions;
    if (row.ctr !== null) {
      bucket.ctr_sum += row.ctr;
      bucket.ctr_n += 1;
    }
    bucket.dm += row.dm;
    bucket.adds += row.adds;
    bucket.accounts += row.accounts;
    bucket.cost += row.cost || 0;
  }
  const contentTypes: NoteTypeAgg[] = [...types.entries()]
    .sort((a, b) => b[1].adds - a[1].adds)
    .map(([type, vals]) => ({
      type,
      notes: vals.notes,
      impressions: vals.impressions,
      avg_ctr: vals.ctr_n ? ratio(vals.ctr_sum, vals.ctr_n) : null,
      dm: vals.dm,
      adds: vals.adds,
      accounts: vals.accounts,
      cost: num4(vals.cost),
    }));

  const newNotes: NoteNewItem[] = snapRows
    .filter((row) => String(row.published ?? '').startsWith(month))
    .map((row) => ({
      note: clipTitle(row.title),
      type: row.type || '未分类',
      published: String(row.published ?? '').slice(0, 10),
      impressions: row.impressions,
      ctr: row.ctr,
      adds: row.adds,
      accounts: row.accounts,
      cost: row.cost,
    }))
    .sort((a, b) => b.adds - a.adds)
    .slice(0, NOTE_NEW_LIMIT);

  return {
    watch_top: watchTop,
    declining,
    stop_candidates: stop,
    content_types: contentTypes,
    new_notes: newNotes,
    snapshot_note_count: snapRows.length,
    conversion_tracked_note_count: trend.size,
  };
}

// ============================================================
// 应用市场经营（fact_conv_appmarket × dim_ad_plan_class）
// ============================================================

// 获客口径：漏斗只看互联网引流（对齐 _funnel_filters；新开户是末段指标不过滤）
const APPMARKET_INTERNET_FILTER = `"渠道类型" = '互联网引流'`;

function appmarketStoreExpr(alias = ''): string {
  return `COALESCE(LOWER(NULLIF(${alias}"应用市场", '')), '未知')`;
}

/** 商店×月漏斗聚合（下载→激活→注册→完资金账号→开户成功→新开户→入金→有效户 + 资产/创收） */
async function fetchAppmarketStoreMonthly(months: string[]): Promise<StoreMonthlyRow[]> {
  const storeExpr = appmarketStoreExpr();
  const sql = `SELECT ${storeExpr} AS store,
      substr("下载日期", 1, 7) AS month,
      COUNT(*) AS downloads,
      SUM(CASE WHEN "是否激活APP" = 1 THEN 1 ELSE 0 END) AS activated,
      SUM(CASE WHEN "是否开户注册" = 1 THEN 1 ELSE 0 END) AS registered,
      SUM(CASE WHEN "是否创建完资金账号" = 1 THEN 1 ELSE 0 END) AS funded,
      SUM(CASE WHEN "是否开户成功" = 1 THEN 1 ELSE 0 END) AS opened_accounts,
      SUM(CASE WHEN "是否新开户" = 1 THEN 1 ELSE 0 END) AS new_accounts,
      SUM(CASE WHEN "是否入金" = 1 THEN 1 ELSE 0 END) AS deposited,
      SUM(CASE WHEN "是否有效户" = 1 THEN 1 ELSE 0 END) AS eff_accounts,
      SUM("总资产") AS asset,
      SUM("累计创收") AS revenue
    FROM fact_conv_appmarket
    WHERE substr("下载日期", 1, 7) IN (?, ?, ?, ?) AND ${APPMARKET_INTERNET_FILTER}
    GROUP BY ${storeExpr}, substr("下载日期", 1, 7)`;
  const rows = await querySql<Row>(sql, months);
  return rows.map((r) => ({
    store: String(r.store ?? ''),
    month: String(r.month ?? ''),
    downloads: toIntSafe(r.downloads),
    activated: toIntSafe(r.activated),
    registered: toIntSafe(r.registered),
    funded: toIntSafe(r.funded),
    opened_accounts: toIntSafe(r.opened_accounts),
    new_accounts: toIntSafe(r.new_accounts),
    deposited: toIntSafe(r.deposited),
    eff_accounts: toIntSafe(r.eff_accounts),
    asset: num4(r.asset),
    revenue: num4(r.revenue),
  }));
}

function storeSide(bucket: FunnelAccum): StoreSide {
  return {
    ...bucket,
    activation_rate: ratio(bucket.activated, bucket.downloads),
    new_account_rate: ratio(bucket.new_accounts, bucket.downloads),
    asset_per_new_account: ratio(bucket.asset, bucket.new_accounts),
    revenue_per_new_account: ratio(bucket.revenue, bucket.new_accounts),
  };
}

/** 当月：商店×版位 漏斗聚合（fact_conv_appmarket JOIN dim_ad_plan_class） */
async function fetchAppmarketPlacement(month: string): Promise<PlacementRow[]> {
  const storeExpr = appmarketStoreExpr('f.');
  const placementExpr = `COALESCE(NULLIF(d."版位", ''), '未分类')`;
  const sql = `SELECT ${storeExpr} AS store,
      ${placementExpr} AS placement,
      COUNT(*) AS downloads,
      SUM(CASE WHEN f."是否新开户" = 1 THEN 1 ELSE 0 END) AS new_accounts,
      SUM(f."总资产") AS asset,
      SUM(f."累计创收") AS revenue
    FROM fact_conv_appmarket f
    INNER JOIN dim_ad_plan_class d ON f."广告计划ID" = d."广告分组ID"
    WHERE substr(f."下载日期", 1, 7) = ? AND f."渠道类型" = '互联网引流'
    GROUP BY ${storeExpr}, ${placementExpr}`;
  const rows = await querySql<Row>(sql, [month]);
  return rows.map((r) => ({
    store: String(r.store ?? ''),
    placement: String(r.placement ?? ''),
    downloads: toIntSafe(r.downloads),
    new_accounts: toIntSafe(r.new_accounts),
    asset: num4(r.asset),
    revenue: num4(r.revenue),
  }));
}

/** 当月：广告计划（分组名称）下载 TOP，用于计划级关注建议 */
async function fetchAppmarketPlansTop(month: string): Promise<PlanRow[]> {
  const storeExpr = appmarketStoreExpr('f.');
  const planExpr = `COALESCE(NULLIF(d."广告分组名称", ''), '未命名计划')`;
  const sql = `SELECT ${storeExpr} AS store,
      ${planExpr} AS plan,
      COUNT(*) AS downloads,
      SUM(CASE WHEN f."是否新开户" = 1 THEN 1 ELSE 0 END) AS new_accounts
    FROM fact_conv_appmarket f
    INNER JOIN dim_ad_plan_class d ON f."广告计划ID" = d."广告分组ID"
    WHERE substr(f."下载日期", 1, 7) = ? AND f."渠道类型" = '互联网引流'
    GROUP BY ${storeExpr}, ${planExpr}`;
  const rows = await querySql<Row>(sql, [month]);
  return rows
    .map((r) => ({
      store: String(r.store ?? ''),
      plan: String(r.plan ?? '').slice(0, TITLE_MAX_LEN),
      downloads: toIntSafe(r.downloads),
      new_accounts: toIntSafe(r.new_accounts),
    }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, PLAN_TOP_LIMIT);
}

/** 商店漏斗当月 vs 前 3 月 + 版位潜力/需关注 + 计划 TOP */
function buildAppmarketEvidence(
  month: string,
  storeRows: StoreMonthlyRow[],
  placementRows: PlacementRow[],
  planRows: PlanRow[],
): AppmarketPackage {
  const agg = new Map<string, { current: FunnelAccum; prev3: FunnelAccum }>();
  for (const row of storeRows) {
    let bucket = agg.get(row.store);
    if (!bucket) {
      bucket = { current: zeroFunnelAccum(), prev3: zeroFunnelAccum() };
      agg.set(row.store, bucket);
    }
    const side = row.month === month ? bucket.current : bucket.prev3;
    for (const field of APPMARKET_ACCUM_FIELDS) side[field] += row[field] ?? 0;
  }
  const stores = [...agg.entries()]
    .sort((a, b) => b[1].current.downloads - a[1].current.downloads)
    .map(([store, bucket]) => ({
      store,
      current: storeSide(bucket.current),
      prev3: storeSide(bucket.prev3),
    }));

  const potential = [...placementRows]
    .sort((a, b) => b.new_accounts - a.new_accounts)
    .slice(0, PLACEMENT_TOP_LIMIT);
  const watchlist = placementRows
    .filter((row) => row.downloads >= 30)
    .sort((a, b) => (ratio(a.new_accounts, a.downloads) || 0) - (ratio(b.new_accounts, b.downloads) || 0))
    .slice(0, PLACEMENT_BOTTOM_LIMIT);

  return {
    stores,
    placement_potential: potential,
    placement_watchlist: watchlist,
    plans_top: planRows,
  };
}

// ============================================================
// 入口
// ============================================================

/** 组装三包业务证据；单包取数失败降级为 null（SYSTEM_PROMPT 会说明缺失时不解读） */
export async function buildBusinessEvidence(month: string): Promise<BusinessEvidence> {
  const months = trendMonthsOf(month);
  const packages: BusinessEvidence = { vendor: null, note: null, appmarket: null };
  try {
    packages.vendor = buildVendorEvidence(month, await fetchVendorMonthly(months));
  } catch (e) {
    console.warn(`[llmEvidence] vendor 证据包构建失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    packages.note = buildNoteEvidence(
      month, await fetchNoteConversionMonthly(months), await fetchNoteSnapshot());
  } catch (e) {
    console.warn(`[llmEvidence] note 证据包构建失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    packages.appmarket = buildAppmarketEvidence(
      month,
      await fetchAppmarketStoreMonthly(months),
      await fetchAppmarketPlacement(month),
      await fetchAppmarketPlansTop(month),
    );
  } catch (e) {
    console.warn(`[llmEvidence] appmarket 证据包构建失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  return packages;
}
