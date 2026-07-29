/**
 * PWA 端 SQLite 适配器（基于 sql.js / WASM）
 *
 * 设计目标：
 *   - 让 mobileRouteHandler.ts 在 PWA 环境下复用所有 SQL 查询逻辑（与安卓端完全一致）
 *   - 整个 DB 加载到 sql.js 的堆内存（ArrayBuffer），适合 30-80MB 的 SQLite 文件
 *   - DB 持久化在 IndexedDB（key: 'shengxintou-db'），避免 iOS Safari 7 天清理 PWA 数据时丢失
 *
 * 工作流程：
 *   1. 首次启动：IndexedDB 无 DB → 提示用户去「数据同步」页面同步
 *   2. 同步：fetch 走 Deno Deploy 代理下载 .db.gz → 解压 → 写入 IndexedDB → 加载到 sql.js
 *   3. 后续启动：从 IndexedDB 读出 ArrayBuffer → 直接喂给 sql.js（无需重新下载）
 *
 * v3.6.2 新增：iOS PWA 支持
 */
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

const DB_KEY = 'shengxintou-db';
const STORE_NAME = 'databases';
const DB_NAME = 'shengxintou-pwa';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * 获取 IndexedDB 中的 DB ArrayBuffer
 *
 * PWA 模式下，DB 文件以 ArrayBuffer 形式存储在 IndexedDB。
 * iOS Safari 在存储空间紧张时会清理 7 天未使用的 PWA 数据，
 * 所以这里返回 null 时上层应引导用户重新同步。
 */
async function loadDbFromIndexedDB(): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const idb = req.result;
      try {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(DB_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => reject(getReq.error);
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 把 DB ArrayBuffer 写入 IndexedDB（持久化）
 */
async function saveDbToIndexedDB(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const idb = req.result;
      try {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(buffer, DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 初始化 sql.js WASM 并加载 IndexedDB 中的 DB
 *
 * 幂等：多次调用返回同一个 Database 实例。
 * wasm 文件路径根据运行时 base 自动适配（PWA 在 /app/ 子路径，Web 在 /）。
 */
export async function initSqlJsDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. 加载 sql.js WASM
    // locateFile 决定 wasm 文件的 URL，必须与 PWA 部署路径一致
    // PWA 部署到 /app/ 时 wasm 在 /app/sql-wasm.wasm
    // Web/桌面版部署到 / 时 wasm 在 /sql-wasm.wasm
    const wasmPath = import.meta.env.BASE_URL + 'sql-wasm.wasm';
    SQL = await initSqlJs({ locateFile: () => wasmPath });

    // 2. 从 IndexedDB 加载已有 DB
    const buffer = await loadDbFromIndexedDB();
    if (buffer) {
      db = new SQL.Database(new Uint8Array(buffer));
      return db;
    }

    // 3. IndexedDB 无 DB：抛错，上层引导用户去同步
    throw new Error('PWA_LOCAL_DB_NOT_INITIALIZED');
  })();

  try {
    return await initPromise;
  } catch (e) {
    // 失败时清空 initPromise 允许重试
    initPromise = null;
    throw e;
  }
}

/**
 * 用新的 DB ArrayBuffer 替换当前 sql.js 实例
 *
 * 用于同步流程：下载新 DB 后调用此函数加载到 sql.js，并持久化到 IndexedDB。
 */
export async function loadNewDb(buffer: ArrayBuffer): Promise<void> {
  // 关闭旧实例
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
  initPromise = null;

  // 创建新实例
  if (!SQL) {
    const wasmPath = import.meta.env.BASE_URL + 'sql-wasm.wasm';
    SQL = await initSqlJs({ locateFile: () => wasmPath });
  }
  db = new SQL.Database(new Uint8Array(buffer));

  // 持久化到 IndexedDB
  await saveDbToIndexedDB(buffer);
}

/**
 * 执行 SQL 查询，返回行数组
 *
 * 与 mobileSqlite.ts 的 querySql 签名完全一致，对 mobileRouteHandler 透明。
 * sql.js 的 db.exec() 返回 [{columns, values}]，这里展平为 [{col: val}] 对象数组。
 *
 * 注意：sql.js 不支持参数绑定的 ? 占位符（只能用 exec），所以本函数做了简单替换。
 * 现有 mobileRouteHandler.ts 的 SQL 全部用 ${} 模板字符串拼接（已在调用方做转义），
 * 极少数用 ? 的地方用 prepared statement。
 */
export async function querySql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!db) await initSqlJsDatabase();

  // sql.js 的 exec 不支持 ? 参数绑定，需要用 prepare + bind
  // 但绝大多数 mobileRouteHandler SQL 都没用 ?，直接 exec 即可
  if (params.length === 0) {
    const result = db!.exec(sql);
    if (result.length === 0) return [] as T[];
    const { columns, values } = result[0];
    return values.map((row: SqlValue[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj as T;
    });
  }

  // 有参数：用 prepared statement
  const stmt = db!.prepare(sql);
  try {
    stmt.bind(params as SqlValue[]);
    const rows: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as T;
      rows.push(row);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/**
 * 检查 IndexedDB 中是否已有 DB（用于判断是否需要引导用户同步）
 */
export async function hasLocalDb(): Promise<boolean> {
  const buffer = await loadDbFromIndexedDB();
  return !!buffer;
}

/**
 * 删除 IndexedDB 中的 DB（用于重新同步前清理）
 */
export async function deleteLocalDb(): Promise<void> {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
  initPromise = null;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const idb = req.result;
      try {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
