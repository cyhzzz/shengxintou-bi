/**
 * 移动端 WebDAV 同步（坚果云）
 *
 * 从坚果云下载 .db 文件并替换本地 SQLite 数据库。
 * 凭据存储在 @capacitor/preferences 中。
 */
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { closeMobileDatabase, initMobileDatabase } from './mobileSqlite';

const WEBDAV_BASE = 'https://dav.jianguoyun.com/dav/';

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
  if (!username || !password) return null;
  return { username, password, remoteDir: remoteDir || '' };
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
    // 1. 关闭数据库连接
    await closeMobileDatabase();

    // 2. 从坚果云下载 .db
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

    // 3. 写入本地文件系统
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    await Filesystem.writeFile({
      path: 'shengxintouSQLite.db',
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });

    // 4. 重新打开数据库
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
