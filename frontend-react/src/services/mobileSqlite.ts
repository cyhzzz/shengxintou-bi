/**
 * 本地数据库封装（Capacitor SQLite + sql.js PWA 双适配器）
 *
 * v3.6.2：新增 PWA 端 sql.js 适配器，让 iOS Safari 能直接在浏览器里读 SQLite。
 *   - 安卓端（isMobileClient）：走 CapacitorSQLite 原生插件，DB 文件在应用沙箱
 *   - PWA 端（isPwaClient）：走 sql.js (WASM)，DB 文件在 IndexedDB
 *   - Web/桌面端：不调用本模块（走 Flask API）
 *
 *   对 mobileRouteHandler.ts 完全透明：只导出 querySql 等同名函数，内部按运行时分发。
 *
 * v4.3.2：querySql 缺表容错（安卓/PWA 两端同语义）——老用户本地库可能缺后续版本新增的表
 *   （旧内置空库或旧整库 WebDAV 恢复覆盖），缺表查询按空结果降级（console.warn），
 *   页面按「无数据」渲染而非弹原生 SQL 报错；「数据同步」分表同步查 sqlite_master
 *   发现缺表会强制下载建表，形成自愈闭环。
 *
 * v3.5.3 关键修复（安卓端）：
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
import { isPwaClient } from '@/utils/isDesktop';

const DB_NAME = 'shengxintou';
let dbOpen = false;
// v3.8.8：并发初始化单例 Promise。App.tsx 启动流程与 EmptyDbGuide 都会触发初始化，
// 若两次 createConnection 交错，后到的会抛 "Connection already exists" / open 失败，
// 导致 EmptyDbGuide 的判定查询抛异常被 catch 误判为空库，引导横幅每次冷启动都误弹。
// 用模块级 Promise 合并并发初始化，保证只真正 open 一次。
let dbInitPromise: Promise<void> | null = null;

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
 * v3.5.4：把 cache 目录中的 .db 文件移动到 SQLite 数据库目录并自动加 SQLite 后缀
 *
 * 用于 syncFromWebDAV 流程：
 *   1. fetch 下载 shengxintou.db 到 Blob
 *   2. 分块 base64 编码 + Filesystem.writeFile/appendFile 写到 Directory.Cache
 *   3. 调用本函数 → moveDatabasesAndAddSuffix({ folderPath: 'cache', dbNameList: ['shengxintou.db'] })
 *      把 cache/shengxintou.db 移动到 databases/shengxintouSQLite.db
 *
 * v3.5.4 关键修复：@capacitor-community/sqlite 7.0.3 的 moveDatabasesAndAddSuffix
 * 要求 dbNameList 参数非空，否则报 "dbNameList not given or empty"。
 *
 * v3.6.1 终极根因修复：UtilsMigrate.java 第 159 行 `dbList.contains(file)` 用的是
 * **完整文件名**做匹配（file = 'shengxintou.db'）。之前传 `['shengxintou']`（不带 .db 后缀），
 * contains 永远返回 false → rename 永远不会执行 → 同步表面成功但 DB 没被替换。
 * 改为传 `['shengxintou.db']`（带 .db 后缀）才能匹配。
 */
export async function moveDatabaseFromCache(): Promise<void> {
  await CapacitorSQLite.moveDatabasesAndAddSuffix({
    folderPath: 'cache',
    dbNameList: ['shengxintou.db'],
  });
}

export async function initMobileDatabase(): Promise<void> {
  if (dbOpen) return;
  // 已有进行中的初始化则合并到同一 Promise，避免并发 createConnection 竞态
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      // v3.5.4：closeMobileDatabase 在 reload/状态错乱后可能没真正关掉原生层连接，
      // 此时 createConnection 会抛 "Connection shengxintou already exists"。
      // 先静默 closeConnection 一次（连接不存在时原生层会返回，不抛错），再 create。
      try {
        await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
      } catch {
        /* connection not exist is fine */
      }

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
    } finally {
      // 成功/失败都清掉 in-flight Promise；失败时允许下一次重试
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

/**
 * v4.3.2：识别「缺表」错误（CapacitorSQLite 原生层与 sql.js 的错误消息格式一致：
 * "... no such table: <表名> ..."）。仅缺表降级为空结果，其他错误照常抛出。
 */
function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /no such table/i.test(msg);
}

