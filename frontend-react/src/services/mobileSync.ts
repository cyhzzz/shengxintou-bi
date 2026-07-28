/**
 * 移动端 + PWA 端 WebDAV 同步（坚果云）
 *
 * v3.5.4 关键修复：
 *   1. 后端上传到坚果云的文件名是 backup_YYYYMMDD_HHMMSS.db.gz（gzip 压缩），
 *      移动端通过 GET latest_backup.txt manifest 获取最新备份文件名（避免 PROPFIND）。
 *   2. 下载的文件写入 cache/shengxintou.db，再由 moveDatabasesAndAddSuffix
 *      原生移动到 databases/shengxintouSQLite.db。
 *   3. 分块写入：解压后的 SQLite 可能 30+ MB，base64 编码后 50+ MB，
 *      一次性传给 Filesystem.writeFile 会导致 WebView 内存溢出崩溃。
 *      改用 1MB 分块 + appendFile 写入，每块都是独立 PostMessage，避免内存峰值。
 *
 * v3.6.0 安全修复：
 *   - 移除 vite 构建期对根 .env WEBDAV_* 的注入（原实现会把开发凭据烤进 dist bundle，随 APK 泄露）
 *   - 凭据完全由用户在前端「数据同步」页面填写，通过 @capacitor/preferences 持久化
 *   - WebDAV 服务器地址（url）也由用户配置，默认坚果云 https://dav.jianguoyun.com/dav/
 *   - 未配置时所有同步/测试连接调用返回友好错误，由 UI 引导用户去配置
 *
 * v3.6.2 PWA 支持：
 *   - PWA 端无 Capacitor 插件，凭据存 localStorage（同源隔离，HTTPS 才可访问）
 *   - 坚果云 WebDAV 不支持 CORS，PWA 必须走 Cloudflare Worker 代理
 *   - Worker URL 由用户配置（localStorage key: webdav_proxy_url），未配置时给出引导
 *   - 下载的 DB 直接加载到 sql.js（IndexedDB 持久化），不走 Filesystem
 */
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  closeMobileDatabase,
  initMobileDatabase,
  moveDatabaseFromCache,
  deleteMobileDatabase,
} from './mobileSqlite';
import { isPwaClient } from '@/utils/isDesktop';

// 坚果云固定 WebDAV 入口（非凭据，可作为默认值）
const DEFAULT_WEBDAV_BASE = 'https://dav.jianguoyun.com/dav/';

export interface SyncResult {
  success: boolean;
  message: string;
  size?: number;
  timestamp?: string;
}

export async function saveWebDAVCredentials(
  username: string,
  password: string,
  remoteDir: string,
  url?: string
): Promise<void> {
  // v3.6.2：PWA 端用 localStorage，安卓端用 @capacitor/preferences
  if (isPwaClient()) {
    localStorage.setItem('webdav_username', username);
    localStorage.setItem('webdav_password', password);
    localStorage.setItem('webdav_remote_dir', remoteDir);
    localStorage.setItem('webdav_url', url || '');
    return;
  }
  await Preferences.set({ key: 'webdav_username', value: username });
  await Preferences.set({ key: 'webdav_password', value: password });
  await Preferences.set({ key: 'webdav_remote_dir', value: remoteDir });
  // v3.6.0：url 也持久化，允许用户配置非坚果云的 WebDAV 服务器
  await Preferences.set({ key: 'webdav_url', value: url || '' });
}

export async function getWebDAVCredentials(): Promise<{
  url: string;
  username: string;
  password: string;
  remoteDir: string;
  proxyUrl?: string;  // v3.6.2：PWA 专用，Cloudflare Worker 代理地址
} | null> {
  // v3.6.2：PWA 端从 localStorage 读
  if (isPwaClient()) {
    const username = localStorage.getItem('webdav_username');
    const password = localStorage.getItem('webdav_password');
    const remoteDir = localStorage.getItem('webdav_remote_dir') || '';
    const url = localStorage.getItem('webdav_url') || DEFAULT_WEBDAV_BASE;
    const proxyUrl = localStorage.getItem('webdav_proxy_url') || '';
    if (username && password) {
      return { url, username, password, remoteDir, proxyUrl };
    }
    return null;
  }

  const { value: url } = await Preferences.get({ key: 'webdav_url' });
  const { value: username } = await Preferences.get({ key: 'webdav_username' });
  const { value: password } = await Preferences.get({ key: 'webdav_password' });
  const { value: remoteDir } = await Preferences.get({ key: 'webdav_remote_dir' });
  // v3.6.0：必须用户已配置 username + password 才算有效；不再回退任何打包默认值
  if (username && password) {
    return {
      url: url || DEFAULT_WEBDAV_BASE,
      username,
      password,
      remoteDir: remoteDir || '',
    };
  }
  return null;
}

