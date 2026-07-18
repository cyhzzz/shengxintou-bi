import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
