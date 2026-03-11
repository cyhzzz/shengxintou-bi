/**
 * 数据 API 服务
 * 提供数据查询相关接口
 */
import { http } from './http';
import type { ApiResponse, SummaryData, TrendData, AgencyAnalysisData, ConversionFunnelData, LeadsDetailData } from '@/types';

// 筛选条件接口
export interface FilterParams {
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  start_date?: string;
  end_date?: string;
  date_range?: [string, string];
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

  // 获取代理商分析数据
  getAgencyAnalysis: async (filters?: FilterParams): Promise<ApiResponse<AgencyAnalysisData>> => {
    return http.post('/agency-analysis', { filters });
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
  ): Promise<ApiResponse<{ total: number; items: unknown[] }>> => {
    return http.get('/xhs-notes-list', params as Record<string, unknown>);
  },

  // 获取小红书运营分析
  getXhsNotesOperation: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/xhs-notes-operation-analysis', { filters });
  },

  // 获取员工转化分析
  getEmployeeConversionAnalysis: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/employee-conversion-analysis', { filters });
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