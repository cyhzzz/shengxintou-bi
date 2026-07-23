/**
 * 移动端 WebDAV 同步（坚果云）
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
 * 凭据存储在 @capacitor/preferences 中，首次安装时使用打包时内置的 .env 默认值。
 */
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  closeMobileDatabase,
  initMobileDatabase,
  moveDatabaseFromCache,
  deleteMobileDatabase,
} from './mobileSqlite';

// 打包时从项目根 .env 注入的内置默认值（v3.5.1）
const BUILTIN_WEBDAV_URL = import.meta.env.VITE_WEBDAV_URL || '';
const BUILTIN_WEBDAV_USERNAME = import.meta.env.VITE_WEBDAV_USERNAME || '';
const BUILTIN_WEBDAV_PASSWORD = import.meta.env.VITE_WEBDAV_PASSWORD || '';
const BUILTIN_WEBDAV_BASE_PATH = import.meta.env.VITE_WEBDAV_BASE_PATH || '';

const WEBDAV_BASE = BUILTIN_WEBDAV_URL || 'https://dav.jianguoyun.com/dav/';

export interface SyncResult {
  success: boolean;
  message: string;
  size?: number;
  timestamp?: string;
}

export async function saveWebDAVCredentials(
  username: string,
  password: string,
  remoteDir: string
): Promise<void> {
  await Preferences.set({ key: 'webdav_username', value: username });
  await Preferences.set({ key: 'webdav_password', value: password });
  await Preferences.set({ key: 'webdav_remote_dir', value: remoteDir });
}

export async function getWebDAVCredentials(): Promise<{
  username: string;
  password: string;
  remoteDir: string;
} | null> {
  const { value: username } = await Preferences.get({ key: 'webdav_username' });
  const { value: password } = await Preferences.get({ key: 'webdav_password' });
  const { value: remoteDir } = await Preferences.get({ key: 'webdav_remote_dir' });
  // 用户已手动配置 → 优先用用户的
  if (username && password) {
    return { username, password, remoteDir: remoteDir || '' };
  }
  // 未手动配置 → 回退到打包时内置的 .env 默认值
  if (BUILTIN_WEBDAV_USERNAME && BUILTIN_WEBDAV_PASSWORD) {
    // WEBDAV_BASE_PATH 形如 /shengxintou-backup/，去掉首尾斜杠作为 remoteDir
    const dir = BUILTIN_WEBDAV_BASE_PATH.replace(/^\/+|\/+$/g, '');
    return {
      username: BUILTIN_WEBDAV_USERNAME,
      password: BUILTIN_WEBDAV_PASSWORD,
      remoteDir: dir,
    };
  }
  return null;
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
    return { success: false, message: '请先配置坚果云账号' };
  }

  try {
    // 1. 关闭现有连接，避免文件锁
    await closeMobileDatabase();

    // 2. GET latest_backup.txt 获取最新备份文件名
    const auth = btoa(`${creds.username}:${creds.password}`);
    const latestFile = await getLatestRemoteDb(WEBDAV_BASE, creds.remoteDir, auth);

    if (!latestFile) {
      return { success: false, message: '坚果云上未找到 latest_backup.txt，请先在桌面端上传备份（需更新桌面版）' };
    }

    // 3. 下载最新备份
    const remotePath = creds.remoteDir
      ? `${creds.remoteDir}/${latestFile}`
      : latestFile;
    const fullUrl = `${WEBDAV_BASE}${remotePath}`;

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

    // 4a. 如果下载的是 .db.gz（gzip 压缩），先解压
    if (latestFile.endsWith('.db.gz')) {
      blob = await decompressGzip(blob);
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
    await writeFileInChunks(blob, 'shengxintou.db', Directory.Cache);

    // 5. 删除现有 DB（如有），避免 move 时冲突
    await deleteMobileDatabase();

    // 6. 原生层把 cache/shengxintou.db 移到 databases/shengxintouSQLite.db
    await moveDatabaseFromCache();

    // 7. 重新打开数据库连接
    await initMobileDatabase();

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
    return {
      success: false,
      message: `同步失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function testWebDAVConnection(
  username: string,
  password: string,
  remoteDir: string
): Promise<SyncResult> {
  try {
    const auth = btoa(`${username}:${password}`);
    const latestFile = await getLatestRemoteDb(WEBDAV_BASE, remoteDir, auth);

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
