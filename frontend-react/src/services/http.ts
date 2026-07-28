/**
 * HTTP 客户端
 * 基于 Fetch API 的 HTTP 请求封装
 */
import { API_URL, API_TIMEOUT } from './config';
import type { ApiResponse } from '@/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';
import { mobileRouteHandler } from './mobileRouteHandler';

// 路由跳转函数（避免循环依赖，由调用方注入）
let _navigateToLogin: ((next?: string) => void) | null = null;

/** 由 main.tsx / router 启动时注册；用于 401 时跳登录页。 */
export function registerUnauthorizedHandler(fn: (next?: string) => void) {
  _navigateToLogin = fn;
}

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

  // 通用请求方法（接收已构建好的完整 URL）
  async request<T>(fullUrl: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    // v3.7.0：移动端（Capacitor）+ PWA 端（sql.js）都拦截 API 请求，路由到本地 SQLite 查询
    if ((isMobileClient() || isPwaClient()) && fullUrl.includes('/api/v1/')) {
      try {
        const body = config.body ? JSON.parse(config.body as string) : {};
        const data = await mobileRouteHandler(fullUrl, body);
        return { success: true, data: data as T };
      } catch (error) {
        const msg = error instanceof Error ? error.message : '本地查询失败';
        // 数据库未初始化时给出更友好的提示
        const hint = msg.includes('no such table') || msg.includes('no such column')
          ? '数据库表结构不匹配，请重新同步数据'
          : msg.includes('not implemented')
            ? '该报表暂不支持移动端查看'
            : msg.includes('database') || msg.includes('connection') || msg.includes('PWA_LOCAL_DB_NOT_INITIALIZED')
              ? '数据库未就绪，请先同步数据'
              : msg;
        return {
          success: false,
          error: 'MOBILE_QUERY_ERROR',
          message: hint,
        };
      }
    }

    const { timeout = API_TIMEOUT, ...fetchConfig } = config;

    // 应用请求拦截器
    let processedUrl = fullUrl;
    let processedConfig = fetchConfig;
    // feat-cloud-supabase：若本地有 token，自动注入 Authorization 头
    const token = useAuthStore.getState().accessToken;
    const existingHeaders = (processedConfig.headers || {}) as Record<string, string>;
    if (token && !existingHeaders['Authorization']) {
      processedConfig = {
        ...processedConfig,
        headers: {
          ...existingHeaders,
          Authorization: `Bearer ${token}`,
        },
      };
    }
    for (const interceptor of this.requestInterceptors) {
      const result = interceptor(processedUrl, processedConfig);
      processedUrl = result.url;
      processedConfig = result.config;
    }

    try {
      const response = await this.withTimeout(
        fetch(processedUrl, {
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
      let data: any = {};
      try { data = await processedResponse.json(); } catch { /* 非 JSON */ }

      // feat-cloud-supabase：401 → 清 token + 跳登录（白名单 /api/health 不处理）
      if (processedResponse.status === 401 && processedUrl.indexOf('/api/health') === -1) {
        useAuthStore.getState().clear();
        if (_navigateToLogin) {
          const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
          _navigateToLogin(here);
        }
      }

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
    const fullUrl = this.buildUrl(url);
    return this.request<T>(fullUrl, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT 请求
  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.request<T>(fullUrl, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE 请求
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.request<T>(fullUrl, { ...config, method: 'DELETE' });
  }

  // 文件上传
  async upload<T>(url: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    const { timeout = API_TIMEOUT } = config || {};
    const fullUrl = this.buildUrl(url);

    // feat-local-auth 方案 A：与 request 一致，自动注入 Authorization 头
    // 否则鉴权中间件会拦截 /api/v1/upload 返回 401
    const token = useAuthStore.getState().accessToken;
    const existingHeaders = (config?.headers || {}) as Record<string, string>;
    const headers = {
      ...existingHeaders,
      ...(token && !existingHeaders['Authorization']
        ? { Authorization: `Bearer ${token}` }
        : {}),
    };

    try {
      const response = await this.withTimeout(
        fetch(fullUrl, {
          method: 'POST',
          body: formData,
          // 不设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
          ...config,
          headers,
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

// 导出绑定 self 的便捷方法（feat-cloud-supabase 修复）
//   原写法 `export const { post } = http` 在严格 class 语义下会丢失 this，
//   调用时 this -> undefined -> 'reading buildUrl' 的崩溃。
//   这里用箭头函数显式绑定：http 上的方法都能拿到 http 实例。
export const get = <T>(url: string, params?: Record<string, unknown>, config?: RequestConfig) =>
  http.get<T>(url, params, config);
export const post = <T>(url: string, data?: unknown, config?: RequestConfig) =>
  http.post<T>(url, data, config);
export const put = <T>(url: string, data?: unknown, config?: RequestConfig) =>
  http.put<T>(url, data, config);
export const del = <T>(url: string, config?: RequestConfig) =>
  http.delete<T>(url, config);
export const upload = <T>(url: string, formData: FormData, config?: RequestConfig) =>
  http.upload<T>(url, formData, config);