/**
 * 移动端本地路由处理器 —— 周报 (reports/weekly/*)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, dateClause, inClause, buildWhere, type Row } from './shared';
import { handleAnchorClusters } from './leads';
// ============================================================================
// 周报（reports/weekly/*）— 移植自 backend/routes/weekly_reports.py
// ============================================================================

// 应用市场渠道名称集合（与后端 APP_MARKET_CHANNELS 一致）
const WEEKLY_APP_MARKET_CHANNELS = ['华为', '荣耀', '小米', 'oppo', 'vivo', '苹果', '鸿蒙'];

// 渠道名称 → 渠道类别映射（与后端 weekly_reports.py 一致）
const WEEKLY_CHANNEL_CATEGORY_MAP: Record<string, string> = {
  小红书: '内容平台', 腾讯: '内容平台', 抖音: '内容平台',
  快手: '内容平台', 财联社: '内容平台', yj: '内容平台',
  云极: '内容平台', 其他: '内容平台',
  华为: '应用市场', 荣耀: '应用市场', 小米: '应用市场',
  oppo: '应用市场', vivo: '应用市场', 苹果: '应用市场', 鸿蒙: '应用市场',
  高德: '本地生活',
};

const KPI_TARGETS = { opens: 20000, valid: 10000, assets: 5_0000_0000 };

/** 根据周五日期计算周信息（移植自 weekly_utils.get_week_info） */
function getWeekInfo(friday: Date): {
  report_year: number; report_month: number; report_week: number;
  report_month_week: number; start_date: string; end_date: string;
  report_name: string; date_range: string; report_sequence: number;
} {
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);

  const year = friday.getFullYear();
  const month = friday.getMonth() + 1;

  // 计算该年第一个周五
  const jan1 = new Date(year, 0, 1);
  const wJan1 = jan1.getDay(); // 0=Sun, 5=Fri
  const weekdayMonToFri = wJan1 === 0 ? 6 : wJan1 - 1; // 0=Mon..6=Sun
  const daysToFirstFriday = weekdayMonToFri <= 4 ? (4 - weekdayMonToFri) : (4 + (7 - weekdayMonToFri));
  const firstFriday = new Date(jan1);
  firstFriday.setDate(jan1.getDate() + daysToFirstFriday);

  const daysDiff = Math.round((friday.getTime() - firstFriday.getTime()) / 86400000);
  const report_week = Math.floor(daysDiff / 7) + 1;

  // 月内第几周
  const month1 = new Date(year, month - 1, 1);
  const wMonth1 = month1.getDay();
  const wdMonToFri2 = wMonth1 === 0 ? 6 : wMonth1 - 1;
  const daysToFirstFridayMonth = wdMonToFri2 <= 4 ? (4 - wdMonToFri2) : (4 + (7 - wdMonToFri2));
  const firstFridayMonth = new Date(month1);
  firstFridayMonth.setDate(month1.getDate() + daysToFirstFridayMonth);

  const daysDiffMonth = Math.round((friday.getTime() - firstFridayMonth.getTime()) / 86400000);
  const report_month_week = Math.floor(daysDiffMonth / 7) + 1;

  const pad = (n: number) => String(n).padStart(2, '0');
  const start_date = `${friday.getFullYear()}-${pad(friday.getMonth() + 1)}-${pad(friday.getDate())}`;
  const end_date = `${thursday.getFullYear()}-${pad(thursday.getMonth() + 1)}-${pad(thursday.getDate())}`;
  const date_range = `${pad(friday.getMonth() + 1)}/${pad(friday.getDate())}-${pad(thursday.getMonth() + 1)}/${pad(thursday.getDate())}`;
  const report_name = `${year}年${pad(month)}月第${report_month_week}周(${date_range})`;

  return {
    report_year: year, report_month: month, report_week,
    report_month_week, start_date, end_date, report_name, date_range,
    report_sequence: report_week,
  };
}

