import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
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
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Ant Design
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/charts'],
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
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'antd', 'zustand', 'dayjs'],
  },
})