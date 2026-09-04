/**
 * preload 脚本：暴露桌面端能力给渲染进程。
 *
 * window.desktopUpdater（v3.9.0）：
 *   - checkStaging(): 查询是否有已下载待应用的完整更新
 *   - applyAndRestart(): 应用完整更新（停 Flask → 替换 → 重启 Electron）
 *     resolve(data)：{ ok, version?, error?, restarting? }（restarting=true 表示将自动重启应用）
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  version: '0.1.0',
  platform: process.platform,
});

contextBridge.exposeInMainWorld('desktopUpdater', {
  checkStaging: (): Promise<{ ready: boolean; version?: string }> =>
    ipcRenderer.invoke('updater:check-staging'),
  applyAndRestart: (): Promise<{ ok: boolean; version?: string; error?: string; restarting?: boolean }> =>
    ipcRenderer.invoke('updater:apply'),
});