/** 获取指定年份所有周五日期（移植自 weekly_utils.get_all_fridays_in_year） */
function getAllFridaysInYear(year: number): Date[] {
  const fridays: Date[] = [];
  const jan1 = new Date(year, 0, 1);
  const wJan1 = jan1.getDay();
  const weekdayMonToFri = wJan1 === 0 ? 6 : wJan1 - 1;
  const daysToFirstFriday = weekdayMonToFri <= 4 ? (4 - weekdayMonToFri) : (4 + (7 - weekdayMonToFri));
  const current = new Date(jan1);
  current.setDate(jan1.getDate() + daysToFirstFriday);

  while (current.getFullYear() === year) {
    fridays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return fridays;
}

/** 生成最近 N 周选项（移植自 weekly_utils.generate_week_options） */
function generateWeekOptions(weeksCount = 12): any[] {
  const options: any[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  const allFridays = [...getAllFridaysInYear(currentYear - 1), ...getAllFridaysInYear(currentYear)];

  let currentIndex = -1;
  for (let i = 0; i < allFridays.length; i++) {
    const thursday = new Date(allFridays[i]);
    thursday.setDate(allFridays[i].getDate() + 6);
    if (allFridays[i] <= today && today <= thursday) {
      currentIndex = i;
      break;
    }
  }
  if (currentIndex === -1) {
    for (let i = allFridays.length - 1; i >= 0; i--) {
      if (allFridays[i] < today) {
        currentIndex = i;
        break;
      }
    }
  }
  if (currentIndex === -1) currentIndex = allFridays.length - 1;

  const startIndex = Math.max(0, currentIndex - weeksCount + 1);
  const endIndex = currentIndex + 1;

  for (let i = startIndex; i < endIndex; i++) {
    if (i >= allFridays.length) break;
    const friday = allFridays[i];
    const wi = getWeekInfo(friday);
    const thursday = new Date(friday);
    thursday.setDate(friday.getDate() + 6);
    const isWeekEnded = today > thursday;

    options.push({
      value: `${wi.report_year}-${String(wi.report_week).padStart(2, '0')}`,
      label: wi.report_name,
      sequence: wi.report_sequence,
      disabled: !isWeekEnded,
      disabled_reason: isWeekEnded ? undefined : '本周报告（未结束，不可选）',
      ...wi,
    });
  }

  options.reverse();
  return options;
}

/** 查询某时间区间的核心指标（移植自 weekly_reports._query_metrics） */
async function queryWeeklyMetrics(sd: string, ed: string): Promise<any> {
  // 1. agg_vendor_daily: cost / impressions / leads_app / assets
  const adSql = `SELECT
      COALESCE(SUM("花费"), 0) as cost,
      COALESCE(SUM("展示量"), 0) as impressions,
      COALESCE(SUM("APP激活人数"), 0) as leads_app,
      COALESCE(SUM("客户资产"), 0) as assets
    FROM agg_vendor_daily WHERE "日期" >= ? AND "日期" <= ?`;
  const adRows = await querySql<Row>(adSql, [sd, ed]);
  const ad = adRows[0] || {};

  // 2. fact_conv_content COUNT(*): leads_wx
  const wxSql = `SELECT COUNT(*) as c FROM fact_conv_content
    WHERE "线索日期" >= ? AND "线索日期" <= ?`;
  const wxRows = await querySql<Row>(wxSql, [sd, ed]);
  const leads_wx = toInt(wxRows[0]?.c);

  // 3. agg_daily_channel_open WHERE 渠道类别='互联网引流': opens, valid
  const chSql = `SELECT
      COALESCE(SUM("开户成功人数"), 0) as opens,
      COALESCE(SUM("有效户数"), 0) as valid
    FROM agg_daily_channel_open
    WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?`;
  const chRows = await querySql<Row>(chSql, [sd, ed]);
  const opens_total = toInt(chRows[0]?.opens);
  const valid = toInt(chRows[0]?.valid);

  // 4. 应用市场开户数（互联网引流里渠道名称属于应用市场大类的部分）
  const placeholders = WEEKLY_APP_MARKET_CHANNELS.map(() => '?').join(', ');
  const appSql = `SELECT COALESCE(SUM("开户成功人数"), 0) as v
    FROM agg_daily_channel_open
    WHERE "渠道类别" = '互联网引流'
      AND "渠道名称" IN (${placeholders})
      AND "时间区间" >= ? AND "时间区间" <= ?`;
  const appRows = await querySql<Row>(appSql, [...WEEKLY_APP_MARKET_CHANNELS, sd, ed]);
  const opens_app = toInt(appRows[0]?.v);

  return {
    cost: toFloat(ad.cost),
    impressions: toInt(ad.impressions),
    leads_wx,
    leads_app: toInt(ad.leads_app),
    opens_app,
    opens_other: opens_total - opens_app,
    opens: opens_total,
    valid,
    assets: toFloat(ad.assets),
  };
}

/** 计算环比百分比 */
function calcWow(curr: number, prev: number): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 10000) / 100;
}

/** 安全除法 */
function safeDiv(num: number, den: number, pct = false): number {
  if (!den) return 0;
  const r = num / den;
  return pct ? Math.round(r * 10000) / 100 : Math.round(r * 10000) / 10000;
}

/** GET /reports/weekly/periods — 生成最近 12 周选项 */
export async function handleWeeklyPeriods(): Promise<any[]> {
  return generateWeekOptions(12);
}

