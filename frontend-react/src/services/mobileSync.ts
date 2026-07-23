/**
 * 移动端 WebDAV 同步（坚果云）
 *
 * v3.5.3 关键修复：
 *   1. 后端上传到坚果云的文件名是 backup_YYYYMMDD_HHMMSS.db（不是 shengxintou.db），
 *      因此同步时必须先 PROPFIND 列出目录中最新的 .db 备份，再下载。
 *   2. 下载的文件写入 cache/shengxintou.db，再由 moveDatabasesAndAddSuffix
 *      原生移动到 databases/shengxintouSQLite.db。
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
 * PROPFIND 列出坚果云备份目录中最新的 .db.gz 备份文件
 *
 * 后端上传文件名格式：backup_YYYYMMDD_HHMMSS.db.gz（gzip 压缩）
 * 按文件名降序排序即取到最新备份。
 *
 * 注意：坚果云 PROPFIND 不接受 request body（返回 IllegalArgument），
 * 只需 method=PROPFIND + Depth header 即可。
 */
async function listLatestRemoteDb(
  baseUrl: string,
  remoteDir: string,
  auth: string
): Promise<string | null> {
  const listUrl = remoteDir
    ? `${baseUrl}${remoteDir}/`
    : baseUrl;

  // 坚果云 PROPFIND 不需要 body
  const response = await fetch(listUrl, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: '1',
    },
  });

  if (!response.ok) {
    throw new Error(`列出坚果云目录失败: HTTP ${response.status}`);
  }

  const xmlText = await response.text();

  // 用正则提取所有 <d:href> 或 <D:href> 中的文件路径
  const hrefRegex = /<(?:D|d):href[^>]*>([^<]+)<\/(?:D|d):href>/g;
  const filenames: string[] = [];
  let match;
  while ((match = hrefRegex.exec(xmlText)) !== null) {
    const href = match[1].trim();
    // 提取 URL 末段作为文件名
    const filename = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
    // 只保留 .db.gz 备份文件（排除 .meta.json / .db（无 gz）/ 目录本身）
    if (filename.endsWith('.db.gz') && !filename.endsWith('.meta.json')) {
      filenames.push(filename);
    }
  }

  if (filenames.length === 0) return null;

  // backup_YYYYMMDD_HHMMSS.db.gz 天然按时间排序，取最新的
  filenames.sort((a, b) => b.localeCompare(a));
  return filenames[0];
}

export async function syncFromWebDAV(): Promise<SyncResult> {
  const creds = await getWebDAVCredentials();
  if (!creds) {
    return { success: false, message: '请先配置坚果云账号' };
  }

  try {
    // 1. 关闭现有连接，避免文件锁
    await closeMobileDatabase();

    // 2. PROPFIND 列出坚果云目录中最新的 .db 备份
    const auth = btoa(`${creds.username}:${creds.password}`);
    const latestFile = await listLatestRemoteDb(WEBDAV_BASE, creds.remoteDir, auth);

    if (!latestFile) {
      return { success: false, message: '坚果云上未找到数据库备份文件，请先在桌面端上传' };
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

    // 4. base64 编码后写到 Cache 目录（/data/data/<pkg>/cache/）
    //    文件名必须为 shengxintou.db（无 SQLite 后缀），moveDatabasesAndAddSuffix 会自动加后缀
    let blob = await response.blob();

    // 4a. 如果下载的是 .db.gz（gzip 压缩），先解压
    if (latestFile.endsWith('.db.gz')) {
      blob = await decompressGzip(blob);
    }

    const base64 = await blobToBase64(blob);

    // 4.1 先删除 cache 中可能残留的同名文件，避免 moveDatabasesAndAddSuffix 重复处理
    try {
      await Filesystem.deleteFile({ path: 'shengxintou.db', directory: Directory.Cache });
    } catch {
      /* file not exists is fine */
    }

    await Filesystem.writeFile({
      path: 'shengxintou.db',
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

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
    const latestFile = await listLatestRemoteDb(WEBDAV_BASE, remoteDir, auth);

    if (latestFile) {
      return { success: true, message: `连接成功，最新备份: ${latestFile}` };
    } else {
      return { success: false, message: '连接成功，但未找到 .db 备份文件' };
    }
  } catch (error) {
    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
