/**
 * 移动端本地路由处理器 —— 数据新鲜度 (data-freshness)
 *
 * 由 mobileRouteHandler.ts 按报表域拆分而来，SQL 口径与 Flask 后端保持一致。
 */
import { querySql } from '../mobileSqlite';
import { type Row } from './shared';
// ============================================================================
// 数据新鲜度（data-freshness）— 移植自 backend/routes/metadata.py::get_data_status
// 关于页数据状态：对 5 张源表取各表最大日期，按距今天数给出 normal/warning/critical
// ============================================================================

const FRESHNESS_SOURCES = [
  { key: 'vendor_daily',           table: 'agg_vendor_daily',         dateField: '日期',       name: '厂商日聚合',     group: 'channel_ads',  order: 1 },
  { key: 'xhs_note',               table: 'agg_xhs_note',             dateField: '发布时间',    name: '小红书笔记聚合', group: 'content',     order: 2 },
  { key: 'fact_conv_content',      table: 'fact_conv_content',        dateField: '线索日期',      name: '内容平台转化',     group: 'content',     order: 3 },
  { key: 'fact_conv_appmarket',    table: 'fact_conv_appmarket',      dateField: '下载日期',      name: '应用市场转化',     group: 'app_market',  order: 4 },
  { key: 'agg_daily_channel_open', table: 'agg_daily_channel_open',   dateField: '时间区间',      name: '全渠道开户汇总',   group: 'omni',        order: 5 },
];

export async function handleDataFreshness(): Promise<Record<string, any>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: Record<string, any> = {};

  for (const src of FRESHNESS_SOURCES) {
    const base = { name: src.name, group: src.group, order: src.order };
    try {
      const rows = await querySql<Row>(`SELECT MAX("${src.dateField}") AS latest FROM "${src.table}"`);
      const latest = rows?.[0]?.latest;
      if (latest) {
        const latestStr = String(latest).slice(0, 10);
        let days = 0;
        try {
          const d = new Date(latestStr);
          if (!Number.isNaN(d.getTime())) {
            days = Math.floor((today.getTime() - d.getTime()) / 86400000);
          }
        } catch {
          days = 0;
        }
        const status = days <= 5 ? 'normal' : days <= 14 ? 'warning' : 'critical';
        results[src.key] = { ...base, latest_date: latestStr, days_ago: days, status };
      } else {
        results[src.key] = { ...base, latest_date: null, status: 'no_data' };
      }
    } catch (e) {
      results[src.key] = { ...base, status: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }
  return results;
}
