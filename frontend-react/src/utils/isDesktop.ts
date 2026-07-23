/**
 * 桌面版（Electron）与移动版（Capacitor）环境判断
 *
 * v3.4.3：合并后用 window.desktop 注入标志判断，而非 navigator.userAgent。
 *   - 真桌面版：Electron preload 注入 window.desktop 对象 → true
 *   - TRAE IDE 内置浏览器（也是 Electron）：无 preload 注入 → false
 *   - 普通 Chrome：无 preload 注入 → false
 *
 * v3.5：新增 isMobileClient() 检测 Capacitor 运行时。
 *
 * v3.5.3 根因修复：
 *   原代码只检查 `window.Capacitor?.isNative`，但 Capacitor native bridge 在
 *   WebView 启动早期可能还没注入 window.Capacitor，导致 isMobile=false →
 *   走 BrowserRouter（非 HashRouter）→ 在 file://下路由找不到 → 各种 undefined 错误。
 *
 *   修复：多重兜底判断
 *     1. window.Capacitor.isNativePlatform?() — Capacitor 官方 API
 *     2. window.Capacitor.getPlatform?() === 'android' — 官方 API，检查 androidBridge
 *     3. window.androidBridge — Capacitor Android bridge 注入的早期标志
 *   任何一个为 true 即判定为移动端。
 */
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    desktop?: unknown;
    Capacitor?: { isNative?: () => boolean; getPlatform?: () => string; isNativePlatform?: () => boolean };
    androidBridge?: unknown;
  }
}

export const isDesktopClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.desktop);
};

export const isMobileClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  // 1. Capacitor 官方 API（bridge 就绪后可用）
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (Capacitor.getPlatform() === 'android') return true;
  } catch { /* Capacitor 未就绪，继续兜底 */ }
  // 2. 早期 native bridge 标志（bridge 注入但 Capacitor 对象未完全初始化）
  if (window.androidBridge) return true;
  // 3. window.Capacitor 直接检查（旧逻辑保留）
  if (window.Capacitor?.isNative?.() === true) return true;
  if (window.Capacitor?.getPlatform?.() === 'android') return true;
  return false;
};
