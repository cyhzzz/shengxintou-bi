/**
 * HTTP 客户端
 * 基于 Fetch API 的 HTTP 请求封装
 */
import { API_URL, API_TIMEOUT } from './config';
import type { ApiResponse } from '@/types';

// 请求配置接口
interface RequestConfig extends RequestInit {
  timeout?: number;
}

// 请求拦截器类型
type RequestInterceptor = (url: string, config: RequestConfig) => { url: string; config: RequestConfig };

// 响应拦截器类型
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

// 错误拦截器类型
type ErrorInterceptor = (error: Error) => void;

class HttpClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // 添加请求拦截器
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  // 添加响应拦截器
  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  // 添加错误拦截器
  addErrorInterceptor(interceptor: ErrorInterceptor) {
    this.errorInterceptors.push(interceptor);
  }

  // 超时控制
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), timeout);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  // 构建完整 URL
  private buildUrl(url: string, params?: Record<string, unknown>): string {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const separator = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${separator}${searchParams.toString()}`;
    }
    return fullUrl;
  }

  // 通用请求方法
  async request<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const { timeout = API_TIMEOUT, ...fetchConfig } = config;

    // 应用请求拦截器
    let processedUrl = url;
    let processedConfig = fetchConfig;
    for (const interceptor of this.requestInterceptors) {
      const result = interceptor(processedUrl, processedConfig);
      processedUrl = result.url;
      processedConfig = result.config;
    }

    try {
      const response = await this.withTimeout(
        fetch(this.buildUrl(processedUrl), {
          ...processedConfig,
          headers: {
            'Content-Type': 'application/json',
            ...processedConfig.headers,
          },
        }),
        timeout
      );

      // 应用响应拦截器
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      // 解析响应
      const data = await processedResponse.json();

      if (!processedResponse.ok || data.success === false) {
        return {
          success: false,
          error: data.error || 'REQUEST_ERROR',
          message: data.message || `请求失败: ${processedResponse.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      // 应用错误拦截器
      const err = error instanceof Error ? error : new Error(String(error));
      for (const interceptor of this.errorInterceptors) {
        interceptor(err);
      }

      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: err.message || '网络请求失败',
      };
    }
  }

  // GET 请求
  async get<T>(url: string, params?: Record<string, unknown>, config?: RequestConfig): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url, params);
    return this.request<T>(fullUrl, { ...config, method: 'GET' });
  }

  // POST 请求
  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT 请求
  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE 请求
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  // 文件上传
  async upload<T>(url: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    const { timeout = API_TIMEOUT } = config || {};

    try {
      const response = await this.withTimeout(
        fetch(this.buildUrl(url), {
          method: 'POST',
          body: formData,
          // 不设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
          ...config,
          headers: {
            ...config?.headers,
          },
        }),
        timeout
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        return {
          success: false,
          error: data.error || 'UPLOAD_ERROR',
          message: data.message || '文件上传失败',
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: 'UPLOAD_ERROR',
        message: err.message || '文件上传失败',
      };
    }
  }
}

// 导出 HTTP 客户端实例
export const http = new HttpClient(API_URL);

// 导出便捷方法
export const { get, post, put, delete: del, upload } = http;