/**
 * v3.6.2：保存 PWA 的 Cloudflare Worker 代理 URL
 *
 * PWA 端因坚果云 WebDAV 不支持 CORS，必须走 Worker 代理。
 * 此函数仅 PWA 模式有效，安卓端调用为空操作。
 */
export async function saveWebDAVProxyUrl(proxyUrl: string): Promise<void> {
  if (isPwaClient()) {
    localStorage.setItem('webdav_proxy_url', proxyUrl);
  }
}

export async function hasWebDAVCredentials(): Promise<boolean> {
  const creds = await getWebDAVCredentials();
  return !!creds;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 解压 gzip Blob → 未压缩 Blob
 *
 * 后端上传的备份是 backup_*.db.gz（gzip 压缩），
 * 下载后必须解压才能被 SQLite 读取。
 *
 * 使用浏览器原生 DecompressionStream API（Chrome 80+ / Android WebView 90+）。
 */
async function decompressGzip(blob: Blob): Promise<Blob> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前 WebView 不支持 DecompressionStream，无法解压 .db.gz');
  }
  const ds = new DecompressionStream('gzip');
  const decompressedStream = blob.stream().pipeThrough(ds);
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
  return new Blob([decompressedBuffer], { type: 'application/octet-stream' });
}

/**
 * 分块写入大文件到 Filesystem
 *
 * 一次性传 50+ MB base64 给 Filesystem.writeFile 会导致 WebView PostMessage
 * 内存溢出崩溃（Android WebView 默认堆内存有限）。
 *
 * 改用 1MB 二进制分块策略：
 *   - 每块二进制 1MB → base64 后 ~1.4MB 字符串
 *   - 第一块用 writeFile（创建新文件）
 *   - 后续块用 appendFile（追加）
 *   - 每块都是独立的 PostMessage，避免内存峰值
 *
 * @param blob 要写入的 Blob 数据
 * @param path 目标文件路径
 * @param directory 目标目录
 */
const CHUNK_SIZE = 1024 * 1024; // 1MB 二进制块

async function writeFileInChunks(
  blob: Blob,
  path: string,
  directory: Directory
): Promise<void> {
  const totalChunks = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, blob.size);
    const chunk = blob.slice(start, end);
    const chunkBase64 = await blobToBase64(chunk);

    if (i === 0) {
      // 第一块：创建新文件（recursive 创建父目录）
      await Filesystem.writeFile({
        path,
        data: chunkBase64,
        directory,
        recursive: true,
      });
    } else {
      // 后续块：追加
      await Filesystem.appendFile({
        path,
        data: chunkBase64,
        directory,
      });
    }
  }
}

/**
 * GET latest_backup.txt 获取坚果云上最新的备份文件名
 *
 * 后端在上传 backup_*.db.gz 时，同时上传一个 latest_backup.txt manifest 文件，
 * 内容为最新备份的文件名。移动端用标准 GET 请求获取此文件即可知道下载哪个备份。
 *
 * 使用标准 GET 方法是因为 CapacitorHttp 的 Android 原生层基于
 * java.net.HttpURLConnection，不支持 PROPFIND 等 WebDAV 扩展方法。
 */
