/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API 基础路径
  readonly VITE_API_BASE_URL: string;
  // 应用标题
  readonly VITE_APP_TITLE: string;
  // 环境
  readonly VITE_ENV: 'development' | 'production';
  // v3.6.0：VITE_WEBDAV_* 已移除——移动端凭据由用户在前端填写，
  //   通过 @capacitor/preferences 持久化，不再打包时注入
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}