/** POST /reports/weekly/data — 纯数据周报 */
export async function handleWeeklyData(body: any): Promise<any> {
  const report_year = toInt(body?.report_year);
  const report_week = toInt(body?.report_week);
  const start_date = body?.start_date;
  const end_date = body?.end_date;

  let sd: string, ed: string, reportName: string, reportSequence: number;

  if (report_year && report_week) {
    const fridays = getAllFridaysInYear(report_year);
    if (report_week - 1 >= fridays.length) {
      throw new Error(`无效的周次: ${report_year}年第${report_week}周`);
    }
    const friday = fridays[report_week - 1];
    const wi = getWeekInfo(friday);
    sd = wi.start_date;
    ed = wi.end_date;
    reportName = wi.report_name;
    reportSequence = wi.report_sequence;
  } else if (start_date && end_date) {
    sd = start_date;
    ed = end_date;
    reportName = `${sd.slice(0, 4)}年${sd.slice(5, 7)}月第${report_week || 1}周`;
    reportSequence = report_week || 1;
  } else {
    throw new Error('需要 report_year+report_week 或 start_date+end_date');
  }

  const sdDt = new Date(sd);
  const edDt = new Date(ed);
  const prevSd = new Date(sdDt);
  prevSd.setDate(prevSd.getDate() - 7);
  const prevEd = new Date(edDt);
  prevEd.setDate(prevEd.getDate() - 7);
  const prev_sd = `${prevSd.getFullYear()}-${String(prevSd.getMonth() + 1).padStart(2, '0')}-${String(prevSd.getDate()).padStart(2, '0')}`;
  const prev_ed = `${prevEd.getFullYear()}-${String(prevEd.getMonth() + 1).padStart(2, '0')}-${String(prevEd.getDate()).padStart(2, '0')}`;

  const year_start = `${report_year || sdDt.getFullYear()}-01-01`;

  const [current_week, year_to_date, prev_week] = await Promise.all([
    queryWeeklyMetrics(sd, ed),
    queryWeeklyMetrics(year_start, ed),
    queryWeeklyMetrics(prev_sd, prev_ed),
  ]);

  const wowKeys = ['cost', 'impressions', 'leads_wx', 'leads_app', 'opens_app', 'opens_other', 'opens', 'valid', 'assets'];
  const week_over_week: Record<string, number | null> = {};
  for (const k of wowKeys) {
    week_over_week[k] = calcWow(current_week[k], prev_week[k]);
  }

  // 本周按日堆叠
  const dailyRows = await querySql<Row>(
    `SELECT "时间区间" as date, "渠道名称" as channel, COALESCE(SUM("开户成功人数"), 0) as val
     FROM agg_daily_channel_open
     WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?
     GROUP BY "时间区间", "渠道名称"`,
    [sd, ed]
  );
  const dailyDates = [...new Set(dailyRows.map(r => r.date))].sort();
  const dailyMap: Record<string, any> = {};
  for (const r of dailyRows) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date };
    dailyMap[r.date][r.channel || '未分类'] = toInt(r.val);
  }
  const daily_opens_stacked = dailyDates.map(d => dailyMap[d] || { date: d });

  // 全年按周次堆叠
  const yearlyRows = await querySql<Row>(
    `SELECT "时间区间" as date, "渠道名称" as channel, COALESCE(SUM("开户成功人数"), 0) as val
     FROM agg_daily_channel_open
     WHERE "渠道类别" = '互联网引流' AND "时间区间" >= ? AND "时间区间" <= ?
     GROUP BY "时间区间", "渠道名称"`,
    [year_start, ed]
  );

  // 构建周列表
  const fridays = getAllFridaysInYear(sdDt.getFullYear());
  const weekList: { week: string; sd: string; ed: string }[] = [];
  for (let i = 0; i < fridays.length; i++) {
    const wi = getWeekInfo(fridays[i]);
    if (wi.start_date > ed) continue;
    const wed = wi.end_date > ed ? ed : wi.end_date;
    weekList.push({ week: `W${String(i + 1).padStart(2, '0')}`, sd: wi.start_date, ed: wed });
  }
  const findWeek = (d: string): string | null => {
    for (const w of weekList) {
      if (w.sd <= d && d <= w.ed) return w.week;
    }
    return null;
  };

  const channelSet: Record<string, number> = {};
  for (const r of yearlyRows) {
    const ch = r.channel || '未分类';
    channelSet[ch] = (channelSet[ch] || 0) + toInt(r.val);
  }

  const CATEGORY_ORDER_MAP: Record<string, number> = { 内容平台: 0, 应用市场: 1, 本地生活: 2 };
  const channels = Object.keys(channelSet).sort((a, b) => {
    const ca = CATEGORY_ORDER_MAP[WEEKLY_CHANNEL_CATEGORY_MAP[a] || '内容平台'] ?? 99;
    const cb = CATEGORY_ORDER_MAP[WEEKLY_CHANNEL_CATEGORY_MAP[b] || '内容平台'] ?? 99;
    if (ca !== cb) return ca - cb;
    return channelSet[b] - channelSet[a];
  });

  // 透视到周
  const weeklyMap: Record<string, any> = {};
  for (const r of yearlyRows) {
    const wk = findWeek(r.date);
    if (!wk) continue;
    if (!weeklyMap[wk]) weeklyMap[wk] = { week: wk };
    const ch = r.channel || '未分类';
    weeklyMap[wk][ch] = (weeklyMap[wk][ch] || 0) + toInt(r.val);
  }
  const weekly_opens_stacked = weekList.map(w => weeklyMap[w.week] || { week: w.week });

  // 互联网渠道占公司开户占比
  const weekAllOpensRows = await querySql<Row>(
    `SELECT COALESCE(SUM("开户成功人数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [sd, ed]
  );
  const weekAllValidRows = await querySql<Row>(
    `SELECT COALESCE(SUM("有效户数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [sd, ed]
  );
  const yearAllOpensRows = await querySql<Row>(
    `SELECT COALESCE(SUM("开户成功人数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [year_start, ed]
  );
  const yearAllValidRows = await querySql<Row>(
    `SELECT COALESCE(SUM("有效户数"), 0) as v FROM agg_daily_channel_open
     WHERE "时间区间" >= ? AND "时间区间" <= ?`,
    [year_start, ed]
  );

  const week_all_opens = toInt(weekAllOpensRows[0]?.v);
  const week_all_valid = toInt(weekAllValidRows[0]?.v);
  const year_all_opens = toInt(yearAllOpensRows[0]?.v);
  const year_all_valid = toInt(yearAllValidRows[0]?.v);

  const internet_ratio = {
    opens_ratio: week_all_opens ? safeDiv(current_week.opens, week_all_opens, true) : 0,
    valid_ratio: week_all_valid ? safeDiv(current_week.valid, week_all_valid, true) : 0,
    year_opens_ratio: year_all_opens ? safeDiv(year_to_date.opens, year_all_opens, true) : 0,
    year_valid_ratio: year_all_valid ? safeDiv(year_to_date.valid, year_all_valid, true) : 0,
  };

  // KPI
  const yearTotalDays = (new Date(sdDt.getFullYear(), 11, 31).getTime() - new Date(sdDt.getFullYear(), 0, 1).getTime()) / 86400000 + 1;
  const passedDays = (edDt.getTime() - new Date(sdDt.getFullYear(), 0, 1).getTime()) / 86400000 + 1;
  const time_progress = passedDays / yearTotalDays;

  const kpiRate = (key: 'opens' | 'valid' | 'assets') => {
    const target = KPI_TARGETS[key];
    const actual = year_to_date[key];
    const expected = target * time_progress;
    return expected ? safeDiv(actual, expected, true) : 0;
  };

  const kpi = {
    time_progress: Math.round(time_progress * 10000) / 100,
    opens: { target: KPI_TARGETS.opens, actual: year_to_date.opens, rate: kpiRate('opens') },
    valid: { target: KPI_TARGETS.valid, actual: year_to_date.valid, rate: kpiRate('valid') },
    assets: { target: KPI_TARGETS.assets, actual: year_to_date.assets, rate: kpiRate('assets') },
  };

  return {
    period: {
      start_date: sd, end_date: ed, prev_start: prev_sd, prev_end: prev_ed,
      report_year: report_year || sdDt.getFullYear(),
      report_week: report_week || 1,
      report_name: reportName,
      report_sequence: reportSequence,
    },
    current_week,
    year_to_date,
    prev_week,
    week_over_week,
    daily_opens_stacked,
    weekly_opens_stacked,
    channels,
    internet_ratio,
    kpi,
  };
}

// ============================================================================
// 周报详细版（v4.2.x）：在"总数+走势"概览基础上，按渠道分类下钻细分
//   应用市场 -> 平台 -> 广告计划 -> 版位/子版位/出价
//   内容平台(小红书/腾讯/抖音) -> 平台 -> 厂商 -> 计划
//   直播 -> 主播（复用 handleAnchorClusters，复合来源均分）
//   移植自 backend/routes/weekly_reports.py（_app_market_detail/_content_platform_detail/_live_detail）
// ============================================================================
const WEEKLY_APP_MARKET_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果'];
/** 内容平台渠道名称集合（与后端 CONTENT_PLATFORMS 一致；财联社归直播场景） */
const WEEKLY_CONTENT_PLATFORMS = ['小红书', '腾讯', '抖音', 'yj', '云极', '快手'];
// 广告开户复合条件（与 appMarket.ts AD_ACCOUNT_COND 一致，与后端 _AD_ACCOUNT_COND 一致）
const WEEKLY_AD_ACCOUNT_COND = `"是否创建完资金账号" = 1 AND "渠道类型" = '互联网引流' AND "是否新开户" = 1`;
// 展示用内容平台列表：yj 与 云极 为同一平台的两种上游命名，查询保留双名，展示统一归并为「云极」（与后端 CONTENT_PLATFORMS_DISPLAY 一致）
const WEEKLY_CONTENT_PLATFORMS_DISPLAY = ['小红书', '腾讯', '抖音', '云极', '快手'];
// 本地生活渠道（与后端 LOCAL_LIFE_CHANNELS 一致）
const WEEKLY_LOCAL_LIFE_CHANNELS = ['高德'];
// 平台名归一：yj/云极 统一为「云极」（BI 侧临时口径，上游统一命名后可移除；仅查询层展示，不动底表；与后端 _PLATFORM_ALIAS 一致）
const WEEKLY_PLATFORM_ALIAS: Record<string, string> = { yj: '云极' };
// 内容平台厂商白名单：白名单平台仅列内厂商独立展示，其余统一并入「未归因」；
// 未配置白名单的平台（云极/快手）不做归并。仅查询层展示口径，不动底表（与后端 _FACTORY_WHITELIST 一致）
const WEEKLY_FACTORY_WHITELIST: Record<string, Set<string>> = {
  小红书: new Set(['绩牛', '量子', '美洋', '开始故事', '群众互动', '直投']),
  抖音: new Set(['量子', '风声', '众联', '蛋白']),
  腾讯: new Set(['众联', '两把刷子', '直投']),
};
// 无白名单平台（云极/快手）的全局归并集：上游归属异常厂商并入「未归因」（与后端 _GLOBAL_FACTORY_MERGE 一致）
const WEEKLY_GLOBAL_FACTORY_MERGE = new Set(['哇棒', '风声', '众联', 'kiwi']);

/** 平台名归一：yj/云极 统一为「云极」（与后端 _norm_platform 一致） */
function normWeeklyPlatform(name: unknown): string {
  const p = String(name ?? '').trim();
  return WEEKLY_PLATFORM_ALIAS[p.toLowerCase()] ?? p;
}

/** 厂商名归一：白名单平台列外厂商并入「未归因」；无白名单平台按全局归并集处理（与后端 _norm_factory 一致） */
function normWeeklyFactory(platform: string, name: unknown): string {
  const n = String(name ?? '').trim();
  const allowed = WEEKLY_FACTORY_WHITELIST[platform];
  if (allowed) return allowed.has(n) ? n : '未归因';
  return WEEKLY_GLOBAL_FACTORY_MERGE.has(n.toLowerCase()) ? '未归因' : (n || '未归因');
}

// 直播线索识别（客户来源口径）— 与主播聚类匹配逻辑保持一致：
// 客户来源按 [,，;；、] 拆分后，任一段命中「(平台)引流-主播」正则或 dim_anchor_live_type
// 纯人名 token（is_active），即归为直播线索。直播线索在直播板块单独统计，
// 内容平台线索数须排除，避免两板块重复计数（与后端 _ANCHOR_SRC_PATTERN/_ANCHOR_SRC_SPLIT 一致）。
const WEEKLY_ANCHOR_SRC_PATTERN = /^(视频号直播|视频号|抖音|小红书|快手|财联社|腾讯|微信)引流-(.+?)$/;
const WEEKLY_ANCHOR_SRC_SPLIT = /[,，;；、]+/;

/** 加载 dim_anchor_live_type 中 is_active 的纯人名 token（不含 引流-/直播带货-；与后端 _load_live_plain_tokens 一致） */
async function loadWeeklyLivePlainTokens(): Promise<Set<string>> {
  const tokens = new Set<string>();
  try {
    const rows = await querySql<Row>(`SELECT source_token, is_active FROM dim_anchor_live_type`);
    for (const r of rows) {
      const tok = String(r.source_token || '');
      if (r.is_active && !tok.includes('引流-') && !tok.includes('直播带货-')) tokens.add(tok);
    }
  } catch {
    // dim_anchor_live_type 表缺失或为空，退化为无纯人名 token 模式
  }
  return tokens;
}

/** 判断客户来源是否命中直播线索口径（主播聚类可识别；与后端 _is_live_lead_source 一致） */
function isWeeklyLiveLeadSource(src: unknown, plainTokens: Set<string>): boolean {
  const parts = String(src ?? '').trim().split(WEEKLY_ANCHOR_SRC_SPLIT);
  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;
    if (WEEKLY_ANCHOR_SRC_PATTERN.test(segment) || plainTokens.has(segment)) return true;
  }
  return false;
}

/** 解析周次范围（与 handleWeeklyData 相同的周次规则；无效返回 null） */
function resolveWeekRange(body: any): {
  sd: string; ed: string; report_year: number; report_week: number;
  report_name: string; report_sequence: number;
} | null {
  const report_year = body?.report_year;
  const report_week = body?.report_week;
  const start_date = body?.start_date;
  const end_date = body?.end_date;
  if (report_year && report_week) {
    const yearNum = toInt(report_year);
    const weekNum = toInt(report_week);
    const fridays = getAllFridaysInYear(yearNum);
    if (weekNum - 1 >= fridays.length) return null;
    const wi = getWeekInfo(fridays[weekNum - 1]);
    return { sd: wi.start_date, ed: wi.end_date, report_year: yearNum, report_week: weekNum, report_name: wi.report_name, report_sequence: wi.report_sequence };
  }
  if (start_date && end_date) {
    const sd = String(start_date);
    const wNum = toInt(sd.slice(5, 7));
    return { sd, ed: String(end_date), report_year: toInt(sd.slice(0, 4)), report_week: wNum, report_name: `${sd.slice(0, 4)}年第${wNum}周`, report_sequence: wNum };
  }
  return null;
}

/** 应用市场 -> 平台 -> 广告计划（版位/子版位/出价） */
async function mobileAppMarketDetail(sd: string, ed: string): Promise<any[]> {
  const platformIn = inClause('平台', WEEKLY_APP_MARKET_PLATFORMS)!;
  const planWhere = buildWhere([platformIn, dateClause('日期', sd, ed)]);
  const planRows = await querySql<Row>(
    `SELECT "计划ID" as plan_id, "平台" as platform, "计划名称" as plan_name,
       COALESCE(SUM("花费"), 0) as spend, COALESCE(SUM("展示量"), 0) as impressions, COALESCE(SUM("点击量"), 0) as clicks
     FROM fact_plan_daily ${planWhere.clause}
     GROUP BY "计划ID", "平台", "计划名称"`,
    planWhere.params
  );
  const planIds: number[] = [];
  const planBy: Record<number, any> = {};
  for (const r of planRows) {
    const pid = toInt(r.plan_id);
    if (planBy[pid]) continue;
    planIds.push(pid);
    planBy[pid] = {
      platform: r.platform, plan_name: r.plan_name,
      spend: toFloat(r.spend), impressions: toInt(r.impressions), clicks: toInt(r.clicks),
      versions: new Set<string>(), sub_versions: new Set<string>(), bids: new Set<string>(),
    };
  }
  // 版位/子版位/出价（dim_ad_plan_class 关联广告分组ID）
  if (planIds.length > 0) {
    const idStrs = planIds.map(String);
    const pcWhere = buildWhere([inClause('广告分组ID', idStrs)]);
    const pcRows = await querySql<Row>(
      `SELECT "广告分组ID" as plan_id, "版位" as placement, "子版位" as sub_placement, "出价" as bid
       FROM dim_ad_plan_class ${pcWhere.clause}`,
      pcWhere.params
    );
    for (const r of pcRows) {
      const pc = planBy[toInt(r.plan_id)];
      if (!pc) continue;
      if (r.placement) pc.versions.add(String(r.placement));
      if (r.sub_placement) pc.sub_versions.add(String(r.sub_placement));
      if (r.bid) pc.bids.add(String(r.bid));
    }
  }
  // 各计划广告开户（资金账号创建完成时间）
  const openMap: Record<number, number> = {};
  if (planIds.length > 0) {
    const ow = buildWhere([inClause('广告计划ID', planIds.map(String)), dateClause('资金账号创建完成时间', sd, ed)]);
    const orRows = await querySql<Row>(
      `SELECT "广告计划ID" as plan_id, COALESCE(SUM(CASE WHEN ${WEEKLY_AD_ACCOUNT_COND} THEN 1 ELSE 0 END), 0) as open_cnt
       FROM fact_conv_appmarket ${ow.clause} GROUP BY "广告计划ID"`,
      ow.params
    );
    for (const r of orRows) openMap[toInt(r.plan_id)] = toInt(r.open_cnt);
  }
  // 各计划下载激活（下载日期口径；量 = 去重设备号，与计划漏斗激活量口径一致）
  const actMap: Record<number, number> = {};
  if (planIds.length > 0) {
    const aw = buildWhere([inClause('广告计划ID', planIds.map(String)), dateClause('下载日期', sd, ed)]);
    const aRows = await querySql<Row>(
      `SELECT "广告计划ID" as plan_id, COUNT(DISTINCT "设备号") as act_cnt
       FROM fact_conv_appmarket ${aw.clause} AND "是否激活APP" = 1
       GROUP BY "广告计划ID"`,
      aw.params
    );
    for (const r of aRows) actMap[toInt(r.plan_id)] = toInt(r.act_cnt);
  }
  // 各计划客户资产（广告开户口径行 SUM(总资产)：与 open_map 同一批复合条件行）
  const assetMap: Record<number, number> = {};
  if (planIds.length > 0) {
    const asw = buildWhere([inClause('广告计划ID', planIds.map(String)), dateClause('资金账号创建完成时间', sd, ed)]);
    const asRows = await querySql<Row>(
      `SELECT "广告计划ID" as plan_id, COALESCE(SUM("总资产"), 0) as assets
       FROM fact_conv_appmarket ${asw.clause} AND ${WEEKLY_AD_ACCOUNT_COND}
       GROUP BY "广告计划ID"`,
      asw.params
    );
    for (const r of asRows) assetMap[toInt(r.plan_id)] = toFloat(r.assets);
  }
  const plans: any[] = [];
  for (const pid of planIds) {
    const info = planBy[pid];
    const oc = openMap[pid] || 0;
    const act = actMap[pid] || 0;
    const asset = assetMap[pid] || 0;
    const spend = info.spend;
    plans.push({
      plan_id: String(pid),
      plan_name: info.plan_name,
      platform: info.platform,
      versions: info.versions.size ? Array.from(info.versions).sort() : ['未分类'],
      sub_versions: info.sub_versions.size ? Array.from(info.sub_versions).sort() : ['未分类'],
      bids: info.bids.size ? Array.from(info.bids).sort() : ['未分类'],
      spend: round2(spend), impressions: info.impressions, clicks: info.clicks,
      open_count: oc, open_cost: oc ? round2(spend / oc) : null,
      activated: act, assets: round2(asset),
    });
  }
  plans.sort((a, b) => (b.open_count - a.open_count) || (b.spend - a.spend));

  const byPlatform: Record<string, any> = {};
  for (const p of plans) {
    if (!byPlatform[p.platform]) byPlatform[p.platform] = { platform: p.platform, spend: 0, open_count: 0, activated: 0, assets: 0, plans: [] };
    byPlatform[p.platform].spend += p.spend;
    byPlatform[p.platform].open_count += p.open_count;
    byPlatform[p.platform].activated += p.activated;
    byPlatform[p.platform].assets += p.assets;
    byPlatform[p.platform].plans.push(p);
  }
  const result: any[] = [];
  for (const pf of WEEKLY_APP_MARKET_PLATFORMS) {
    const agg = byPlatform[pf];
    if (!agg) continue;
    result.push({
      platform: pf,
      spend: round2(agg.spend),
      open_count: agg.open_count,
      open_cost: agg.open_count ? round2(agg.spend / agg.open_count) : null,
      activated: agg.activated,
      assets: round2(agg.assets),
      top_plans: agg.plans.slice(0, 10),
    });
  }
  result.sort((a, b) => (b.open_count - a.open_count) || (b.spend - a.spend));
  return result;
}

/** 内容平台(小红书/腾讯/抖音) -> 平台 -> 厂商 -> 计划 */
async function mobileContentPlatformDetail(sd: string, ed: string): Promise<any[]> {
  const pfWhere = buildWhere([inClause('平台', WEEKLY_CONTENT_PLATFORMS), dateClause('日期', sd, ed)]);
  // 1) 厂商级 开户/花费（agg_vendor_daily 权威底表，内容平台非直播：业务模式 != '直播'）
  const aggWhere = buildWhere([
    inClause('平台', WEEKLY_CONTENT_PLATFORMS),
    dateClause('日期', sd, ed),
  ]);
  const aggRows = await querySql<Row>(
    `SELECT "平台" as platform, "厂商" as factory,
       COALESCE(SUM("开户人数"), 0) as open_count, COALESCE(SUM("花费"), 0) as spend
     FROM agg_vendor_daily ${aggWhere.clause}
       AND "业务模式" IS NOT NULL AND "业务模式" != '直播'
     GROUP BY "平台", "厂商"`,
    aggWhere.params
  );

  // 2) 计划级 消耗/展示/点击（fact_plan_daily，按 厂商名称 挂到对应厂商）
  const rows = await querySql<Row>(
    `SELECT "平台" as platform, "厂商名称" as factory, "计划ID" as plan_id, "计划名称" as plan_name,
       COALESCE(SUM("花费"), 0) as spend, COALESCE(SUM("展示量"), 0) as impressions, COALESCE(SUM("点击量"), 0) as clicks
     FROM fact_plan_daily ${pfWhere.clause}
     GROUP BY "平台", "厂商名称", "计划ID", "计划名称"`,
    pfWhere.params
  );
  // 内容平台线索量（fact_conv_content，1 行=1 企微）
  // v4.x 口径：排除直播线索（客户来源命中主播聚类口径），直播线索在直播板块单独统计
  const leadMap: Record<string, number> = {};
  const plainTokens = await loadWeeklyLivePlainTokens();
  const lcWhere = buildWhere([inClause('平台来源', WEEKLY_CONTENT_PLATFORMS), dateClause('线索日期', sd, ed)]);
  const lcRows = await querySql<Row>(
    `SELECT "平台来源" as platform, "客户来源" as lead_source, COUNT(id) as leads
     FROM fact_conv_content ${lcWhere.clause} GROUP BY "平台来源", "客户来源"`,
    lcWhere.params
  );
  for (const r of lcRows) {
    if (isWeeklyLiveLeadSource(r.lead_source, plainTokens)) continue;
    // yj 归并入云极后可能产生同名键，累加避免覆盖
    const np = normWeeklyPlatform(r.platform);
    leadMap[np] = (leadMap[np] || 0) + toInt(r.leads);
  }

  // 归集计划：平台+厂商名称 -> plans
  const plansByFactory: Record<string, any[]> = {};
  for (const r of rows) {
    const pf = normWeeklyPlatform(r.platform);
    const fy = normWeeklyFactory(pf, r.factory);
    const key = `${pf}\u0000${fy}`;
    if (!plansByFactory[key]) plansByFactory[key] = [];
    plansByFactory[key].push({
      plan_id: r.plan_id != null ? String(r.plan_id) : null,
      plan_name: r.plan_name,
      spend: round2(toFloat(r.spend)), impressions: toInt(r.impressions), clicks: toInt(r.clicks),
      open_count: 0, // 无计划维度开户，统一走厂商级底表口径
    });
  }

  const byPlatform: Record<string, any> = {};
  for (const r of aggRows) {
    const pf = normWeeklyPlatform(r.platform) || '未分类';
    const factoryName = normWeeklyFactory(pf, r.factory);
    if (!byPlatform[pf]) byPlatform[pf] = { platform: pf, factMap: {} };
    // 多个上游厂商并入同名（如「未归因」）时需累加而非覆盖
    if (!byPlatform[pf].factMap[factoryName]) byPlatform[pf].factMap[factoryName] = { factory: factoryName, spend: 0, open_count: 0 };
    const fac = byPlatform[pf].factMap[factoryName];
    fac.spend += toFloat(r.spend);
    fac.open_count += toInt(r.open_count);
  }
  // 二次遍历：计划按（归一后平台, 归一后厂商名）挂到对应厂商，取消耗 Top10
  for (const platform of Object.values(byPlatform) as any[]) {
    for (const fac of Object.values(platform.factMap) as any[]) {
      const key = `${platform.platform}\u0000${fac.factory}`;
      const plans = (plansByFactory[key] || []).sort((a: any, b: any) => b.spend - a.spend).slice(0, 10);
      fac.spend = round2(fac.spend);
      fac.plans = plans;
    }
  }
  const result: any[] = [];
  for (const pf of WEEKLY_CONTENT_PLATFORMS_DISPLAY) {
    const p = byPlatform[pf];
    if (!p) continue;
    const factories = Object.values(p.factMap) as any[];
    factories.sort((a: any, b: any) => (b.open_count - a.open_count) || (b.spend - a.spend));
    result.push({
      platform: pf, lead_count: leadMap[pf] || 0,
      open_count: factories.reduce((s: number, f: any) => s + f.open_count, 0),
      factories,
    });
  }
  return result;
}

/** 直播 -> 主播（复用 handleAnchorClusters，复合来源均分，口径与 /anchor-clusters 一致；top_n 500 ≥ 后端 200 截断） */
async function mobileLiveDetail(sd: string, ed: string): Promise<any[]> {
  const res = await handleAnchorClusters({
    filters: { start_date: sd, end_date: ed, platforms: [], agencies: [], live_types: [] },
    top_n: 500,
  });
  const items = (res.items || []) as any[];
  return items.map((i) => ({
    anchor_name: i.anchor,
    live_type: i.live_type,
    leads: i.leads,
    new_leads: i.new_leads,
    mouth: i.mouth,
    opened: i.opened,
    new_opened: i.new_opened,
    valid: i.valid,
    new_valid: i.new_valid,
    assets: i.assets,
    new_assets: i.new_assets,
  }));
}

/** 本地生活（高德）开户数据 — 独立板块（agg_daily_channel_open，渠道名称=高德，与后端 LOCAL_LIFE_CHANNELS 一致） */
async function mobileLocalLifeDetail(sd: string, ed: string): Promise<any[]> {
  const llWhere = buildWhere([inClause('渠道名称', WEEKLY_LOCAL_LIFE_CHANNELS), dateClause('时间区间', sd, ed)]);
  const rows = await querySql<Row>(
    `SELECT "渠道名称" as platform, COALESCE(SUM("开户成功人数"), 0) as open_count
     FROM agg_daily_channel_open ${llWhere.clause}
     GROUP BY "渠道名称"`,
    llWhere.params
  );
  return rows.map((r) => ({ platform: r.platform || '高德', open_count: toInt(r.open_count) }));
}

/** 按周次聚合各渠道开户数（agg_daily_channel_open, 互联网引流），与后端 _weekly_opens_by_channels 一致。
 * 一次查询全年（日期×渠道）行后在 JS 端做周映射，避免逐周 30+ 次往返查询拖慢移动端。 */
async function mobileWeeklyOpensByChannels(weekList: { week: string; sd: string; ed: string }[], channels: string[], category: string | null = '互联网引流'): Promise<any[]> {
  if (!weekList.length) return [];
  const lo = weekList[0].sd;
  const hi = weekList[weekList.length - 1].ed;
  // 固定条件（渠道类别，category=null 时不限类别）与动态条件统一交给 buildWhere 拼接，避免手工拼 SQL 漏 AND
  // （同一渠道名称在「互联网引流 / 自然流入」等多个渠道类别下都有数据，漏掉类别过滤会多算）
  const conds: ({ sql: string; params: unknown[] } | null)[] = [inClause('渠道名称', channels), dateClause('时间区间', lo, hi)];
  if (category) conds.unshift({ sql: `"渠道类别" = '${category}'`, params: [] });
  const where = buildWhere(conds);
  const rows = await querySql<Row>(
    `SELECT "时间区间" as date, "渠道名称" as channel, COALESCE(SUM("开户成功人数"), 0) as opens
     FROM agg_daily_channel_open ${where.clause}
     GROUP BY "时间区间", "渠道名称"`,
    where.params
  );
  const result: Record<string, number | string>[] = weekList.map((w) => ({ week: w.week }));
  for (const r of rows) {
    for (let i = 0; i < weekList.length; i++) {
      const w = weekList[i];
      if (w.sd <= r.date && r.date <= w.ed) {
        // yj 归并入云极后可能产生同名键，累加避免覆盖
        const key = normWeeklyPlatform(r.channel);
        result[i][key] = (toInt(result[i][key]) || 0) + toInt(r.opens);
        break; // 周区间连续不重叠，命中即止
      }
    }
  }
  return result;
}

/** 按周次聚合主播开户数（复用 handleAnchorClusters，复合来源均分），与后端 _live_weekly 全量口径一致 */
async function mobileLiveWeekly(weekList: { week: string; sd: string; ed: string }[]): Promise<any[]> {
  const result: any[] = [];
  for (const w of weekList) {
    const res = await handleAnchorClusters({
      filters: { start_date: w.sd, end_date: w.ed, platforms: [], agencies: [], live_types: [] },
      top_n: 500,
    });
    const row: Record<string, number | string> = { week: w.week };
    for (const i of (res.items || ([] as any[]))) {
      if (toInt(i.new_opened) > 0) row[i.anchor] = toInt(i.new_opened);
    }
    result.push(row);
  }
  return result;
}

/** POST /reports/weekly/detail — 周报详细版（本周 + 全年累计，三维细分） */
export async function handleWeeklyDetail(body: any): Promise<any> {
  const week = resolveWeekRange(body);
  if (!week) {
    const yr = toInt(body?.report_year);
    const rw = toInt(body?.report_week);
    throw new Error(`无效的周次: ${yr}年第${rw}周`);
  }
  const { sd, ed, report_year, report_week, report_name, report_sequence } = week;
  const year_start = `${report_year}-01-01`;

  // 构建周次列表（与 handleWeeklyData 相同的周次规则）
  const edRaw = new Date(ed);
  const fridays = getAllFridaysInYear(edRaw.getFullYear());
  const weekList: { week: string; sd: string; ed: string }[] = [];
  for (let i = 0; i < fridays.length; i++) {
    const wi = getWeekInfo(fridays[i]);
    if (wi.start_date > ed) continue;
    const wed = wi.end_date > ed ? ed : wi.end_date;
    weekList.push({ week: `W${String(i + 1).padStart(2, '0')}`, sd: wi.start_date, ed: wed });
  }
  const app_market_weekly = await mobileWeeklyOpensByChannels(weekList, WEEKLY_APP_MARKET_PLATFORMS);
  const content_weekly = await mobileWeeklyOpensByChannels(weekList, WEEKLY_CONTENT_PLATFORMS);
  const live_weekly = await mobileLiveWeekly(weekList);
  // 本地生活分周开户：category=null 不限渠道类别（高德按渠道名称过滤即可），与后端一致
  const local_life_weekly = await mobileWeeklyOpensByChannels(weekList, WEEKLY_LOCAL_LIFE_CHANNELS, null);

  const scoped = async (sdi: string, edi: string) => ({
    app_market: await mobileAppMarketDetail(sdi, edi),
    content_platform: await mobileContentPlatformDetail(sdi, edi),
    live: await mobileLiveDetail(sdi, edi),
    local_life: await mobileLocalLifeDetail(sdi, edi),
    app_market_weekly,
    content_weekly,
    live_weekly,
    local_life_weekly,
  });

  return {
    period: { start_date: sd, end_date: ed, report_year, report_week, report_name, report_sequence },
    current_week: await scoped(sd, ed),
    year_to_date: await scoped(year_start, ed),
  };
}
