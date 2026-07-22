/**
 * Capacitor SQLite 移动端本地数据库封装
 *
 * Capacitor JS 包（@capacitor-core / @capacitor-community/sqlite / @capacitor/filesystem）
 * 安装在 frontend-react/node_modules 中。在 Web 浏览器中 Capacitor 的 registerPlugin
 * 返回 no-op 代理，不会产生副作用；在 Capacitor WebView 中通过原生桥接访问 SQLite。
 *
 * 调用方必须先检查 isMobileClient() 再使用本模块的函数。
 */
import { SQLiteConnection, CapacitorSQLite, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Filesystem, Directory } from '@capacitor/filesystem';

const DB_NAME = 'shengxintou';

let sqlite: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;

export async function initMobileDatabase(): Promise<void> {
  if (dbConnection) return;
  sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.checkConnectionsConsistency();
  const conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await conn.open();
  dbConnection = conn;
}

export async function querySql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!dbConnection) await initMobileDatabase();
  const result = await dbConnection!.query(sql, params);
  return result.values as T[];
}

export async function closeMobileDatabase(): Promise<void> {
  if (sqlite && dbConnection) {
    await dbConnection.close();
    dbConnection = null;
  }
}

export async function getMobileDatabasePath(): Promise<string> {
  return `${DB_NAME}SQLite.db`;
}

export async function databaseExists(): Promise<boolean> {
  try {
    const result = await Filesystem.readFile({
      path: `${DB_NAME}SQLite.db`,
      directory: Directory.Data,
    });
    return !!result.data;
  } catch {
    return false;
  }
}
