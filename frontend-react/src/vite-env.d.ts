/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API 基础路径
  readonly VITE_API_BASE_URL: string;
  // 应用标题
  readonly VITE_APP_TITLE: string;
  // 环境
  readonly VITE_ENV: 'development' | 'production';
  // WebDAV 坚果云配置（从项目根 .env 注入，用于移动端内置默认凭据）
  readonly VITE_WEBDAV_URL: string;
  readonly VITE_WEBDAV_USERNAME: string;
  readonly VITE_WEBDAV_PASSWORD: string;
  readonly VITE_WEBDAV_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}