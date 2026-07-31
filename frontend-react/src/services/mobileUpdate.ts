/**
 * 移动端（Capacitor Android）前端热更新
 *
 * v3.7.0：与 PWA 端 dist 同步策略对齐，让 Android 客户端也能下载 GitHub Release 中的
 *   frontend-dist.zip 并切换 bundle，实现「无需重装 APK 即可拉取最新前端」。
 *
 * 工作流程：
 *   1. 用户在 HelpModal 点击「下载更新包」
 *   2. 调用 CapacitorUpdater.download({ url })，native 层用 OkHttp 下载到 cache
 *   3. 调用 CapacitorUpdater.set({ id }) 切换 bundle
 *   4. 提示用户：下次启动 App 生效
 *
 * 安全机制：
 *   - App 启动时调用 notifyAppReady() 标记当前 bundle 可用
 *   - 若 10 秒内未调用，下次启动自动回退到上一个可用 bundle
 *   - resetWhenUpdate: false，App 升级时保留已下载的 bundle
 *
 * 注意：仅在移动端（Capacitor Android）可用，Web/PWA 端调用会抛出异常。
 */
import type { ApiResponse } from '@/types';

// v3.6.4：由 vite.config.ts define 注入的 version.json 内容（构建时确定）
declare const __APP_VERSION_INFO__: {
  version: string;
  release_date: string;
  changelog?: string[];
  [key: string]: unknown;
};

// GitHub Release latest 的 frontend-dist.zip 下载 URL
// 与后端 backend/routes/system/self_update.py 中的 _DIST_ZIP_URL 保持一致
const DIST_ZIP_URL = 'https://github.com/cyhzzz/shengxintou-bi/releases/latest/download/frontend-dist.zip';

export interface MobileUpdateProgress {
  status: 'downloading' | 'downloaded' | 'set' | 'failed';
  progress: number;
  message: string;
  bundleId?: string;
  error?: string;
}

/**
 * 启动一次移动端热更新。
 *
 * 返回值与 Windows 端 frontendUpdateStatus 的 data 结构兼容，便于 HelpModal 复用进度 UI。
 * 区别在于：移动端是同步阻塞调用（Capacitor Updater native 层做异步下载），
 * 而非后端轮询。所以调用方需要先 await 这个函数，再展示结果。
 */
export async function startMobileFrontendUpdate(
  onProgress?: (p: MobileUpdateProgress) => void,
): Promise<MobileUpdateProgress> {
  // 动态导入：避免 Web/PWA 端构建时被强引用 @capgo/capacitor-updater
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

  try {
    onProgress?.({
      status: 'downloading',
      progress: 20,
      message: '正在下载前端资源包...',
    });

    // 下载 bundle（native 层用 OkHttp，自动跟随 GitHub 302 重定向）
    // version 字段必填（@capgo/capacitor-updater 类型要求），用于 bundle 标识与回退
    const currentVersion =
      typeof __APP_VERSION_INFO__ !== 'undefined'
        ? __APP_VERSION_INFO__.version
        : '0.0.0';
    const downloadResult = await CapacitorUpdater.download({
      url: DIST_ZIP_URL,
      version: currentVersion,
    });

    if (!downloadResult || !downloadResult.id) {
      throw new Error('下载完成但未拿到 bundle id');
    }

    onProgress?.({
      status: 'downloaded',
      progress: 70,
      message: '下载完成，正在切换 bundle...',
      bundleId: downloadResult.id,
    });

    // 切换 bundle（下次启动生效，不会立即 kill 当前 WebView）
    await CapacitorUpdater.set({ id: downloadResult.id });

    onProgress?.({
      status: 'set',
      progress: 100,
      message: '更新包已就绪，下次启动 App 自动生效',
      bundleId: downloadResult.id,
    });

    return {
      status: 'set',
      progress: 100,
      message: '更新包已就绪，下次启动 App 自动生效',
      bundleId: downloadResult.id,
    };
  } catch (e: any) {
    const msg = e?.message || String(e);
    onProgress?.({
      status: 'failed',
      progress: 0,
      message: `热更新失败：${msg}`,
      error: msg,
    });
    return {
      status: 'failed',
      progress: 0,
      message: `热更新失败：${msg}`,
      error: msg,
    };
  }
}

/**
 * App 启动时调用：标记当前 bundle 已成功启动。
 *
 * Capacitor Updater 协议：若 10 秒内未调用，下次启动会自动回退到上一个 bundle。
 * 必须在移动端 main.tsx 早期调用。
 *
 * 失败静默：非移动端调用直接 no-op，不影响 Web/PWA 启动。
 */
export async function notifyAppReady(): Promise<void> {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // 静默失败：Web/PWA/桌面端无 @capgo/capacitor-updater，直接忽略
  }
}

/**
 * 返回当前 bundle 信息（仅移动端可用，用于调试/展示版本号）。
 */
export async function getCurrentBundle(): Promise<{ id: string; version?: string } | null> {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const result = await CapacitorUpdater.current();
    const bundle = result?.bundle;
    return bundle ? { id: bundle.id, version: bundle.version } : null;
  } catch {
    return null;
  }
}

/**
 * 列出已下载的 bundle 列表（仅移动端，用于调试）。
 */
export async function listBundles(): Promise<string[]> {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const result = await CapacitorUpdater.list();
    return (result?.bundles || []).map((b) => b.id || b.version || '').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 删除指定 bundle（仅移动端，用于清理空间）。
 */
export async function deleteBundle(id: string): Promise<ApiResponse<unknown>> {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.delete({ id });
    return { success: true, data: { id } };
  } catch (e: any) {
    return {
      success: false,
      error: 'DELETE_FAILED',
      message: e?.message || String(e),
    };
  }
}