export async function querySql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  // v3.6.2：PWA 端走 sql.js，与安卓端逻辑分离
  if (isPwaClient()) {
    const { querySql: pwaQuerySql } = await import('./sqlJsAdapter');
    return pwaQuerySql<T>(sql, params);
  }

  if (!dbOpen) await initMobileDatabase();
  try {
    const result = await CapacitorSQLite.query({
      database: DB_NAME,
      statement: sql,
      values: params as any[],
    });
    return (result.values ?? []) as T[];
  } catch (e) {
    // v4.3.2：老库缺新表时按空结果降级，页面按「无数据」渲染而非弹原生 SQL 报错；
    // 分表同步（computeLocalVersion 查 sqlite_master）发现缺表会强制下载建表，自愈闭环
    if (isMissingTableError(e)) {
      console.warn('[mobileSqlite] 本地库缺表，按空结果降级:', e instanceof Error ? e.message : e);
      return [];
    }
    throw e;
  }
}

export async function closeMobileDatabase(): Promise<void> {
  // v3.6.1：无条件关闭。reload 后 dbOpen 会被重置为 false，
  // 但原生层连接可能仍然存在（导致 deleteDatabase 被锁、move 被跳过）。
  // closeConnection 在连接不存在时原生层会幂等返回，不会抛错。
  try {
    await CapacitorSQLite.close({ database: DB_NAME });
  } catch {
    /* connection not open is fine */
  }
  try {
    await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
  } catch {
    /* connection not exist is fine */
  }
  dbOpen = false;
}

/**
 * v3.9.5：批量执行写语句（DROP/CREATE/INSERT）。
 *
 * 用于移动端分表同步把云端「单表 .db」合并进本地 Capacitor SQLite：
 * 对每张表 DROP + CREATE（原 schema）+ 逐行 INSERT，语义与后端 merge_sqlite_table_into 一致，
 * 且不触碰其它表。
 *
 * v4.3.2：分块执行——原先 9 张表全部语句一次性 executeSet，大表（数十万行 INSERT）场景下
 * 单次跨 JS→原生桥 payload 过大，原生层反序列化直接 OOM 闪退（App 直接消失，JS catch 捕获不到）。
 * 改为按「语句数 ≤ 500 且估算字符量 ≤ 2MB」切块、每块单独事务 execute：
 * 中途失败目标表可能只写入部分数据，但分表同步 v4.3.2 起默认全量拉取，
 * 下次同步会 DROP + CREATE 整体重建该表，可自愈。
 */
/** 单块语句数上限 */
const EXECUTE_SET_CHUNK_STATEMENTS = 500;
/** 单块估算 payload 字符量上限（语句 + 参数值字符长度粗估） */
const EXECUTE_SET_CHUNK_CHARS = 2_000_000;

function chunkStatements(
  statements: { statement: string; values: unknown[] }[]
): { statement: string; values: unknown[] }[][] {
  const chunks: { statement: string; values: unknown[] }[][] = [];
  let cur: { statement: string; values: unknown[] }[] = [];
  let curChars = 0;
  const flush = () => {
    if (cur.length > 0) chunks.push(cur);
    cur = [];
    curChars = 0;
  };
  for (const s of statements) {
    const size =
      s.statement.length + s.values.reduce<number>((a, v) => a + String(v ?? '').length + 8, 0);
    if (
      cur.length > 0 &&
      (cur.length >= EXECUTE_SET_CHUNK_STATEMENTS || curChars + size > EXECUTE_SET_CHUNK_CHARS)
    ) {
      flush();
    }
    cur.push(s);
    curChars += size;
  }
  flush();
  return chunks;
}

