/**
 * 移动端本地路由处理器 —— 小红书分支 KOS 转化周报 (xhs/kos-weekly)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { toInt, toFloat, round2, type Row } from './shared';
// ============================================================================
// 小红书 · 分支KOS转化周报（v3.8.0）
// 移植自 backend/routes/data/xhs_kos_weekly.py（数据口径完全一致）
// 数据源：fact_conv_content.笔记ID 关联 agg_xhs_note.创作者（分支KOS投顾名单）
// ============================================================================

const KOS_PLATFORM = '小红书';
const KOS_ROSTER = [
  '何慧敏', '刘贝', '张永强', '张靖月', '李荣志',
  '汤凯', '盛睿雪', '陈小芳', '黄天平', '赵茜',
];

function kosNameOf(creator: unknown): string | null {
  const c = String(creator ?? '').trim();
  if (!c) return null;
  for (const name of KOS_ROSTER) {
    if (c.includes(name)) return name;
  }
  return null;
}

function parseKosDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

interface KosLeadRow {
  id: unknown;
  kos: string;
  线索日期: string | null;
  是否客户开口: number;
  是否有效线索: number;
  是否开户: number;
  是否为有效户: number;
  是否为存量客户: number;
  开户时间: string | null;
  资产: number;
}

/** 拉取全部分支KOS线索（与后端 _load_kos_leads 一致：JOIN agg_xhs_note 按笔记ID，按 id 去重） */
async function kosGetLeads(): Promise<KosLeadRow[]> {
  const rows = await querySql<Row>(`
    SELECT
      f.id AS id,
      a."创作者" AS creator,
      f."线索日期" AS 线索日期,
      f."是否客户开口" AS 是否客户开口,
      f."是否有效线索" AS 是否有效线索,
      f."是否开户" AS 是否开户,
      f."是否为有效户" AS 是否为有效户,
      f."是否为存量客户" AS 是否为存量客户,
      f."开户时间" AS 开户时间,
      f."资产" AS 资产
    FROM fact_conv_content f
    INNER JOIN agg_xhs_note a ON a."笔记ID" = f."笔记ID"
  `, []);
  const seen = new Set<string>();
  const out: KosLeadRow[] = [];
  for (const r of rows) {
    const id = String(r.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const kos = kosNameOf(r.creator);
    if (kos === null) continue;
    out.push({
      id: r.id,
      kos,
      线索日期: parseKosDate(r.线索日期),
      是否客户开口: toInt(r.是否客户开口),
      是否有效线索: toInt(r.是否有效线索),
      是否开户: toInt(r.是否开户),
      是否为有效户: toInt(r.是否为有效户),
      是否为存量客户: toInt(r.是否为存量客户),
      开户时间: parseKosDate(r.开户时间),
      资产: toFloat(r.资产),
    });
  }
  return out;
}

interface KosAgg {
  total_leads: number;
  mouth: number;
  valid_lead: number;
  opened: number;
  valid: number;
  assets: number;
}

function kosEmptyAgg(): KosAgg {
  return { total_leads: 0, mouth: 0, valid_lead: 0, opened: 0, valid: 0, assets: 0 };
}

/** 与后端 _aggregate 一致：按 KOS 名单聚合，无数据成员补 0，按开户率降序 */
function kosAggregate(leads: KosLeadRow[]): any[] {
  const agg: Record<string, KosAgg> = {};
  for (const l of leads) {
    const a = (agg[l.kos] = agg[l.kos] || kosEmptyAgg());
    a.total_leads += 1;
    a.mouth += l.是否客户开口;
    a.valid_lead += l.是否有效线索;
    a.opened += l.是否开户;
    a.valid += l.是否为有效户;
    a.assets += l.资产;
  }
  const items = KOS_ROSTER.map((kos) => {
    const a = agg[kos] || kosEmptyAgg();
    const leads_n = a.total_leads;
    const opened = a.opened;
    const valid = a.valid;
    return {
      kos_name: kos,
      platform: KOS_PLATFORM,
      total_leads: leads_n,
      mouth_count: a.mouth,
      valid_lead_count: a.valid_lead,
      opened_count: opened,
      valid_customer_count: valid,
      total_assets: round2(a.assets),
      opening_rate: leads_n > 0 ? round2(opened / leads_n * 100) : 0,
      valid_customer_rate: opened > 0 ? round2(valid / opened * 100) : 0,
    };
  });
  items.sort((a, b) => b.opening_rate - a.opening_rate);
  return items;
}

/** 与后端 _aggregate_existing_new_open 一致：存量线索新开户榜 */
function kosAggregateExistingNewOpen(oldLeads: KosLeadRow[], oldOpened: KosLeadRow[]): any[] {
  const totalMap: Record<string, number> = {};
  for (const l of oldLeads) {
    totalMap[l.kos] = (totalMap[l.kos] || 0) + 1;
  }
  const openedMap: Record<string, any> = {};
  for (const item of kosAggregate(oldOpened)) {
    openedMap[item.kos_name] = item;
  }
  const items = KOS_ROSTER.map((kos) => {
    const t = totalMap[kos] || 0;
    const o = openedMap[kos];
    const opened = o ? o.opened_count : 0;
    const valid = o ? o.valid_customer_count : 0;
    return {
      kos_name: kos,
      platform: KOS_PLATFORM,
      total_leads: t,
      mouth_count: o ? o.mouth_count : 0,
      valid_lead_count: o ? o.valid_lead_count : 0,
      opened_count: opened,
      valid_customer_count: valid,
      total_assets: o ? o.total_assets : 0,
      opening_rate: t > 0 ? round2(opened / t * 100) : 0,
      valid_customer_rate: opened > 0 ? round2(valid / opened * 100) : 0,
    };
  });
  items.sort((a, b) => b.opening_rate - a.opening_rate);
  return items;
}

/** 与后端 _in_range 一致 */
function kosInRange(d: string | null, s?: string, e?: string): boolean {
  if (d === null) return false;
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}

function kosBuildRankings(leads: KosLeadRow[], sd?: string, ed?: string): Record<string, any[]> {
  const total = leads.filter((l) => ed === undefined || kosInRange(l.线索日期, undefined, ed));
  const existing = leads.filter((l) => kosInRange(l.线索日期, sd, ed) && l.是否为存量客户 === 1);
  const newLeads = leads.filter((l) => kosInRange(l.线索日期, sd, ed) && l.是否为存量客户 !== 1);
  const oldLeads = leads.filter((l) => sd && l.线索日期 !== null && l.线索日期! < sd);
  const oldOpened = oldLeads.filter((l) => kosInRange(l.开户时间, sd, ed) && l.是否开户 === 1);
  return {
    total: kosAggregate(total),
    existing: kosAggregate(existing),
    new: kosAggregate(newLeads),
    existing_new_open: kosAggregateExistingNewOpen(oldLeads, oldOpened),
  };
}

function kosBuildOverview(leads: KosLeadRow[], sd?: string, ed?: string): Record<string, number> {
  const filtered = leads.filter((l) => l.线索日期 !== null
    && (sd === undefined || l.线索日期! >= sd)
    && (ed === undefined || l.线索日期! <= ed));
  const items = kosAggregate(filtered);
  const totalLeads = items.reduce((s, i) => s + i.total_leads, 0);
  const opened = items.reduce((s, i) => s + i.opened_count, 0);
  return {
    total_leads: totalLeads,
    mouth_count: items.reduce((s, i) => s + i.mouth_count, 0),
    valid_lead_count: items.reduce((s, i) => s + i.valid_lead_count, 0),
    opened_count: opened,
    valid_customer_count: items.reduce((s, i) => s + i.valid_customer_count, 0),
    total_assets: round2(items.reduce((s, i) => s + i.total_assets, 0)),
    opening_rate: totalLeads > 0 ? round2(opened / totalLeads * 100) : 0,
  };
}

function kosBuildTrend(leads: KosLeadRow[], sd?: string, ed?: string): any[] {
  const agg: Record<string, { leads: number; opened: number; valid: number }> = {};
  for (const l of leads) {
    const d = l.线索日期;
    if (d === null) continue;
    if (sd && d < sd) continue;
    if (ed && d > ed) continue;
    const key = d.substring(0, 7);
    const a = (agg[key] = agg[key] || { leads: 0, opened: 0, valid: 0 });
    a.leads += 1;
    a.opened += l.是否开户;
    a.valid += l.是否为有效户;
  }
  return Object.keys(agg).sort().map((k) => ({ period: k, ...agg[k] }));
}

function kosLatestWeekRange(leads: KosLeadRow[]): { latest_date: string; default_week_start: string; default_week_end: string } {
  let latest: string | null = null;
  for (const l of leads) {
    if (l.线索日期 !== null && (latest === null || l.线索日期! > latest)) {
      latest = l.线索日期;
    }
  }
  const now = new Date();
  const refDate = latest ? new Date(latest + 'T00:00:00') : now;
  const day = refDate.getDay() === 0 ? 6 : refDate.getDay() - 1; // Mon=0..Sun=6
  const start = new Date(refDate);
  start.setDate(refDate.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (d: Date) => d.toISOString().substring(0, 10);
  return {
    latest_date: latest || '',
    default_week_start: iso(start),
    default_week_end: iso(end),
  };
}

export async function handleKosWeekly(body: any): Promise<any> {
  const sd = body?.start_date;
  const ed = body?.end_date;
  const leads = await kosGetLeads();
  return {
    platform: KOS_PLATFORM,
    roster_count: KOS_ROSTER.length,
    roster: KOS_ROSTER,
    rankings: { [KOS_PLATFORM]: kosBuildRankings(leads, sd, ed) },
    overview: { [KOS_PLATFORM]: kosBuildOverview(leads, sd, ed) },
    trend: kosBuildTrend(leads, sd, ed),
  };
}

export async function handleKosWeeklyFilterOptions(): Promise<any> {
  const leads = await kosGetLeads();
  return {
    platform: KOS_PLATFORM,
    roster: KOS_ROSTER,
    roster_count: KOS_ROSTER.length,
    ...kosLatestWeekRange(leads),
  };
}
