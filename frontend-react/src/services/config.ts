/**
 * API 配置
 * 定义 API 基础 URL 和超时配置
 */

// API 基础 URL
// 开发环境：使用空字符串，让请求通过 Vite 代理（避免 CORS 问题）
// 生产环境：可通过环境变量配置完整的后端地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// API 版本前缀
export const API_PREFIX = '/api/v1';

// 完整的 API URL
export const API_URL = `${API_BASE_URL}${API_PREFIX}`;

// 请求超时时间（毫秒）
export const API_TIMEOUT = 30000;

// API 响应状态码
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;