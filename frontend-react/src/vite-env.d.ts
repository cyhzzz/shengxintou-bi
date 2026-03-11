/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API 基础路径
  readonly VITE_API_BASE_URL: string;
  // 应用标题
  readonly VITE_APP_TITLE: string;
  // 环境
  readonly VITE_ENV: 'development' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}