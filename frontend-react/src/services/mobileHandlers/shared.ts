/**
 * 移动端本地路由处理器 —— 共享工具函数
 *
 * 由各报表域 handler 共用，与 Flask 后端口径一致。
 */


export function toInt(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function toFloat(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** 构建日期过滤条件 */
export function dateClause(col: string, sd?: string, ed?: string): { sql: string; params: unknown[] } | null {
  if (sd && ed) {
    return { sql: `"${col}" >= ? AND "${col}" <= ?`, params: [sd, ed] };
  }
  return null;
}

/** 构建 IN 过滤条件 */
export function inClause(col: string, values?: string[] | string): { sql: string; params: unknown[] } | null {
  if (!values) return null;
  const arr = Array.isArray(values) ? values : String(values).split(',').map(s => s.trim()).filter(Boolean);
  if (arr.length === 0) return null;
  const placeholders = arr.map(() => '?').join(', ');
  return { sql: `"${col}" IN (${placeholders})`, params: arr };
}

/** 组合 WHERE 子句 */
export function buildWhere(conditions: ({ sql: string; params: unknown[] } | null)[]): { clause: string; params: unknown[] } {
  const valid = conditions.filter((c): c is { sql: string; params: unknown[] } => c !== null);
  if (valid.length === 0) return { clause: '', params: [] };
  return {
    clause: 'WHERE ' + valid.map(c => c.sql).join(' AND '),
    params: valid.flatMap(c => c.params),
  };
}

/** 从请求 body 提取 filters */
export function getFilters(body: any): any {
  return body?.filters || {};
}

/** 从 filters 提取日期 */
export function getDateRange(filters: any): { start_date?: string; end_date?: string } {
  const sd = filters?.start_date || (filters?.date_range?.[0] ?? undefined);
  const ed = filters?.end_date || (filters?.date_range?.[1] ?? undefined);
  return { start_date: sd, end_date: ed };
}

export type Row = Record<string, any>;

/** 从 URL query string 提取参数（GET 请求用） */
export function parseQueryParams(url: string): Record<string, string> {
  const qIndex = url.indexOf('?');
  if (qIndex < 0) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(qIndex + 1).split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}
