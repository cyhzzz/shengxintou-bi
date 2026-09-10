/**
 * 移动端本地路由处理器 —— 智能辅助诊断（数据健康度按月体检）
 *
 * 逐字移植自 backend/utils/diagnosis/{metrics,rules,engine}.py：
 * 20 个阈值常量、11 条规则、输出契约（month/generated_at/snapshot_dates/summary/items）
 * 与 Flask 后端 /api/v1/reports/diagnosis 完全同口径；仅 date（today）涉及时钟，
 * 其余窗口全部由数据快照日推导，保证跨端口径一致。
 *
 * 业务不变式（与后端一致）：
 * - 应用市场真实获客：强制 渠道类型 = '互联网引流'
 * - 内容平台非存量：是否为存量客户 = 0 OR IS NULL
 * - 只做 SELECT/SUM/GROUP BY 聚合，不输出任何设备/线索级明细
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, parseQueryParams, type Row } from './shared';

// ==== 阈值常量（与 backend/utils/diagnosis/rules.py 逐字对齐）====

const MATURITY_DAYS = 7;
const COLLAPSE_MIN_RUN = 3;
const COLLAPSE_RATIO = 0.5;
const COLLAPSE_MIN_DAILY = 5;
const OPEN_MOM_WARN = 0.7;
const OPEN_MOM_ERROR = 0.5;
const OPEN_ABS_LOW = 0.3;
const VALID_DROP_WARN = 0.2;
const STOCK_MIX_WARN = 0.05;
const FUNNEL_DROP_WARN = 0.3;
const FUNNEL_DROP_ERROR = 0.5;
const DEVICE_SHARE_WARN = 0.10;
const DEVICE_SHARE_ERROR = 0.03;
const ASSETS_DROP_WARN = 0.4;
const FRESH_WARN_DAYS = 5;
const FRESH_ERROR_DAYS = 14;
const ALIGN_MAX_SPREAD = 3;
const STALLED_GAP_DAYS = 14;
const STALLED_MIN_LEADS = 20;
const STALLED_WINDOW_DAYS = 60;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CHAIN_KEYS = ['xhs', 'appmarket', 'global'] as const;
const LEVEL_RANK: Record<Level, number> = { error: 0, warn: 1, info: 2 };
const CHAIN_RANK: Record<Chain, number> = { appmarket: 0, global: 1, xhs: 2 };
const STATUS_RANK: Record<Status, number> = { ok: 0, info: 1, warn: 2, error: 3 };

const FUNNEL_STEPS: Array<[keyof MonthlyAppmarket, keyof MonthlyAppmarket, string]> = [
  ['activated', 'downloads', '激活/下载'],
  ['registered', 'activated', '注册/激活'],
  ['account_created', 'registered', '完资金账号/注册'],
];

// ==== 类型 ====

type Level = 'error' | 'warn' | 'info';
type Chain = 'appmarket' | 'global' | 'xhs';
type Status = 'ok' | Level;

interface SnapshotItem { key: string; name: string; latest: string | null; days_ago: number | null; }
interface MonthlyContent { total: number; opened: number; valid: number; stock: number; }
interface MonthlyAppmarket {
  downloads: number; activated: number; registered: number; account_created: number;
  devices: number; new_accounts: number; new_assets: number;
}
interface DailyContent { date: Date; total: number; opened: number; valid: number; }
interface PlatformActivity { platform: string; leads: number; last_date: string | null; }
interface DiagnosisItem {
  id: string; chain: Chain; level: Level;
  title: string; detail: string; evidence: string; suggestion: string;
}
interface ChainSummary { error: number; warn: number; info: number; status: Status; }
interface DiagnosisSummary { overall: Status; chains: Record<Chain, ChainSummary>; }
export interface DiagnosisResult {
  month: string; generated_at: string;
  snapshot_dates: SnapshotItem[]; summary: DiagnosisSummary; items: DiagnosisItem[];
}
interface DiagnosisCtx {
  month: string; prev_month: string;
  snapshot_dates: SnapshotItem[];
  snapshot_min: Date | null; snapshot_max: Date | null; eval_cutoff: Date | null;
  content_monthly: Record<string, MonthlyContent>;
  appmarket_monthly: Record<string, MonthlyAppmarket>;
  content_daily: DailyContent[];
  platform_activity: PlatformActivity[];
  cur_mature: { total: number; opened: number; valid: number };
  prev_window: { total: number; opened: number; valid: number };
}

// ==== 日期与格式化辅助（全部使用本地时区，显式 getTime 比较）====

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const text = String(value).slice(0, 10);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function localNowIsoSeconds(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
    + `T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${pad2((total % 12) + 1)}`;
}

function rate(numerator: number, denominator: number | null | undefined): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

function pct(value: number, digits: number): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function makeItem(
  itemId: string, chain: Chain, level: Level,
  title: string, detail: string, evidence: string, suggestion: string,
): DiagnosisItem {
  return { id: itemId, chain, level, title, detail, evidence, suggestion };
}

// ==== 取数层（与 backend/utils/diagnosis/metrics.py 逐字对齐）====

const SNAPSHOT_SOURCES = [
  { key: 'agg_vendor_daily', name: '厂商日聚合', column: '日期' },
  { key: 'fact_plan_daily', name: '计划日明细', column: '日期' },
  { key: 'agg_xhs_note', name: '小红书笔记', column: '发布时间' },
  { key: 'fact_conv_content', name: '企微线索明细', column: '线索日期' },
  { key: 'fact_conv_appmarket', name: '应用市场明细', column: '下载日期' },
  { key: 'agg_daily_channel_open', name: '渠道开户聚合', column: '时间区间' },
] as const;

const NON_STOCK = '("是否为存量客户" IS NULL OR "是否为存量客户" = 0)';

async function fetchSnapshotDates(): Promise<SnapshotItem[]> {
  const today = startOfToday();
  const result: SnapshotItem[] = [];
  for (const source of SNAPSHOT_SOURCES) {
    const rows = await querySql<Row>(`SELECT MAX("${source.column}") AS latest FROM "${source.key}"`);
    const latest = rows.length > 0 ? parseDate(rows[0].latest) : null;
    result.push({
      key: source.key,
      name: source.name,
      latest: latest ? toISODate(latest) : null,
      days_ago: latest ? daysBetween(today, latest) : null,
    });
  }
  return result;
}

async function resolveDefaultMonth(): Promise<string> {
  const rows = await querySql<Row>('SELECT MAX("线索日期") AS latest FROM "fact_conv_content"');
  const latest = rows.length > 0 ? rows[0].latest : null;
  if (!latest) return '';
  return String(latest).slice(0, 7);
}

async function fetchContentMonthly(months: string[]): Promise<Record<string, MonthlyContent>> {
  const placeholders = months.map(() => '?').join(', ');
  const rows = await querySql<Row>(
    `SELECT substr("线索日期", 1, 7) AS month,
        COUNT(*) AS total,
        SUM(CASE WHEN ${NON_STOCK} AND "是否客户开口" = 1 THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN ${NON_STOCK} AND "是否有效线索" = 1 THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN "是否为存量客户" = 1 THEN 1 ELSE 0 END) AS stock
      FROM fact_conv_content
      WHERE substr("线索日期", 1, 7) IN (${placeholders})
      GROUP BY substr("线索日期", 1, 7)`,
    months,
  );
  const result: Record<string, MonthlyContent> = {};
  for (const row of rows) {
    result[String(row.month)] = {
      total: toInt(row.total),
      opened: toInt(row.opened),
      valid: toInt(row.valid),
      stock: toInt(row.stock),
    };
  }
  return result;
}

async function fetchContentDaily(month: string): Promise<DailyContent[]> {
  const rows = await querySql<Row>(
    `SELECT "线索日期" AS date,
        COUNT(*) AS total,
        SUM(CASE WHEN ${NON_STOCK} AND "是否客户开口" = 1 THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN ${NON_STOCK} AND "是否有效线索" = 1 THEN 1 ELSE 0 END) AS valid
      FROM fact_conv_content
      WHERE substr("线索日期", 1, 7) = ?
      GROUP BY "线索日期"`,
    [month],
  );
  const result: DailyContent[] = [];
  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;
    result.push({ date, total: toInt(row.total), opened: toInt(row.opened), valid: toInt(row.valid) });
  }
  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

async function fetchPlatformActivity(windowStart: Date): Promise<PlatformActivity[]> {
  const rows = await querySql<Row>(
    `SELECT "平台来源" AS platform,
        COUNT(*) AS leads,
        MAX("线索日期") AS last_date
      FROM fact_conv_content
      WHERE "线索日期" >= ? AND ${NON_STOCK}
        AND "平台来源" IS NOT NULL AND "平台来源" != ''
      GROUP BY "平台来源"`,
    [toISODate(windowStart)],
  );
  const result: PlatformActivity[] = [];
  for (const row of rows) {
    const lastDate = parseDate(row.last_date);
    result.push({
      platform: String(row.platform),
      leads: toInt(row.leads),
      last_date: lastDate ? toISODate(lastDate) : null,
    });
  }
  return result;
}

async function fetchAppmarketMonthly(months: string[]): Promise<Record<string, MonthlyAppmarket>> {
  const placeholders = months.map(() => '?').join(', ');
  const rows = await querySql<Row>(
    `SELECT substr("下载日期", 1, 7) AS month,
        COUNT(*) AS downloads,
        SUM(CASE WHEN "是否激活APP" = 1 THEN 1 ELSE 0 END) AS activated,
        SUM(CASE WHEN "是否开户注册" = 1 THEN 1 ELSE 0 END) AS registered,
        SUM(CASE WHEN "是否创建完资金账号" = 1 THEN 1 ELSE 0 END) AS account_created,
        COUNT(DISTINCT "设备号") AS devices,
        SUM(CASE WHEN "是否新开户" = 1 THEN 1 ELSE 0 END) AS new_accounts,
        SUM(CASE WHEN "是否新开户" = 1 THEN "总资产" ELSE 0 END) AS new_assets
      FROM fact_conv_appmarket
      WHERE substr("下载日期", 1, 7) IN (${placeholders}) AND "渠道类型" = '互联网引流'
      GROUP BY substr("下载日期", 1, 7)`,
    months,
  );
  const result: Record<string, MonthlyAppmarket> = {};
  for (const row of rows) {
    result[String(row.month)] = {
      downloads: toInt(row.downloads),
      activated: toInt(row.activated),
      registered: toInt(row.registered),
      account_created: toInt(row.account_created),
      devices: toInt(row.devices),
      new_accounts: toInt(row.new_accounts),
      new_assets: toFloat(row.new_assets),
    };
  }
  return result;
}

// ==== 规则评估层（与 backend/utils/diagnosis/rules.py 逐字对齐）====

function ruleSnapshotFreshness(ctx: DiagnosisCtx): DiagnosisItem | null {
  const staleError: SnapshotItem[] = [];
  const staleWarn: SnapshotItem[] = [];
  for (const snapshot of ctx.snapshot_dates) {
    const daysAgo = snapshot.days_ago;
    if (daysAgo === null || daysAgo > FRESH_ERROR_DAYS) staleError.push(snapshot);
    else if (daysAgo > FRESH_WARN_DAYS) staleWarn.push(snapshot);
  }
  if (staleError.length === 0 && staleWarn.length === 0) return null;
  const affected = [...staleError, ...staleWarn];
  const lines = affected.map((snapshot) => {
    const daysText = snapshot.days_ago !== null ? String(snapshot.days_ago) : '未知';
    return `${snapshot.name}: 最新 ${snapshot.latest || '无数据'}（${daysText} 天前）`;
  });
  return makeItem(
    'snapshot_freshness', 'global',
    staleError.length > 0 ? 'error' : 'warn',
    '底表快照新鲜度不足',
    `存在超过 ${FRESH_WARN_DAYS} 天未更新的底表，基于旧快照的月度诊断可能低估最新趋势`,
    lines.join('；'),
    '确认上游 ETL 是否正常运行，或等待数据更新后重新生成诊断',
  );
}

function ruleSnapshotAlignment(ctx: DiagnosisCtx): DiagnosisItem | null {
  if (ctx.snapshot_min === null || ctx.snapshot_max === null) return null;
  const spread = daysBetween(ctx.snapshot_max, ctx.snapshot_min);
  if (spread <= ALIGN_MAX_SPREAD) return null;
  const lines = ctx.snapshot_dates.map((snapshot) => `${snapshot.name}: ${snapshot.latest || '无数据'}`);
  return makeItem(
    'snapshot_alignment', 'global', 'warn',
    '底表快照日期不一致',
    `六张底表最新数据日期极差 ${spread} 天（>${ALIGN_MAX_SPREAD} 天），跨表对比可能失真`,
    lines.join('；'),
    '排查更新滞后的底表所属上游链路，对齐各表更新节奏后再复核结论',
  );
}

function ruleMaturityWindow(ctx: DiagnosisCtx): DiagnosisItem | null {
  const snapshotMax = ctx.snapshot_max;
  const evalCutoff = ctx.eval_cutoff;
  if (snapshotMax === null || evalCutoff === null || !ctx.month) return null;
  if (ctx.month !== toISODate(snapshotMax).slice(0, 7)) return null;
  const monthStart = new Date(snapshotMax.getFullYear(), snapshotMax.getMonth(), 1);
  const windowDays = evalCutoff.getTime() < monthStart.getTime()
    ? 0
    : daysBetween(evalCutoff, monthStart) + 1;
  if (windowDays >= MATURITY_DAYS) return null;
  return makeItem(
    'maturity_window', 'global', 'info',
    '当前月份观察窗未成熟',
    `报告月与数据快照同月，成熟观察窗仅 ${windowDays} 天（<${MATURITY_DAYS} 天），本月结论仅供参考`,
    `快照日 ${toISODate(snapshotMax)}，评估窗截止 ${toISODate(evalCutoff)}`,
    '建议在次月快照更新后重新查看本月诊断',
  );
}

function rulePlatformStalled(ctx: DiagnosisCtx): DiagnosisItem | null {
  const platforms = ctx.platform_activity.filter((item) => item.last_date !== null);
  if (platforms.length === 0) return null;
  const dated = platforms
    .map((item) => ({ item, date: parseDate(item.last_date) }))
    .filter((p): p is { item: PlatformActivity; date: Date } => p.date !== null);
  if (dated.length === 0) return null;
  const globalLast = dated.reduce(
    (acc, cur) => (cur.date.getTime() > acc.getTime() ? cur.date : acc),
    dated[0].date,
  );
  const stalled: Array<{ item: PlatformActivity; gap: number }> = [];
  for (const { item, date } of dated) {
    const gap = daysBetween(globalLast, date);
    if (item.leads >= STALLED_MIN_LEADS && gap > STALLED_GAP_DAYS) stalled.push({ item, gap });
  }
  if (stalled.length === 0) return null;
  stalled.sort((a, b) => b.gap - a.gap);
  const lines = stalled.map(
    ({ item, gap }) => `${item.platform}: 最近线索 ${item.last_date}（落后全局 ${gap} 天，近 60 天线索 ${item.leads} 条）`,
  );
  return makeItem(
    'platform_stalled', 'xhs', 'warn',
    '部分内容平台线索停滞',
    `以下平台近 60 天线索量达到统计门槛（≥${STALLED_MIN_LEADS} 条），但最近线索日期落后全局 ${STALLED_GAP_DAYS} 天以上，可能已停投或上游断更`,
    lines.join('；'),
    '与投放同学确认这些平台是否停投；若仍在投则排查线索回传链路',
  );
}

function ruleOpenRateCollapse(ctx: DiagnosisCtx): DiagnosisItem | null {
  const cutoff = ctx.eval_cutoff;
  if (cutoff === null) return null;
  const window = ctx.content_daily.filter((row) => row.date.getTime() <= cutoff.getTime());
  if (window.length === 0) return null;
  const total = window.reduce((sum, row) => sum + row.total, 0);
  const opened = window.reduce((sum, row) => sum + row.opened, 0);
  const baseline = rate(opened, total);
  if (!baseline) return null;
  const threshold = baseline * COLLAPSE_RATIO;
  const failing: DailyContent[] = [];
  for (const row of window) {
    const dayRate = rate(row.opened, row.total);
    if (row.total >= COLLAPSE_MIN_DAILY && dayRate !== null && dayRate < threshold) failing.push(row);
  }
  if (failing.length === 0) return null;
  let longest: DailyContent[] = [];
  let current: DailyContent[] = [failing[0]];
  for (let i = 1; i < failing.length; i++) {
    const prevRow = failing[i - 1];
    const curRow = failing[i];
    if (daysBetween(curRow.date, prevRow.date) === 1) {
      current.push(curRow);
    } else {
      if (current.length > longest.length) longest = current;
      current = [curRow];
    }
  }
  if (current.length > longest.length) longest = current;
  if (longest.length < COLLAPSE_MIN_RUN) return null;
  const shown = longest.slice(0, 8);
  let rates = shown
    .map((row) => `${toISODate(row.date)} ${row.opened}/${row.total}=${pct(row.opened / row.total, 1)}`)
    .join('、');
  if (longest.length > shown.length) rates += ` 等 ${longest.length} 天`;
  return makeItem(
    'open_rate_collapse', 'xhs', 'error',
    '开口率连续塌陷',
    `评估窗内开口率连续 ${longest.length} 个自然日低于当月基线的 ${pct(COLLAPSE_RATIO, 0)}，通常为上游开口状态回写缺失或投放素材异常`,
    `当月基线 ${pct(baseline, 1)}，塌陷区间 ${toISODate(longest[0].date)} 至 ${toISODate(longest[longest.length - 1].date)}；${rates}`,
    '先核对上游 ETL 是否漏更「是否客户开口」状态，再与投放确认素材与链路',
  );
}

function ruleOpenRateLevel(ctx: DiagnosisCtx): DiagnosisItem | null {
  const cur = ctx.cur_mature;
  const prev = ctx.prev_window;
  const curRate = rate(cur.opened, cur.total);
  const prevRate = rate(prev.opened, prev.total);
  if (curRate === null || !prevRate) return null;
  const ratio = curRate / prevRate;
  if (ratio >= OPEN_MOM_WARN) return null;
  let level: Level = ratio < OPEN_MOM_ERROR ? 'error' : 'warn';
  if (curRate < OPEN_ABS_LOW && ratio < 1) level = 'error';
  return makeItem(
    'open_rate_level', 'xhs', level,
    '开口率环比明显下降',
    `成熟观察窗（快照日 −${MATURITY_DAYS} 天，与上月同窗口对齐）开口率为上期的 ${pct(ratio, 0)}（阈值 warn <${pct(OPEN_MOM_WARN, 0)} / error <${pct(OPEN_MOM_ERROR, 0)}）`,
    `本期 ${pct(curRate, 1)}（${cur.total} 条线索） vs 上期同窗口 ${pct(prevRate, 1)}（${prev.total} 条线索）`,
    '结合 open_rate_collapse 与上游回写情况判断是数据问题还是真实转化恶化',
  );
}

function ruleValidLeadQuality(ctx: DiagnosisCtx): DiagnosisItem | null {
  const cur = ctx.cur_mature.valid;
  const prev = ctx.prev_window.valid;
  if (prev <= 0) return null;
  const drop = (prev - cur) / prev;
  if (drop <= VALID_DROP_WARN) return null;
  return makeItem(
    'valid_lead_quality', 'xhs', 'warn',
    '有效线索量环比下降',
    `成熟观察窗内有效线索较上月同窗口下降 ${pct(drop, 0)}（阈值 >${pct(VALID_DROP_WARN, 0)}）`,
    `本期 ${cur} 条 vs 上期同窗口 ${prev} 条`,
    '区分上游标记缺失与真实线索质量下滑；必要时抽样核对原始明细',
  );
}

function ruleStockMix(ctx: DiagnosisCtx): DiagnosisItem | null {
  const monthly = ctx.content_monthly[ctx.month];
  if (!monthly || monthly.total <= 0) return null;
  const ratio = monthly.stock / monthly.total;
  if (ratio <= STOCK_MIX_WARN) return null;
  return makeItem(
    'stock_mix', 'xhs', 'warn',
    '存量客户混入内容平台线索',
    `本月内容平台线索中存量客户占比 ${pct(ratio, 1)}（阈值 >${pct(STOCK_MIX_WARN, 0)}），违反「内容平台非存量」口径`,
    `存量 ${monthly.stock} 条 / 全部 ${monthly.total} 条`,
    '检查上游 ETL 的存量过滤逻辑是否失效',
  );
}

function ruleFunnelStepAnomaly(ctx: DiagnosisCtx): DiagnosisItem | null {
  const cur = ctx.appmarket_monthly[ctx.month];
  const prev = ctx.appmarket_monthly[ctx.prev_month];
  if (!cur || !prev) return null;
  const details: string[] = [];
  let worstLevel: Level | null = null;
  for (const [numeratorKey, denominatorKey, label] of FUNNEL_STEPS) {
    const curRate = rate(cur[numeratorKey], cur[denominatorKey]);
    const prevRate = rate(prev[numeratorKey], prev[denominatorKey]);
    if (curRate === null || !prevRate) continue;
    const drop = (prevRate - curRate) / prevRate;
    if (drop <= FUNNEL_DROP_WARN) continue;
    const level: Level = drop > FUNNEL_DROP_ERROR ? 'error' : 'warn';
    if (worstLevel === null || LEVEL_RANK[level] < LEVEL_RANK[worstLevel]) worstLevel = level;
    details.push(`${label}: ${pct(prevRate, 1)} -> ${pct(curRate, 1)}（相对降幅 ${pct(drop, 0)}）`);
  }
  if (details.length === 0 || worstLevel === null) return null;
  return makeItem(
    'funnel_step_anomaly', 'appmarket', worstLevel,
    '应用市场漏斗环节异常',
    `以下漏斗转化率环比相对降幅超过 ${pct(FUNNEL_DROP_WARN, 0)}（error 阈值 >${pct(FUNNEL_DROP_ERROR, 0)}）`,
    details.join('；'),
    '结合 new_device_share 判断是流量结构变化还是落地链路问题',
  );
}

function ruleNewDeviceShare(ctx: DiagnosisCtx): DiagnosisItem | null {
  const monthly = ctx.appmarket_monthly[ctx.month];
  if (!monthly || monthly.downloads <= 0) return null;
  const share = monthly.devices / monthly.downloads;
  if (share >= DEVICE_SHARE_WARN) return null;
  const level: Level = share < DEVICE_SHARE_ERROR ? 'error' : 'warn';
  return makeItem(
    'new_device_share', 'appmarket', level,
    '应用市场新设备占比偏低',
    `本月下载中独立新设备占比 ${pct(share, 1)}，重复设备下载占比过高，获客真实性存疑（阈值 warn <${pct(DEVICE_SHARE_WARN, 0)} / error <${pct(DEVICE_SHARE_ERROR, 0)}）`,
    `独立设备 ${monthly.devices} / 下载 ${monthly.downloads} = ${pct(share, 2)}`,
    '与投放渠道核对是否重复归因或刷量，必要时按设备明细抽样核查',
  );
}

function ruleNewAssetsYield(ctx: DiagnosisCtx): DiagnosisItem | null {
  const cur = ctx.appmarket_monthly[ctx.month];
  const prev = ctx.appmarket_monthly[ctx.prev_month];
  if (!cur || !prev || cur.account_created <= 0) return null;
  const curYield = rate(cur.new_assets, cur.account_created);
  const prevYield = rate(prev.new_assets, prev.account_created);
  if (curYield === null || !prevYield) return null;
  const drop = (prevYield - curYield) / prevYield;
  if (drop <= ASSETS_DROP_WARN) return null;
  return makeItem(
    'new_assets_yield', 'appmarket', 'warn',
    '新开户户均资产环比下降',
    `新开户人均资产较上月下降 ${pct(drop, 0)}（阈值 >${pct(ASSETS_DROP_WARN, 0)}）；新客群资产随观察时长自然增长，需区分成熟度效应`,
    `本期 ${Math.round(curYield)} 元/户 vs 上期 ${Math.round(prevYield)} 元/户`,
    '核对是否入金率下降或新客群质量变化；可对比历史月份同类降幅判断是否为季节性',
  );
}

const RULES: Array<(ctx: DiagnosisCtx) => DiagnosisItem | null> = [
  ruleSnapshotFreshness,
  ruleSnapshotAlignment,
  ruleMaturityWindow,
  rulePlatformStalled,
  ruleOpenRateCollapse,
  ruleOpenRateLevel,
  ruleValidLeadQuality,
  ruleStockMix,
  ruleFunnelStepAnomaly,
  ruleNewDeviceShare,
  ruleNewAssetsYield,
];

function buildItems(ctx: DiagnosisCtx): DiagnosisItem[] {
  const items: DiagnosisItem[] = [];
  for (const rule of RULES) {
    const item = rule(ctx);
    if (item) items.push(item);
  }
  items.sort((a, b) => {
    const levelDiff = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
    if (levelDiff !== 0) return levelDiff;
    const chainDiff = CHAIN_RANK[a.chain] - CHAIN_RANK[b.chain];
    if (chainDiff !== 0) return chainDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return items;
}

// ==== 编排层（与 backend/utils/diagnosis/engine.py 逐字对齐）====

function buildSummary(items: DiagnosisItem[]): DiagnosisSummary {
  const chains = {} as Record<Chain, ChainSummary>;
  for (const key of CHAIN_KEYS) {
    const counts: ChainSummary = { error: 0, warn: 0, info: 0, status: 'ok' };
    for (const item of items) {
      if (item.chain === key) counts[item.level] += 1;
    }
    for (const level of ['error', 'warn', 'info'] as Level[]) {
      if (counts[level] > 0) {
        counts.status = level;
        break;
      }
    }
    chains[key] = counts;
  }
  let overall: Status = 'ok';
  for (const key of CHAIN_KEYS) {
    if (STATUS_RANK[chains[key].status] > STATUS_RANK[overall]) overall = chains[key].status;
  }
  return { overall, chains };
}

function emptyResult(month: string, snapshotDates: SnapshotItem[] | null = null): DiagnosisResult {
  return {
    month,
    generated_at: localNowIsoSeconds(),
    snapshot_dates: snapshotDates || [],
    summary: buildSummary([]),
    items: [],
  };
}

export async function runDiagnosis(monthInput?: string): Promise<DiagnosisResult> {
  let month = monthInput;
  if (!month) {
    month = await resolveDefaultMonth();
    if (!month) return emptyResult('');
  }
  if (!MONTH_RE.test(month)) {
    throw new Error('month 参数格式必须为 YYYY-MM');
  }

  const snapshotDates = await fetchSnapshotDates();
  const dated = snapshotDates
    .map((item) => parseDate(item.latest))
    .filter((d): d is Date => d !== null);
  const snapshotMax = dated.length > 0
    ? new Date(Math.max(...dated.map((d) => d.getTime())))
    : null;
  const snapshotMin = dated.length > 0
    ? new Date(Math.min(...dated.map((d) => d.getTime())))
    : null;
  const evalCutoff = snapshotMax ? addDays(snapshotMax, -MATURITY_DAYS) : null;

  const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
  const contentMonthly = await fetchContentMonthly(months);
  const appmarketMonthly = await fetchAppmarketMonthly(months);

  const current = contentMonthly[month] || { total: 0, opened: 0, valid: 0, stock: 0 };
  const currentAppmarket = appmarketMonthly[month] || { downloads: 0 };
  if (current.total === 0 && currentAppmarket.downloads === 0) {
    return emptyResult(month, snapshotDates);
  }

  const contentDaily = await fetchContentDaily(month);
  const prevContentDaily = await fetchContentDaily(shiftMonth(month, -1));
  const windowStart = snapshotMax ? addDays(snapshotMax, -STALLED_WINDOW_DAYS) : null;
  const platformActivity = windowStart ? await fetchPlatformActivity(windowStart) : [];

  let matureRows: DailyContent[] = [];
  let prevRows: DailyContent[] = [];
  if (evalCutoff) {
    matureRows = contentDaily.filter((row) => row.date.getTime() <= evalCutoff.getTime());
    prevRows = prevContentDaily.filter((row) => row.date.getDate() <= evalCutoff.getDate());
  }
  const curMature = {
    total: matureRows.reduce((sum, row) => sum + row.total, 0),
    opened: matureRows.reduce((sum, row) => sum + row.opened, 0),
    valid: matureRows.reduce((sum, row) => sum + row.valid, 0),
  };
  const prevWindow = {
    total: prevRows.reduce((sum, row) => sum + row.total, 0),
    opened: prevRows.reduce((sum, row) => sum + row.opened, 0),
    valid: prevRows.reduce((sum, row) => sum + row.valid, 0),
  };

  const ctx: DiagnosisCtx = {
    month,
    prev_month: shiftMonth(month, -1),
    snapshot_dates: snapshotDates,
    snapshot_min: snapshotMin,
    snapshot_max: snapshotMax,
    eval_cutoff: evalCutoff,
    content_monthly: contentMonthly,
    appmarket_monthly: appmarketMonthly,
    content_daily: contentDaily,
    platform_activity: platformActivity,
    cur_mature: curMature,
    prev_window: prevWindow,
  };
  const items = buildItems(ctx);
  return {
    month,
    generated_at: localNowIsoSeconds(),
    snapshot_dates: snapshotDates,
    summary: buildSummary(items),
    items,
  };
}

export async function handleDiagnosis(url: string): Promise<DiagnosisResult> {
  const month = parseQueryParams(url).month;
  return runDiagnosis(month || undefined);
}
