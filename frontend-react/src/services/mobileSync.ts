/**
 * 移动端 WebDAV 同步（坚果云）
 *
 * v3.5.3 关键修复：
 *   旧版直接用 Filesystem.writeFile(Directory.Data) 写入 .db，
 *   但 SQLite 插件实际读取的目录是 /data/data/<pkg>/databases/，
 *   导致同步下来的文件根本不会被 SQLite 读取。
 *
 *   本版本改为：
 *     1. fetch 坚果云的 shengxintou.db
 *     2. base64 编码后写到 Directory.Cache
 *     3. 调用 SQLite 插件的 moveDatabasesAndAddSuffix('cache')
 *        原生把 cache/shengxintou.db 移动到 databases/shengxintouSQLite.db
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

export async function syncFromWebDAV(): Promise<SyncResult> {
  const creds = await getWebDAVCredentials();
  if (!creds) {
    return { success: false, message: '请先配置坚果云账号' };
  }

  try {
    // 1. 关闭现有连接，避免文件锁
    await closeMobileDatabase();

    // 2. 从坚果云下载 shengxintou.db
    const remotePath = creds.remoteDir
      ? `${creds.remoteDir}/shengxintou.db`
      : 'shengxintou.db';
    const fullUrl = `${WEBDAV_BASE}${remotePath}`;
    const auth = btoa(`${creds.username}:${creds.password}`);

    const response = await fetch(fullUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, message: '坚果云上未找到 shengxintou.db，请先在桌面端上传' };
      }
      return { success: false, message: `下载失败: HTTP ${response.status}` };
    }

    // 3. base64 编码后写到 Cache 目录（/data/data/<pkg>/cache/）
    //    文件名必须为 shengxintou.db（无 SQLite 后缀），moveDatabasesAndAddSuffix 会自动加后缀
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    // 3.1 先删除 cache 中可能残留的同名文件，避免 moveDatabasesAndAddSuffix 重复处理
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

    // 4. 删除现有 DB（如有），避免 move 时冲突
    await deleteMobileDatabase();

    // 5. 原生层把 cache/shengxintou.db 移到 databases/shengxintouSQLite.db
    await moveDatabaseFromCache();

    // 6. 重新打开数据库连接
    await initMobileDatabase();

    return {
      success: true,
      message: '同步成功',
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
    const remotePath = remoteDir ? `${remoteDir}/shengxintou.db` : 'shengxintou.db';
    const fullUrl = `${WEBDAV_BASE}${remotePath}`;
    const auth = btoa(`${username}:${password}`);

    const response = await fetch(fullUrl, {
      method: 'HEAD',
      headers: { Authorization: `Basic ${auth}` },
    });

    if (response.ok) {
      return { success: true, message: '连接成功，文件存在' };
    } else if (response.status === 404) {
      return { success: false, message: '连接成功，但未找到 shengxintou.db' };
    } else {
      return { success: false, message: `连接失败: HTTP ${response.status}` };
    }
  } catch (error) {
    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
