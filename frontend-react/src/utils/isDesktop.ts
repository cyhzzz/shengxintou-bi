/**
 * 桌面版（Electron）与移动版（Capacitor）环境判断
 *
 * v3.4.3：合并后用 window.desktop 注入标志判断，而非 navigator.userAgent。
 *   - 真桌面版：Electron preload 注入 window.desktop 对象 → true
 *   - TRAE IDE 内置浏览器（也是 Electron）：无 preload 注入 → false
 *   - 普通 Chrome：无 preload 注入 → false
 *
 * v3.5：新增 isMobileClient() 检测 Capacitor 运行时。
 *   Capacitor 在 WebView 中注入 window.Capacitor 全局对象。
 */
declare global {
  interface Window {
    desktop?: unknown;
    Capacitor?: { isNative?: boolean };
  }
}

export const isDesktopClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.desktop);
};

export const isMobileClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Capacitor?.isNative);
};
