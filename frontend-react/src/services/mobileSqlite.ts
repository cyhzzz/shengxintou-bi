/**
 * Capacitor SQLite 移动端本地数据库封装
 *
 * v3.5.3 关键修复：
 *   @capacitor-community/sqlite 7.x 不再导出 SQLiteConnection / SQLiteDBConnection 类，
 *   必须直接用 CapacitorSQLite 插件对象调用原生方法。
 *   旧版 `new SQLiteConnection(CapacitorSQLite)` 在运行时返回 undefined →
 *   所有后续调用抛 "me.some is not a function"（minified 错误）。
 *
 *   本版本直接调用 CapacitorSQLite 插件接口：
 *     createConnection({ database, encrypted, mode, version, readonly })
 *     open({ database }) / close({ database })
 *     query({ database, statement, values })
 *     deleteDatabase({ database }) / closeConnection({ database, readonly })
 *     isDatabase({ database })
 *     copyFromAssets({ overwrite })
 *     moveDatabasesAndAddSuffix({ folderPath })
 *
 *   DB 文件实际位置：/data/data/<pkg>/databases/<DB_NAME>SQLite.db
 *   （由 context.getDatabasePath() 决定，非 Filesystem.Directory.Data）。
 */
import { CapacitorSQLite } from '@capacitor-community/sqlite';

const DB_NAME = 'shengxintou';
let dbOpen = false;

/**
 * v3.5.3：从 APK 内置的 assets/databases/shengxintouSQLite.db 复制到应用数据目录
 *
 * 在首次安装时，无需联网即可获得基础数据。
 * Capacitor SQLite 的 copyFromAssets 是原生层操作，不走 JS 层 base64。
 */
export async function copyDatabaseFromAssets(overwrite = false): Promise<void> {
  await CapacitorSQLite.copyFromAssets({ overwrite });
}

/**
 * v3.5.3：把 cache 目录中的 .db 文件移动到 SQLite 数据库目录并自动加 SQLite 后缀
 *
 * 用于 syncFromWebDAV 流程：
 *   1. fetch 下载 shengxintou.db 到 Blob
 *   2. base64 编码
 *   3. Filesystem.writeFile 写到 Directory.Cache（路径为 /data/data/<pkg>/cache/）
 *   4. 调用本函数 → moveDatabasesAndAddSuffix({ folderPath: 'cache' }) 把 shengxintou.db
 *      移动到 /data/data/<pkg>/databases/shengxintouSQLite.db
 */
export async function moveDatabaseFromCache(): Promise<void> {
  await CapacitorSQLite.moveDatabasesAndAddSuffix({ folderPath: 'cache' });
}

export async function initMobileDatabase(): Promise<void> {
  if (dbOpen) return;
  // 建立连接 + 打开数据库
  await CapacitorSQLite.createConnection({
    database: DB_NAME,
    encrypted: false,
    mode: 'no-encryption',
    version: 1,
    readonly: false,
  });
  await CapacitorSQLite.open({ database: DB_NAME });
  dbOpen = true;
}

export async function querySql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!dbOpen) await initMobileDatabase();
  const result = await CapacitorSQLite.query({
    database: DB_NAME,
    statement: sql,
    values: params as any[],
  });
  return (result.values ?? []) as T[];
}

export async function closeMobileDatabase(): Promise<void> {
  if (dbOpen) {
    try {
      await CapacitorSQLite.close({ database: DB_NAME });
    } catch {
      /* ignore */
    }
    try {
      await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
    } catch {
      /* ignore */
    }
    dbOpen = false;
  }
}

/**
 * v3.5.3：检查 DB 是否存在于 SQLite 插件读取的目录
 *
 * 用原生 API isDatabase({ database }) 检查
 * /data/data/<pkg>/databases/shengxintouSQLite.db 是否存在。
 */
export async function databaseExists(): Promise<boolean> {
  try {
    const res = await CapacitorSQLite.isDatabase({ database: DB_NAME });
    return !!res?.result;
  } catch {
    return false;
  }
}

/**
 * v3.5.3：删除现有 DB 文件（用于同步前清理，避免 move 时冲突）
 *
 * 用 deleteDatabase({ database }) 删除 /data/data/<pkg>/databases/shengxintouSQLite.db
 */
export async function deleteMobileDatabase(): Promise<void> {
  try {
    // 先确保连接已关闭，否则 delete 会失败
    if (dbOpen) {
      try { await CapacitorSQLite.close({ database: DB_NAME }); } catch { /* ignore */ }
      dbOpen = false;
    }
    await CapacitorSQLite.deleteDatabase({ database: DB_NAME });
  } catch {
    /* DB 不存在或删除失败，忽略 */
  }
}