export async function executeSetSql(
  statements: { statement: string; values: unknown[] }[],
  onChunkDone?: (done: number, total: number) => void
): Promise<void> {
  if (!statements || statements.length === 0) return;
  if (!dbOpen) await initMobileDatabase();
  const chunks = chunkStatements(statements);
  for (let i = 0; i < chunks.length; i++) {
    try {
      await CapacitorSQLite.executeSet({
        database: DB_NAME,
        set: chunks[i].map((s) => ({
          statement: s.statement,
          values: s.values as any[],
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `写入本地库第 ${i + 1}/${chunks.length} 批失败（本批 ${chunks[i].length} 条语句）: ${msg}`
      );
    }
    onChunkDone?.(i + 1, chunks.length);
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
 *
 * v3.6.1 历史根因：
 *   1) 旧版在 dbOpen===false 时跳过 close，原生层连接未断开 → deleteDatabase 被锁失败被静默吞
 *   2) 第一次修复尝试无条件 closeConnection，但发现 @capacitor-community/sqlite 的
 *      deleteDatabase 要求 dbDict 里必须有 "RW_<dbName>" 连接对象（见插件 Java 源码
 *      CapacitorSQLite.java L1074-1091），否则抛
 *      "No available connection for database shengxintou"
 *
 * v3.6.1 正确顺序：
 *   1) close（关 SQLiteDatabase，避免文件锁）
 *   2) closeConnection（清理旧连接对象，避免 createConnection 报 already exists）
 *   3) createConnection（建立新连接对象，但 _isOpen=false）
 *   4) deleteDatabase（通过连接对象执行 deleteDB，内部会自动 open+close+delete）
 *   5) closeConnection（清理 dbDict）
 *
 * deleteDatabase 的 "DB 不存在" 错误是正常的（首次同步），不抛出；
 * 其他错误抛真错，让上层 syncFromWebDAV 能感知失败。
 * 删除后用 isDatabase 校验确实删除；若仍存在则抛错。
 */
export async function deleteMobileDatabase(): Promise<void> {
  // 1. 关闭 SQLiteDatabase（避免文件锁）
  try {
    await CapacitorSQLite.close({ database: DB_NAME });
  } catch {
    /* not open is fine */
  }
  dbOpen = false;

  // 2. 清理旧连接对象（避免 createConnection 报 "already exists"）
  try {
    await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
  } catch {
    /* not exist is fine */
  }

  // 3. 建立新连接对象（不 open）—— deleteDatabase 要求 dbDict 里有连接
  try {
    await CapacitorSQLite.createConnection({
      database: DB_NAME,
      encrypted: false,
      mode: 'no-encryption',
      version: 1,
      readonly: false,
    });
  } catch {
    /* 可能已存在，忽略 */
  }

  // 4. 删除 DB 文件（Database.deleteDB 内部会 open + close + delete）
  let deleteOk = true;
  try {
    await CapacitorSQLite.deleteDatabase({ database: DB_NAME });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // "database does not exist" / "No such file" 是正常情况（首次同步），不算错
    if (/not exist|no such|not found|does not exist/i.test(msg)) {
      deleteOk = true;
    } else {
      // 兜底清理连接对象
      try {
        await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
      } catch {
        /* ignore */
      }
      throw new Error(`deleteDatabase 失败: ${msg}`);
    }
  }

  // 5. 清理 dbDict 里的连接对象
  try {
    await CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false });
  } catch {
    /* ignore */
  }

  // 6. 校验确实删除（防 deleteDatabase 静默失败）
  if (deleteOk) {
    try {
      const res = await CapacitorSQLite.isDatabase({ database: DB_NAME });
      if (res?.result) {
        throw new Error('deleteDatabase 后数据库仍存在，可能文件被锁定，请重启 App 后重试');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/仍存在|locked|锁定/.test(msg)) {
        throw e;
      }
      // isDatabase 不可靠时只 warn，不阻塞流程（move 后的 verification 会兜底）
      console.warn('[mobileSqlite] deleteMobileDatabase: isDatabase 校验失败（不阻塞）:', msg);
    }
  }
}
