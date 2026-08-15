/**
 * 移动端本地路由处理器 —— 元数据 / 全局筛选项 (metadata)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { type Row } from './shared';
// ============================================================================
// 元数据 (metadata) — 全局筛选项数据源
// ============================================================================
// 对齐后端 backend/routes/metadata.py 的 /metadata 路由
// 供 AgencyFilter / PlatformFilter / BusinessModelFilter 三个筛选器使用
// 移动端无 dim_account 表，代理商直接用 agg_vendor_daily.厂商 全称（无简称归一化）

export async function handleMetadata(): Promise<any> {
  // 平台列表（与后端兜底一致：失败时返回 ['腾讯', '抖音', '小红书']）
  let platforms: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "平台" as v FROM agg_vendor_daily
       WHERE "平台" IS NOT NULL AND "平台" != ''
       ORDER BY "平台"`
    );
    platforms = rows.map(r => String(r.v));
  } catch {
    platforms = ['腾讯', '抖音', '小红书'];
  }

  // 代理商（移动端无 dim_account，直接用 厂商 全称，简称=全称）
  let agency_names: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "厂商" as v FROM agg_vendor_daily
       WHERE "厂商" IS NOT NULL AND "厂商" != ''
       ORDER BY "厂商"`
    );
    agency_names = rows.map(r => String(r.v));
  } catch {
    agency_names = [];
  }
  const agencies = agency_names.map(a => ({ value: a, label: a, full_names: [a] }));
  const agency_full_map: Record<string, string[]> = {};
  for (const a of agency_names) agency_full_map[a] = [a];

  // 业务模式
  let business_models: string[] = [];
  try {
    const rows = await querySql<Row>(
      `SELECT DISTINCT "业务模式" as v FROM agg_vendor_daily
       WHERE "业务模式" IS NOT NULL AND "业务模式" != ''
       ORDER BY "业务模式"`
    );
    business_models = rows.map(r => String(r.v));
  } catch {
    business_models = [];
  }

  // 日期范围（agg_vendor_daily.日期）
  const date_range: { start: string | null; end: string | null } = { start: null, end: null };
  try {
    const rows = await querySql<Row>(
      `SELECT MIN("日期") as min, MAX("日期") as max FROM agg_vendor_daily`
    );
    const r = rows[0];
    if (r?.min) date_range.start = String(r.min).slice(0, 10);
    if (r?.max) date_range.end = String(r.max).slice(0, 10);
  } catch {
    // 保持 null
  }

  // 小红书笔记日期范围（agg_xhs_note.发布时间，截取前 10 位 YYYY-MM-DD）
  const xhs_notes_date_range: { start: string | null; end: string | null } = { start: null, end: null };
  try {
    const rows = await querySql<Row>(
      `SELECT MIN("发布时间") as min, MAX("发布时间") as max FROM agg_xhs_note`
    );
    const r = rows[0];
    if (r?.min) xhs_notes_date_range.start = String(r.min).slice(0, 10);
    if (r?.max) xhs_notes_date_range.end = String(r.max).slice(0, 10);
  } catch {
    // 保持 null
  }

  return {
    platforms,
    agencies,
    agency_full_map,
    business_models,
    date_range,
    xhs_notes_date_range,
    accounts: [],  // 移动端不提供账号映射列表（features 已禁用相关页面）
  };
}
