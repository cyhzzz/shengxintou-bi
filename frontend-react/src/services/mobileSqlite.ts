/**
 * Capacitor SQLite 移动端本地数据库封装
 *
 * Capacitor JS 包（@capacitor-core / @capacitor-community/sqlite / @capacitor/filesystem）
 * 安装在 frontend-react/node_modules 中。在 Web 浏览器中 Capacitor 的 registerPlugin
 * 返回 no-op 代理，不会产生副作用；在 Capacitor WebView 中通过原生桥接访问 SQLite。
 *
 * 调用方必须先检查 isMobileClient() 再使用本模块的函数。
 *
 * v3.5.3 关键修复：
 *   SQLite 插件的 DB 文件实际位置是 /data/data/<pkg>/databases/<DB_NAME>SQLite.db
 *   （由 context.getDatabasePath() 决定，不是 Filesystem.Directory.Data）。
 *   旧版 databaseExists/syncFromWebDAV 错误地用 Directory.Data 检查/写入，
 *   导致 SQLite 永远找不到同步下来的数据。本版本修正了这一路径不一致问题。
 */
import { SQLiteConnection, CapacitorSQLite, type SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'shengxintou';

let sqlite: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;

function ensureSQLite(): SQLiteConnection {
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  return sqlite;
}

/**
 * v3.5.3：从 APK 内置的 assets/databases/shengxintouSQLite.db 复制到应用数据目录
 *
 * 在首次安装时，无需联网即可获得基础数据。
 * 后续可通过 mobileSync.syncFromWebDAV() 从坚果云拉取最新版本覆盖。
 *
 * Capacitor SQLite 的 copyFromAssets 是原生层操作，
 * 不走 JS 层 base64，避免大文件在 WebView 中 OOM。
 */
export async function copyDatabaseFromAssets(overwrite = false): Promise<void> {
  await ensureSQLite().copyFromAssets(overwrite);
}

/**
 * v3.5.3：把 cache 目录中的 .db 文件移动到 SQLite 数据库目录并自动加 SQLite 后缀
 *
 * 用于 syncFromWebDAV 流程：
 *   1. fetch 下载 shengxintou.db 到 Blob
 *   2. base64 编码
 *   3. Filesystem.writeFile 写到 Directory.Cache（路径为 /data/data/<pkg>/cache/）
 *   4. 调用本函数 → moveDatabasesAndAddSuffix('cache') 把 shengxintou.db 移动到
 *      /data/data/<pkg>/databases/shengxintouSQLite.db（SQLite 插件读取位置）
 */
export async function moveDatabaseFromCache(): Promise<void> {
  await ensureSQLite().moveDatabasesAndAddSuffix('cache', []);
}

export async function initMobileDatabase(): Promise<void> {
  if (dbConnection) return;
  const conn = ensureSQLite();
  await conn.checkConnectionsConsistency();
  const db = await conn.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  dbConnection = db;
}

export async function querySql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!dbConnection) await initMobileDatabase();
  const result = await dbConnection!.query(sql, params);
  return result.values as T[];
}

export async function closeMobileDatabase(): Promise<void> {
  if (sqlite && dbConnection) {
    try {
      await dbConnection.close();
    } catch {
      /* ignore */
    }
    dbConnection = null;
  }
}

/**
 * v3.5.3：检查 DB 是否存在于 SQLite 插件读取的目录
 *
 * 用原生 API isDatabase({ database: 'shengxintou' }) 检查
 * /data/data/<pkg>/databases/shengxintouSQLite.db 是否存在。
 *
 * 旧版用 Filesystem.readFile(Directory.Data) 检查的是错误路径
 * /Android/data/<pkg>/files/shengxintouSQLite.db，永远返回 false。
 */
export async function databaseExists(): Promise<boolean> {
  try {
    const res = await ensureSQLite().isDatabase(DB_NAME);
    return !!res?.result;
  } catch {
    return false;
  }
}

/**
 * v3.5.3：删除现有 DB 文件（用于同步前清理，避免 move 时冲突）
 *
 * 用 SQLiteDBConnection.delete() 删除 /data/data/<pkg>/databases/shengxintouSQLite.db
 */
export async function deleteMobileDatabase(): Promise<void> {
  try {
    const conn = ensureSQLite();
    const db = await conn.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.delete();
    await conn.closeConnection(DB_NAME, false);
  } catch {
    /* DB 不存在或连接失败，忽略 */
  }
}

