/**
 * 移动端 + PWA 端 WebDAV 分表同步（v3.9.5）
 *
 * 目标：替代「整库 .db.gz 拉取」的裸大传输，改为按表增量拉取。
 *   1. GET 云端逐表清单 manifest.json（tables/table_sync/manifest.json），得到各表云端版本
 *   2. 对照本地各表版本（事实表 MAX(业务日期)；维表有数据即 '0'；本地无表视为空）
 *      —— 云端「新者胜」才需要更新（与后端 table_sync.normalize_version 语义一致）
 *   3. 需要更新的表下载其「单表 .db」文件（标准 SQLite），用 sql.js 解析出 CREATE + 全量行
 *   4. 合并进本地库（全量替换该表，不触碰其它表）：
 *        - PWA：写 sql.js 主库并持久化 IndexedDB
 *        - 安卓：批量 executeSet（单事务）写 Capacitor SQLite
 *
 * 归因 / 兼容：
 *   - 云端无 manifest 时（老版本桌面端只整库 push）返回提示，让用户走原有「从坚果云同步」整库拉取
 *   - 首次初始化（本地无库）仍应走整库同步；分表同步适合「已有库、增量刷新」，避免整库重复下载
 *
 * v4.3.2：
 *   - 默认全量拉取：云端清单里存在的表一律下载最新版整体覆盖本地，不再做「云端严格新于本地」
 *     的版本比对跳过（版本号仅用于日志展示）——避免本地水位异常（整库恢复、行数被截断、
 *     分块写入中断）时误判「已是最新」导致数据停留在旧版
 *   - 安卓端合并改走分块 executeSet（见 mobileSqlite.executeSetSql），防止单次跨桥 payload
 *     过大触发原生层 OOM 闪退
 */
import initSqlJs from 'sql.js';
import type { SqlValue } from 'sql.js';
import { isPwaClient } from '@/utils/isDesktop';
import { decompressGzip, getWebDAVCredentials, saveLastSyncAt, type SyncResult } from './mobileSync';
import { querySql as mobileQuerySql, executeSetSql } from './mobileSqlite';
import {
  mergeParsedTablesIntoLocal,
  type ParsedTable,
} from './sqlJsAdapter';

// 与后端 table_sync.TABLE_DATE_COLS / DIM_TABLES 对齐：事实表业务日期列，维表无日期列
export interface SyncTableMeta {
  name: string;
  type: 'dim' | 'fact';
  dateCol?: string;
}
export const MOBILE_SYNC_TABLES: SyncTableMeta[] = [
  { name: 'dim_account', type: 'dim' },
  { name: 'dim_ad_plan_class', type: 'dim' },
  { name: 'fact_conv_content', type: 'fact', dateCol: '线索日期' },
  { name: 'fact_conv_appmarket', type: 'fact', dateCol: '下载日期' },
  { name: 'fact_plan_daily', type: 'fact', dateCol: '日期' },
  { name: 'agg_vendor_daily', type: 'fact', dateCol: '日期' },
  { name: 'agg_xhs_note', type: 'fact', dateCol: '发布时间' },
  { name: 'agg_daily_channel_open', type: 'fact', dateCol: '时间区间' },
  { name: 'fact_qingniao_leads', type: 'fact', dateCol: '日期' },
];

const DEFAULT_WEBDAV_BASE = 'https://dav.jianguoyun.com/dav/';

// sql.js 静态类懒初始化（解析单表 .db 用，全端适用；wasm 路径与构建 base 一致）
let sqlStaticPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;
function getSqlStatic() {
  if (!sqlStaticPromise) {
    const wasmPath = import.meta.env.BASE_URL + 'sql-wasm.wasm';
    sqlStaticPromise = initSqlJs({ locateFile: () => wasmPath });
  }
  return sqlStaticPromise;
}

function authB64(creds: { username: string; password: string }): string {
  return btoa(`${creds.username}:${creds.password}`);
}

function normalizeProxyUrl(raw: string): string {
  let u = raw.trim();
  while (u.endsWith('/') || u.endsWith('?')) u = u.slice(0, -1);
  return u;
}

function buildProxyUrl(proxyUrl: string, targetUrl: string, auth: string): string {
  return `${normalizeProxyUrl(proxyUrl)}?url=${encodeURIComponent(targetUrl)}&auth=${encodeURIComponent(auth)}`;
}

function tablesSubDir(creds: { remoteDir: string }): string {
  return creds.remoteDir
    ? `${creds.remoteDir}/tables/table_sync`
    : 'tables/table_sync';
}

function buildTargetUrl(creds: { url: string; remoteDir: string }, file: string, pwa: boolean): string {
  const base = creds.url || DEFAULT_WEBDAV_BASE;
  const url = `${base}${tablesSubDir(creds)}/${file}`;
  return pwa ? url.replace(/([^:])\/{2,}/g, '$1/') : url;
}

