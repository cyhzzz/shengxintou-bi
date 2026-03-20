/**
 * 数据 API 服务
 * 提供数据查询相关接口
 */
import { http } from './http';
import type { ApiResponse, SummaryData, TrendData, AgencyAnalysisData, ConversionFunnelData, LeadsDetailData, DashboardCoreMetricsData, DashboardTrendData } from '@/types';

// 筛选条件接口
export interface FilterParams {
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  start_date?: string;
  end_date?: string;
  date_range?: [string, string];
  filters?: Record<string, unknown>;
  creator_name?: string;
  ad_strategies?: string[];
  content_types?: string[];
  account?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

// 数据服务
export const dataService = {
  // 获取汇总数据
  getSummary: async (filters?: FilterParams): Promise<ApiResponse<SummaryData>> => {
    return http.post('/summary', { filters });
  },

  // 获取趋势数据
  getTrend: async (
    filters?: FilterParams,
    metrics?: string[],
    granularity?: 'daily' | 'weekly' | 'monthly'
  ): Promise<ApiResponse<TrendData>> => {
    return http.post('/trend', { filters, metrics, granularity });
  },

  // 获取数据概览核心指标（与原始前端一致）
  getDashboardCoreMetrics: async (params?: {
    platforms?: string[];
    agencies?: string[];
    business_models?: string[];
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<DashboardCoreMetricsData>> => {
    return http.post('/dashboard/core-metrics', params || {});
  },

  // 获取数据概览趋势数据（与原始前端一致）
  getDashboardTrendData: async (params: {
    start_date: string;
    end_date: string;
    platforms?: string[];
    agencies?: string[];
    business_models?: string[];
    metric_type?: 'cost_per_lead' | 'cost_per_customer' | 'cost_per_valid_account';
  }): Promise<ApiResponse<DashboardTrendData>> => {
    return http.post('/dashboard/trend-data', params);
  },

  // 获取代理商分析数据
  getAgencyAnalysis: async (filters?: FilterParams): Promise<ApiResponse<AgencyAnalysisData>> => {
    // 后端使用 GET 请求，需要将 filters 转换为查询参数
    const params: Record<string, string> = {};

    if (filters) {
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      // 数组参数转换为逗号分隔的字符串
      if (filters.platforms?.length) params.platforms = filters.platforms.join(',');
      if (filters.agencies?.length) params.agencies = filters.agencies.join(',');
      if (filters.business_models?.length) params.business_models = filters.business_models.join(',');
    }

    return http.get('/agency-analysis', params);
  },

  // 获取转化漏斗数据
  getConversionFunnel: async (filters?: FilterParams): Promise<ApiResponse<ConversionFunnelData>> => {
    return http.post('/conversion-funnel', { filters });
  },

  // 获取线索明细
  getLeadsDetail: async (
    params?: FilterParams & PaginationParams
  ): Promise<ApiResponse<{ total: number; items: LeadsDetailData[] }>> => {
    return http.get('/leads-detail', params as Record<string, unknown>);
  },

  // 获取小红书笔记列表
  getXhsNotesList: async (
    params?: FilterParams & PaginationParams
  ): Promise<ApiResponse<{
    notes?: unknown[];
    pagination?: { page: number; page_size: number; total: number; total_pages?: number };
    filters?: Record<string, unknown>;
  }>> => {
    return http.post('/xhs-notes-list', params);
  },

  // 获取小红书运营分析
  getXhsNotesOperation: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/xhs-notes-operation-analysis', { filters });
  },

  // 获取员工转化分析
  getEmployeeConversionAnalysis: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/employee-conversion/analysis', { filters });
  },

  // 获取版本信息
  getVersion: async (): Promise<ApiResponse<{
    version: string;
    release_date: string;
    changelog?: string[];
    support_contact?: string;
  }>> => {
    return http.get('/version/local');
  },
};