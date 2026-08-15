/**
 * 移动端本地路由处理器 —— 周报 (reports/weekly/*)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, type Row } from './shared';
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