/**
 * 获取云端分表清单 manifest.json。存在返回 JSON 对象，缺失返回 null。
 */
async function fetchRemoteManifest(
  creds: {
    url: string;
    username: string;
    password: string;
    remoteDir: string;
    proxyUrl?: string;
  }
): Promise<Record<string, { version?: string; rows?: number }> | null> {
  const pwa = isPwaClient();
  const auth = authB64(creds);
  const target = buildTargetUrl(creds, 'manifest.json', pwa);

  let resp: Response;
  if (pwa) {
    if (!creds.proxyUrl) throw new Error('PWA 分表同步需要 Deno Deploy 代理地址，请先配置代理 URL');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const proxyTarget = buildProxyUrl(creds.proxyUrl, target, auth);
      resp = await fetch(proxyTarget, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  } else {
    resp = await fetch(target, { headers: { Authorization: `Basic ${auth}` } });
  }

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`获取逐表清单失败: HTTP ${resp.status}`);
  const text = (await resp.text()).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed?.tables ?? {};
  } catch {
    return null;
  }
}

/**
 * 下载单个分表文件并返回解压后的 SQLite ArrayBuffer。云端均缺失返回 null。
 *
 * v4.3.2 提速：优先下载 .db.gz（桌面端配套 gzip 上传，传输体积约为裸 .db 的 1/5~1/10），
 * 以 gzip 魔数校验内容（防个别网关对 .gz 路径返回假 200）；旧云端只有未压缩 .db 时自动回退。
 */
