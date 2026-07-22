/**
 * preload 脚本：最小化暴露，目前无 IPC 接口。
 *
 * 后续如需加：
 * - 版本号查询
 * - 强制刷新
 * - 退出应用
 * 可在 contextBridge.exposeInMainWorld 中加。
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  version: '0.1.0',
  platform: process.platform,
});
