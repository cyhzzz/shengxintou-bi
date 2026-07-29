import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 注意：App 不再静态 import，改为在 waitForCapacitorAndRender 中动态 import，
// 确保 router 模块（含 isMobile 判断）在 Capacitor bridge 就绪后才加载。

// 移动端调试 — 全局未捕获错误捕获器
//
// v3.5.3 根因修复：
//   原代码用 `window.Capacitor?.isNative?.() === true` 判断是否移动端，
//   但 Capacitor native bridge 在 WebView 启动早期可能还没注入 window.Capacitor，
//   导致 isMobile=false → 错误捕获器被跳过 → 错误照常发生但无人捕获。
//
//   修复：错误捕获器**无条件注册**（桌面端 Chrome DevTools 也能看到，无害）。
//   这样无论 Capacitor bridge 何时注入，所有同步/Promise 错误都会被捕获。
const captureError = (kind: string, data: { message: string; stack?: string; extra?: unknown }) => {
  try {
    const entry = {
      time: new Date().toISOString(),
      kind,
      message: data.message,
      stack: data.stack,
      extra: data.extra ? JSON.stringify(data.extra) : undefined,
      url: location.href,
    };
    const KEY = 'mobile_errors';
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    arr.unshift(entry);
    if (arr.length > 10) arr.length = 10;
    localStorage.setItem(KEY, JSON.stringify(arr));
    showDebugOverlay(entry);
  } catch { /* ignore */ }
};

const showDebugOverlay = (entry: { kind: string; message: string; stack?: string; time: string; url: string }) => {
  if (document.getElementById('mobile-debug-overlay')) return;
  const box = document.createElement('div');
  box.id = 'mobile-debug-overlay';
  box.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'background:rgba(0,0,0,0.92)', 'color:#fff', 'z-index:99999',
    'padding:16px', 'overflow:auto', 'font-family:monospace', 'font-size:11px',
    'white-space:pre-wrap', 'word-break:break-all',
  ].join(';');
  const stack = entry.stack || '(no stack)';
  box.innerHTML = [
    `<b style="color:#ff6b6b">[${entry.kind}] ${entry.message}</b>`,
    ``,
    `<b>Time:</b> ${entry.time}`,
    `<b>URL:</b> ${entry.url}`,
    ``,
    `<b>Stack:</b>`,
    stack,
    ``,
    `<i style="color:#888">已写入 localStorage.mobile_errors</i>`,
    ``,
    `<button id="mb-copy" style="padding:8px 16px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:14px">复制全部</button>`,
    ` <button id="mb-clear" style="padding:8px 16px;background:#666;color:#fff;border:none;border-radius:4px;font-size:14px">清除并刷新</button>`,
  ].join('\n');
  document.body.appendChild(box);
  box.querySelector('#mb-copy')?.addEventListener('click', () => {
    const text = `[${entry.kind}] ${entry.message}\nTime: ${entry.time}\nURL: ${entry.url}\nStack:\n${stack}`;
    navigator.clipboard?.writeText(text).then(
      () => { (box.querySelector('#mb-copy') as HTMLElement).textContent = '已复制 ✓'; },
      () => { (box.querySelector('#mb-copy') as HTMLElement).textContent = '复制失败'; }
    );
  });
  box.querySelector('#mb-clear')?.addEventListener('click', () => {
    box.remove();
    localStorage.removeItem('mobile_errors');
    location.reload();
  });
};

// 1. 同步错误（无条件注册）
window.addEventListener('error', (e) => {
  if (e.error?.stack) {
    captureError('error', { message: e.message, stack: e.error.stack });
  } else {
    captureError('error', { message: e.message });
  }
});
// 2. Promise 异步错误（无条件注册）
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;

  // v3.6.4：chunk 加载失败自动重试
  // 原因：GitHub Pages 对 HTML 有缓存，新部署后旧 index.html 引用的 chunk hash
  //       已被覆盖删除，导致 "Failed to fetch dynamically imported module"。
  // 处理：检测到此错误时自动 reload 一次（带 ?v=timestamp 强制跳过缓存），
  //      并用 sessionStorage 标记避免无限重试。
  if (reason instanceof Error && reason.message?.includes('Failed to fetch dynamically imported module')) {
    const RETRY_KEY = '__chunk_reload_retried';
    const retried = sessionStorage.getItem(RETRY_KEY);
    if (!retried) {
      sessionStorage.setItem(RETRY_KEY, '1');
      console.warn('[main] chunk 加载失败，自动 reload 跳过缓存');
      location.href = location.pathname + '?v=' + Date.now() + location.hash;
      return;
    }
    // 已重试过仍失败，提示用户手动刷新
    captureError('promise', {
      message: '页面资源加载失败（可能是缓存问题），请手动清除浏览器缓存后重试',
      stack: reason.stack,
    });
    return;
  }

  if (reason instanceof Error) {
    captureError('promise', { message: reason.message, stack: reason.stack });
  } else {
    captureError('promise', { message: String(reason) });
  }
});

// v3.5.3 关键修复：在 Capacitor 环境下，先等 native bridge 注入完成再渲染。
//
// 根因：router/index.tsx 的 `const isMobile = isMobileClient()` 在模块加载时
// 一次性求值。如果 main.tsx 在 Capacitor bridge 注入 window.Capacitor 之前
// 就 import router，isMobile 永远是 false → 走 createBrowserRouter（非
// HashRouter）→ file:// 下路由找不到 → 各种 undefined → "me.some is not a
// function"。
//
// Capacitor 官方做法：bridge 在 DOMContentLoaded 前注入，但 Vite 打包后
// main.tsx 的同步 import 链可能在 bridge 注入前就开始执行。这里用一个微
// 延迟 + 显式等待，确保 bridge 就绪后再渲染 React 树。
const waitForCapacitorAndRender = async () => {
  // 检测是否在 Capacitor WebView 中（用多种早期标志，任一命中即等待）
  const looksLikeCapacitor =
    !!(window as any).Capacitor ||
    !!(window as any).androidBridge ||
    navigator.userAgent.includes('Android') && location.protocol === 'file:';

  if (looksLikeCapacitor) {
    // 最多等 500ms 让 bridge 完全注入
    const start = Date.now();
    while (
      !(window as any).Capacitor?.isNativePlatform?.() &&
      !(window as any).Capacitor?.getPlatform?.() &&
      Date.now() - start < 500
    ) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // 动态 import App，确保 router 模块在 bridge 就绪后才加载
  // （静态 import 会在 main.tsx 解析时立即加载 router，可能早于 bridge 注入）
  const { default: App } = await import('./App.tsx');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void waitForCapacitorAndRender();

// v3.2.5：本地服务器+本地浏览器模式下，HTTP 延迟极低（<5ms），
// 但 V8 解析 JS 仍是 CPU 阻塞操作，大 chunk（~1MB）解析 50-100ms。
// 首屏渲染完成后，利用浏览器空闲时间预加载热门路由 chunk，
// 用户切换路由时无需等待 V8 解析 + 执行，实现"零延迟切换"。
// 策略：requestIdleCallback 空闲时预加载 3 个最常访问的路由。
if ('requestIdleCallback' in window) {
  ;(window as any).requestIdleCallback(
    () => {
      // 动态 import 触发 chunk 下载与 V8 预解析，结果不引用（仅做预加载）
      void import('@/pages/Dashboard')
      void import('@/pages/ConversionFunnel')
      void import('@/pages/LeadsDetail')
    },
    { timeout: 3000 } // 3 秒内必须执行，避免空闲太久
  )
}