async function fetchTableFile(
  creds: {
    url: string;
    username: string;
    password: string;
    remoteDir: string;
    proxyUrl?: string;
  },
  tableName: string
): Promise<ArrayBuffer | null> {
  const pwa = isPwaClient();
  const auth = authB64(creds);

  const fetchUrl = async (file: string): Promise<Response> => {
    const target = buildTargetUrl(creds, file, pwa);
    if (pwa) {
      if (!creds.proxyUrl) throw new Error('PWA 分表同步需要代理地址');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        return await fetch(buildProxyUrl(creds.proxyUrl, target, auth), { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    return fetch(target, { headers: { Authorization: `Basic ${auth}` } });
  };

  const gzResp = await fetchUrl(`${tableName}.db.gz`);
  if (gzResp.ok) {
    const gzBuf = await gzResp.arrayBuffer();
    const head = new Uint8Array(gzBuf.slice(0, 2));
    if (head[0] === 0x1f && head[1] === 0x8b) {
      const blob = await decompressGzip(new Blob([gzBuf]));
      return blob.arrayBuffer();
    }
  }

  const resp = await fetchUrl(`${tableName}.db`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`下载分表 ${tableName} 失败: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}

/**
 * 用 sql.js 打开云端单表 .db 文件，解析出 CREATE 语句 + 全量行。
 */
async function parseTableDb(bytes: ArrayBuffer, tableName: string): Promise<ParsedTable | null> {
  const SQL = await getSqlStatic();
  const tdb = new SQL.Database(new Uint8Array(bytes));
  try {
    const meta = tdb.exec(`SELECT name, sql FROM sqlite_master WHERE type='table'`);
    let createSql: string | null = null;
    if (meta.length > 0) {
      const idxName = meta[0].columns.indexOf('name');
      const idxSql = meta[0].columns.indexOf('sql');
      for (const row of meta[0].values) {
        if (row[idxName] === tableName) {
          createSql = String(row[idxSql] ?? '');
          break;
        }
      }
    }
    if (!createSql) return null;

    const data = tdb.exec(`SELECT * FROM "${tableName}"`);
    const columns: string[] = data.length > 0 ? data[0].columns : [];
    const rows: SqlValue[][] = data.length > 0 ? data[0].values : [];
    return { name: tableName, createSql, columns, rows };
  } finally {
    tdb.close();
  }
}

/**
 * 计算本地某表版本信号：
 *   - 表不存在 / 空表 → null（视为可被云端任意版本覆盖）
 *   - 维表有数据 → '0'（存在即初始化）
 *   - 事实表 → MAX(业务日期) 取前 10 位 'YYYY-MM-DD'
 * 与后端 compute_table_local 在「移动端无 watermark」场景下的兜底语义对齐。
 */
async function computeLocalVersion(table: SyncTableMeta): Promise<string | null> {
  try {
    const has = await mobileQuerySql<{ c?: number }>(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name=?",
      [table.name]
    );
    if (!has || !has[0]?.c) return null;

    if (table.type === 'dim') return '0';

    const rows = await mobileQuerySql<{ m?: string | number | null }>(
      `SELECT MAX("${table.dateCol}") AS m FROM "${table.name}"`,
      []
    );
    const v = rows?.[0]?.m;
    return v === null || v === undefined ? null : String(v).slice(0, 10);
  } catch {
    return null;
  }
}

/** 把解析出的分表转成安卓 executeSet 语句（DROP + CREATE + 全量 INSERT，单事务）。 */
function buildStatements(tables: ParsedTable[]): { statement: string; values: unknown[] }[] {
  const out: { statement: string; values: unknown[] }[] = [];
  for (const t of tables) {
    out.push({ statement: `DROP TABLE IF EXISTS "${t.name}"`, values: [] });
    out.push({ statement: t.createSql, values: [] });
    if (t.columns.length > 0 && t.rows.length > 0) {
      const placeholders = t.columns.map(() => '?').join(',');
      for (const row of t.rows) {
        out.push({ statement: `INSERT INTO "${t.name}" VALUES (${placeholders})`, values: [...row] });
      }
    }
  }
  return out;
}

/**
 * v4.3.2 提速：并发拉取多张分表（worker 池限流，默认并发 3，避免打爆坚果云 WAF）。
 * 某张表下载抛错会中断整体（与旧串行行为一致）；404 缺失以 null 传出、其余表继续。
 */
async function fetchTableFilesParallel(
  creds: Parameters<typeof fetchTableFile>[0],
  tableNames: string[],
  onResult: (name: string, bytes: ArrayBuffer | null) => Promise<void> | void,
  concurrency = 3
): Promise<void> {
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tableNames.length) },
    async () => {
      while (idx < tableNames.length) {
        const name = tableNames[idx++];
        const bytes = await fetchTableFile(creds, name);
        await onResult(name, bytes);
      }
    }
  );
  await Promise.all(workers);
}

/**
 * 移动端分表同步：v4.3.2 起默认全量拉取云端每张表的最新版本，整体覆盖合并进本地库。
 *
 * 返回 success + 更新了哪些表；云端无 manifest 时返回错误提示走整库同步。
 */
export async function syncTablesFromWebDAV(
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const creds = await getWebDAVCredentials();
  if (!creds) {
    return { success: false, message: '尚未配置 WebDAV 凭据，请点击「WebDAV 配置」按钮填入坚果云账号和应用密码' };
  }

  const step = (msg: string) => {
    console.log('[mobileTableSync]', msg);
    onProgress?.(msg);
  };

  try {
    step('1/4 获取云端逐表清单');
    const cloud = await fetchRemoteManifest(creds);
    if (!cloud) {
      return {
        success: false,
        message: '云端暂无逐表清单（可能对方仍是旧版桌面端整库上传）。请使用「从坚果云同步」整库拉取一次后，下次即可分表增量同步',
      };
    }

    // 2. v4.3.2：默认全量拉取——云端清单里存在的表一律下载最新版整体覆盖本地，
    //    不再版本比对跳过（版本号仅用于日志展示）；本地水位异常时也能强制对齐云端。
    //    v4.3.2 提速：单表改走 .db.gz 压缩格式 + 下载阶段并发拉取，整体耗时对齐整库快照
    step('2/4 确定待拉取表（云端最新版）');
    const pending: string[] = [];
    for (const table of MOBILE_SYNC_TABLES) {
      const cloudInfo = cloud[table.name];
      if (!cloudInfo) continue;
      const localV = await computeLocalVersion(table);
      step(`   - 拉取 ${table.name}（云端 ${cloudInfo.version ?? '未知'} / 本地 ${localV ?? '空'}）`);
      pending.push(table.name);
    }

    const parsed: ParsedTable[] = [];
    const updated: string[] = [];
    await fetchTableFilesParallel(creds, pending, async (name, bytes) => {
      if (!bytes) {
        step(`   - ${name} 云端文件缺失，跳过`);
        return;
      }
      const tbl = await parseTableDb(bytes, name);
      if (tbl) {
        parsed.push(tbl);
        updated.push(name);
      }
    });

    if (parsed.length === 0) {
      await saveLastSyncAt(new Date().toISOString());
      return { success: true, message: '各表已是最新，无需更新' };
    }

    // 3. 合并进本地库
    const mergeMsg = `3/4 合并 ${updated.length} 张表到本地数据库`;
    step(mergeMsg);
    if (isPwaClient()) {
      await mergeParsedTablesIntoLocal(parsed);
    } else {
      // v4.3.2：安卓端分块写入，回调刷新「x/y 批」进度，避免长时间无反馈
      await executeSetSql(buildStatements(parsed), (done, total) => {
        step(`${mergeMsg}（${done}/${total} 批）`);
      });
    }

    // 4. 持久化同步时间戳
    step('4/4 记录同步时间');
    await saveLastSyncAt(new Date().toISOString());

    return {
      success: true,
      message: `分表同步完成，已更新：${updated.join('、')}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[mobileTableSync] 分表同步失败:', errMsg);
    return { success: false, message: `分表同步失败: ${errMsg}` };
  }
}