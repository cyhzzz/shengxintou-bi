import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// v3.5.3：移动端调试 — 全局未捕获错误捕获器
// 没有模拟器/adb 时，把完整 stack 写到 localStorage + 显示可复制浮层，
// 方便用户从手机屏幕读取错误堆栈反馈给开发。
// 桌面端 Chrome DevTools 已够用，仅在移动端启用。
const isMobile = typeof window !== 'undefined'
  && (window as any).Capacitor !== undefined
  && (window as any).Capacitor?.isNative?.() === true;

if (isMobile) {
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
      // 写入 localStorage（保留最近 10 条）
      const KEY = 'mobile_errors';
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      arr.unshift(entry);
      if (arr.length > 10) arr.length = 10;
      localStorage.setItem(KEY, JSON.stringify(arr));
      // 显示浮层（避免重复）
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

  // 1. 同步错误
  window.addEventListener('error', (e) => {
    if (e.error?.stack) {
      captureError('error', { message: e.message, stack: e.error.stack });
    } else {
      captureError('error', { message: e.message });
    }
  });
  // 2. Promise 异步错误
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    if (reason instanceof Error) {
      captureError('promise', { message: reason.message, stack: reason.stack });
    } else {
      captureError('promise', { message: String(reason) });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

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
