import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// v3.6.0：移除 vite 构建期对根 .env WEBDAV_* 的注入。
//   原实现把开发环境坚果云凭据字符串字面量烤进 dist JS bundle，会随 APK 打包泄露。
//   现在移动端凭据完全由用户在前端「数据同步」页面填写，
//   通过 @capacitor/preferences 持久化，不再有任何打包时内置默认值。
//
// v3.7.0：PWA 模式（mode=pwa）构建时 base 设为 '/app/'，部署到 GitHub Pages 的 /app/ 子路径。
//   Web/桌面/安卓版默认 base='/'，不影响现有三端。
//   构建命令：npm run build:pwa（见 package.json）
export default defineConfig(({ mode }) => ({
  base: mode === 'pwa' ? '/app/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // 监听所有网络接口，包括 127.0.0.1 和 ::1
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output directory
    outDir: 'dist',
    // Static assets directory
    assetsDir: 'assets',
    // Generate source maps for debugging
    sourcemap: false,
    // Minify output
    minify: 'esbuild',
    // Target modern browsers
    target: 'esnext',
    // Chunk size warnings（v3.2.5：从 1000 调回 800，让重型 chunk 给出提醒）
    chunkSizeWarningLimit: 800,
    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        // v3.2.5：补全重型库分包，避免落到任意页面 chunk 影响长缓存命中率
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Ant Design 全家桶
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/plots', '@ant-design/charts'],
          // ECharts 按需后的 core runtime（约 200-300KB）
          'echarts-vendor': ['echarts', 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          // framer-motion 运行时（LazyMotion + domAnimation）
          'motion-vendor': ['framer-motion'],
          // 导出库（动态 import，但单独分包便于缓存）
          'export-vendor': ['html2canvas', 'jspdf'],
          // Markdown 渲染（GuideModal 用到）
          'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-sanitize'],
          // State management
          'state-vendor': ['zustand'],
          // Utilities
          'utils-vendor': ['dayjs'],
        },
        // Asset file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // CSS code splitting
    cssCodeSplit: true,
    // Enable CSS minification
    cssMinify: true,
  },
  // Optimize dependencies
  // v3.2.5：补全 antd 全家桶 + echarts + framer-motion，首次 dev 启动不重新预构建
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      'antd', '@ant-design/icons', '@ant-design/plots',
      'echarts', 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers',
      'framer-motion',
      'zustand', 'dayjs',
    ],
    // v3.7.0：sql.js 含 WASM，必须 exclude 避免 Vite 预构建破坏
    exclude: ['sql.js'],
  },
}))