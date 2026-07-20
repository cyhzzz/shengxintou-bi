import { http } from './http';
import type { ApiResponse } from '@/types';

/**
 * Orval 自定义 Mutator
 * 用于将 orval 生成的 API 调用适配到现有的 HTTP 客户端
 */

export interface OrvalRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * 自定义 Mutator 函数
 * 将 orval 生成的请求配置转换为 http 客户端调用
 */
export const customMutator = async <T>(config: OrvalRequestConfig): Promise<ApiResponse<T>> => {
  const { url, method, params, data, headers } = config;

  // 将 headers 转换为 RequestConfig 格式
  const requestConfig = headers ? { headers } : undefined;

  // 根据 HTTP 方法调用对应的 http 方法
  // http.* 返回 ApiResponse<T>，与 SuccessResponse 在结构上等价（success/data/error/message）
  switch (method) {
    case 'GET':
      return http.get<T>(url, params, requestConfig) as unknown as ApiResponse<T>;

    case 'POST':
      return http.post<T>(url, data, requestConfig) as unknown as ApiResponse<T>;

    case 'PUT':
      return http.put<T>(url, data, requestConfig) as unknown as ApiResponse<T>;

    case 'DELETE':
      return http.delete<T>(url, requestConfig) as unknown as ApiResponse<T>;

    case 'PATCH':
      return http.request<T>(url, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
        ...(headers ? { headers } : {}),
      }) as unknown as ApiResponse<T>;

    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
};

export default customMutator;