async function getLatestRemoteDb(
  baseUrl: string,
  remoteDir: string,
  auth: string
): Promise<string | null> {
  const manifestUrl = remoteDir
    ? `${baseUrl}${remoteDir}/latest_backup.txt`
    : `${baseUrl}latest_backup.txt`;

  const response = await fetch(manifestUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (response.status === 404) {
    return null; // manifest 不存在（旧版后端未上传）
  }

  if (!response.ok) {
    throw new Error(`获取备份列表失败: HTTP ${response.status}`);
  }

  const filename = (await response.text()).trim();
  if (!filename) return null;

  return filename;
}

export async function syncFromWebDAV(): Promise<SyncResult> {
  const creds = await getWebDAVCredentials();
  if (!creds) {
    return { success: false, message: '尚未配置 WebDAV 凭据，请点击「WebDAV 配置」按钮填入坚果云账号和应用密码' };
  }

  // v3.6.2：PWA 端走 sql.js + IndexedDB，不走 Capacitor Filesystem
  if (isPwaClient()) {
    return syncFromWebDAVPwa(creds);
  }

  const log: string[] = [];
  const step = (msg: string) => {
    log.push(msg);
    console.log(`[mobileSync] ${msg}`);
  };

  try {
    // 1. 关闭现有连接，避免文件锁
    step('1/7 关闭现有连接');
    await closeMobileDatabase();

    // 2. GET latest_backup.txt 获取最新备份文件名
    step('2/7 获取最新备份元数据');
    const auth = btoa(`${creds.username}:${creds.password}`);
    const baseUrl = creds.url;
    const latestFile = await getLatestRemoteDb(baseUrl, creds.remoteDir, auth);

    if (!latestFile) {
      return { success: false, message: '坚果云上未找到 latest_backup.txt，请先在桌面端上传备份（需更新桌面版）' };
    }
    step(`  最新备份: ${latestFile}`);

    // 3. 下载最新备份
    step('3/7 下载备份文件');
    const remotePath = creds.remoteDir
      ? `${creds.remoteDir}/${latestFile}`
      : latestFile;
    const fullUrl = `${baseUrl}${remotePath}`;

    const response = await fetch(fullUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, message: `坚果云上未找到 ${latestFile}，请先在桌面端上传` };
      }
      return { success: false, message: `下载失败: HTTP ${response.status}` };
    }

    // 4. 下载并解压
    let blob = await response.blob();
    step(`  下载完成: ${blob.size} bytes`);

    // 4a. 如果下载的是 .db.gz（gzip 压缩），先解压
    if (latestFile.endsWith('.db.gz')) {
      blob = await decompressGzip(blob);
      step(`  解压完成: ${blob.size} bytes`);
    }

    // 4.1 先删除 cache 中可能残留的同名文件，避免 moveDatabasesAndAddSuffix 重复处理
    try {
      await Filesystem.deleteFile({ path: 'shengxintou.db', directory: Directory.Cache });
    } catch {
      /* file not exists is fine */
    }

    // 4.2 分块写入：解压后的 SQLite 可能 30+ MB，base64 后 50+ MB，
    //      一次性传给 Filesystem.writeFile 会导致 WebView 内存溢出崩溃。
    //      改用 1MB 二进制分块 → 每块 ~1.4MB base64 → 独立 PostMessage，避免内存峰值。
    step('4/7 写入 cache');
    await writeFileInChunks(blob, 'shengxintou.db', Directory.Cache);

    // 5. 删除现有 DB（如有），避免 move 时冲突
    step('5/7 删除旧数据库');
    await deleteMobileDatabase();
    step('  旧数据库已删除');

    // 6. 原生层把 cache/shengxintou.db 移到 databases/shengxintouSQLite.db
    step('6/7 移动 cache → databases');
    await moveDatabaseFromCache();

    // 6.1 Verification：确认新 DB 已就位（v3.6.1 新增）
    // 之前 moveDatabasesAndAddSuffix 在目标已存在时会 silently skip，
    // 导致前端返回 success 但实际 DB 未被替换。
    step('6.1/7 校验新数据库');
    const { databaseExists } = await import('./mobileSqlite');
    const ok = await databaseExists();
    if (!ok) {
      throw new Error('移动后 isDatabase 校验失败：新数据库未就位');
    }

    // 7. 重新打开数据库连接
    step('7/7 重新打开数据库');
    await initMobileDatabase();

    // 7.1 Sanity check：执行一次查询，确认连接可用且数据真的更新了
    step('7.1/7 数据 sanity check');
    try {
      const { querySql } = await import('./mobileSqlite');
      const rows = await querySql<{ CNT?: number }>('SELECT COUNT(*) AS CNT FROM sqlite_master WHERE type="table"');
      step(`  sanity check 通过: 共 ${rows[0]?.CNT ?? 0} 张表`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`sanity check 失败，新库可能未正确加载: ${msg}`);
    }

    return {
      success: true,
      message: `同步成功（${latestFile}）`,
      size: blob.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // 出错时尝试重新打开数据库
    try {
      await initMobileDatabase();
    } catch {
      /* ignore */
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[mobileSync] 同步失败:', errMsg, '\n步骤:', log.join('\n  '));
    return {
      success: false,
      message: `同步失败: ${errMsg}`,
    };
  }
}

/**
 * v3.6.2：规范化 Cloudflare Worker 代理 URL
 *
 * 用户在表单中可能填入以下几种格式：
 *   - https://xxx.workers.dev
 *   - https://xxx.workers.dev/
 *   - https://xxx.workers.dev/?
 *
 * 统一去掉末尾的 / 和 ?，再由调用方拼 ?url=...&auth=...
 * 避免拼出 `https://xxx.workers.dev?url=...`（Cloudflare Workers 对裸域名请求
 * 可能触发重定向到带 / 的版本，重定向后 query string 丢失，导致请求失败）。
 */
function normalizeProxyUrl(raw: string): string {
  let u = raw.trim();
  while (u.endsWith('/') || u.endsWith('?')) {
    u = u.slice(0, -1);
  }
  return u;
}

/**
 * v3.6.2：构造 PWA 代理请求 URL
 *
 * 关键修复：
 *   1. auth（base64）必须 encodeURIComponent —— base64 可能含 +、/、= 字符，
 *      其中 + 在 URL query string 中会被解析为空格，导致坚果云收到错误的凭据 → 401
 *   2. proxyUrl 末尾斜杠规范化，避免 Cloudflare Workers 重定向丢 query string
 */
function buildProxyRequestUrl(
  proxyUrl: string,
  targetUrl: string,
  authBase64: string
): string {
  const proxy = normalizeProxyUrl(proxyUrl);
  return `${proxy}?url=${encodeURIComponent(targetUrl)}&auth=${encodeURIComponent(authBase64)}`;
}

/**
 * v3.7.0：PWA 端 WebDAV 同步实现
 *
 * 与安卓端的核心差异：
 *   1. fetch 走 Cloudflare Worker 代理（坚果云不支持 CORS）
 *   2. 下载的 DB ArrayBuffer 直接喂给 sql.js，不走 Filesystem
 *   3. 持久化到 IndexedDB，而非应用沙箱文件系统
 *
 * Worker 代理 URL 由用户配置（localStorage key: webdav_proxy_url）。
 * 代理协议：GET https://<worker>/?url=<encoded webdav url>&auth=<basic auth>
 *           Worker 转发到坚果云并加 CORS 头。
 */
async function syncFromWebDAVPwa(creds: {
  url: string;
  username: string;
  password: string;
  remoteDir: string;
  proxyUrl?: string;
}): Promise<SyncResult> {
  const log: string[] = [];
  const step = (msg: string) => {
    log.push(msg);
    console.log(`[pwaSync] ${msg}`);
  };

  try {
    if (!creds.proxyUrl) {
      return {
        success: false,
        message: 'PWA 同步需要 Cloudflare Worker 代理地址，请在「WebDAV 配置」中填入代理 URL',
      };
    }

    // 1. 通过代理获取 latest_backup.txt
    step('1/5 获取最新备份元数据');
    const auth = btoa(`${creds.username}:${creds.password}`);
    const manifestUrl = creds.remoteDir
      ? `${creds.url}${creds.remoteDir}/latest_backup.txt`
      : `${creds.url}latest_backup.txt`;
    const proxyManifest = buildProxyRequestUrl(creds.proxyUrl, manifestUrl, auth);

    const manifestResp = await fetch(proxyManifest);
    if (manifestResp.status === 404) {
      return { success: false, message: '坚果云上未找到 latest_backup.txt，请先在桌面端上传备份' };
    }
    if (!manifestResp.ok) {
      return { success: false, message: `获取备份列表失败: HTTP ${manifestResp.status}` };
    }
    const latestFile = (await manifestResp.text()).trim();
    if (!latestFile) {
      return { success: false, message: 'latest_backup.txt 为空' };
    }
    step(`  最新备份: ${latestFile}`);

    // 2. 通过代理下载 .db.gz
    step('2/5 下载备份文件');
    const remotePath = creds.remoteDir ? `${creds.remoteDir}/${latestFile}` : latestFile;
    const fullUrl = `${creds.url}${remotePath}`;
    const proxyDownload = buildProxyRequestUrl(creds.proxyUrl, fullUrl, auth);

    const dlResp = await fetch(proxyDownload);
    if (!dlResp.ok) {
      if (dlResp.status === 404) {
        return { success: false, message: `坚果云上未找到 ${latestFile}` };
      }
      return { success: false, message: `下载失败: HTTP ${dlResp.status}` };
    }

    let blob = await dlResp.blob();
    step(`  下载完成: ${blob.size} bytes`);

    // 3. 解压（如果是 .db.gz）
    if (latestFile.endsWith('.db.gz')) {
      step('3/5 解压 gzip');
      blob = await decompressGzip(blob);
      step(`  解压完成: ${blob.size} bytes`);
    } else {
      step('3/5 无需解压');
    }

    // 4. 加载到 sql.js + 持久化到 IndexedDB
    step('4/5 加载到 sql.js');
    const { loadNewDb } = await import('./sqlJsAdapter');
    const arrayBuffer = await blob.arrayBuffer();
    await loadNewDb(arrayBuffer);

    // 5. Sanity check
    step('5/5 数据 sanity check');
    try {
      const { querySql } = await import('./sqlJsAdapter');
      const rows = await querySql<{ CNT?: number }>('SELECT COUNT(*) AS CNT FROM sqlite_master WHERE type="table"');
      step(`  sanity check 通过: 共 ${rows[0]?.CNT ?? 0} 张表`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`sanity check 失败，新库可能未正确加载: ${msg}`);
    }

    return {
      success: true,
      message: `同步成功（${latestFile}）`,
      size: blob.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[pwaSync] 同步失败:', errMsg, '\n步骤:', log.join('\n  '));
    return {
      success: false,
      message: `同步失败: ${errMsg}`,
    };
  }
}

/**
 * v3.6.2：PWA 端测试 WebDAV 连接（通过 Worker 代理）
 */
async function testWebDAVConnectionPwa(
  username: string,
  password: string,
  remoteDir: string,
  url?: string,
  proxyUrl?: string
): Promise<SyncResult> {
  if (!proxyUrl) {
    return { success: false, message: '请先填入 Cloudflare Worker 代理地址' };
  }
  try {
    const auth = btoa(`${username}:${password}`);
    const baseUrl = url || DEFAULT_WEBDAV_BASE;
    const manifestUrl = remoteDir
      ? `${baseUrl}${remoteDir}/latest_backup.txt`
      : `${baseUrl}latest_backup.txt`;
    const proxyManifest = buildProxyRequestUrl(proxyUrl, manifestUrl, auth);

    const resp = await fetch(proxyManifest);
    if (resp.status === 404) {
      return { success: false, message: '连接成功，但未找到 latest_backup.txt' };
    }
    if (!resp.ok) {
      return { success: false, message: `连接失败: HTTP ${resp.status}` };
    }
    const filename = (await resp.text()).trim();
    return {
      success: true,
      message: filename ? `连接成功，最新备份: ${filename}` : '连接成功',
    };
  } catch (error) {
    // v3.6.2：fetch 抛 TypeError("Failed to fetch) 通常是 CORS / 网络 / URL 错误
    //   给用户更具体的排查提示，而不是裸 "Failed to fetch"
    const raw = error instanceof Error ? error.message : String(error);
    if (raw === 'Failed to fetch') {
      return {
        success: false,
        message: '无法连接代理（Failed to fetch）。请检查：1) Worker URL 是否正确；2) Worker 是否已部署并返回 CORS 头；3) 是否因网络问题无法访问 workers.dev',
      };
    }
    return {
      success: false,
      message: `连接失败: ${raw}`,
    };
  }
}

export async function testWebDAVConnection(
  username: string,
  password: string,
  remoteDir: string,
  url?: string
): Promise<SyncResult> {
  // v3.6.2：PWA 端走 Worker 代理
  if (isPwaClient()) {
    const proxyUrl = localStorage.getItem('webdav_proxy_url') || '';
    return testWebDAVConnectionPwa(username, password, remoteDir, url, proxyUrl);
  }
  try {
    const auth = btoa(`${username}:${password}`);
    const baseUrl = url || DEFAULT_WEBDAV_BASE;
    const latestFile = await getLatestRemoteDb(baseUrl, remoteDir, auth);

    if (latestFile) {
      return { success: true, message: `连接成功，最新备份: ${latestFile}` };
    } else {
      return { success: false, message: '连接成功，但未找到 latest_backup.txt' };
    }
  } catch (error) {
    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
