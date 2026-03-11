/**
 * API 配置
 * 定义 API 基础 URL 和超时配置
 */

// API 基础 URL（开发环境使用本地服务器）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

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