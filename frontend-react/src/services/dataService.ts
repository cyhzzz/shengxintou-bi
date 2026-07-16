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

  // 获取转化漏斗数据（v2.1 单端点，保留兼容）
  getConversionFunnel: async (filters?: FilterParams): Promise<ApiResponse<ConversionFunnelData>> => {
    return http.post('/conversion-funnel', { filters });
  },
  // 获取转化漏斗拆分数据（v3.1 §三: 内容平台 + 应用市场 双漏斗）
  getConversionFunnelSplit: async (filters?: FilterParams) => {
    return http.post('/conversion-funnel/split', { filters });
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

  // 获取小红书笔记列表筛选选项（创作者/内容类型/广告策略/发布账号字典）
  getXhsNotesListFilterOptions: async (): Promise<ApiResponse<{
    creators?: string[];
    content_types?: string[];
    ad_strategies?: string[];
    publish_accounts?: string[];
  }>> => {
    return http.get('/xhs-notes/filter-options');
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
  // Git 更新状态（git head / dirty / 远端 sha）
  getGitStatus: async (): Promise<ApiResponse<{
    available?: boolean;
    branch?: string;
    local_sha?: string;
    remote_sha?: string;
    dirty?: boolean;
    checked_at?: string;
    local_version?: string;
    error?: string;
  }>> => {
    return http.get('/system/self-update/git-status');
  },
  // 启动一次自更新（git pull origin main）
  selfUpdateStart: async (force = false): Promise<ApiResponse<{ task_id: string; message: string }>> => {
    return http.post('/system/self-update/start', { force });
  },
  // 查询自更新任务状态（前端 1s 轮询）
  selfUpdateStatus: async (taskId: string): Promise<ApiResponse<{
    task_id: string;
    status: string;
    progress?: number;
    message?: string;
    error?: string;
    before_version?: string;
    after_version?: string;
    log?: string[];
  }>> => {
    return http.get('/system/self-update/status', { task_id: taskId });
  },
  getVersion: async (): Promise<ApiResponse<{
    version: string;
    release_date: string;
    changelog?: string[];
    support_contact?: string;
  }>> => {
    return http.get('/version/local');
  },
};

// 应用市场专项报表（v2.1）
export interface AppMarketFunnelStep {
  step: string;
  count: number;
  rate: number;
  step_rate?: number;
}
export interface AppMarketSummary {
  total_counts: Record<string, number>;
  total_funnel: AppMarketFunnelStep[];
  by_month_market: Array<{ month: string; app_market: string; counts: Record<string, number>; final_open_rate: number; final_valid_rate: number }>;
  by_market: Array<{ app_market: string; counts: Record<string, number>; funnel: AppMarketFunnelStep[] }>;
  by_channel_type: Array<{ channel_type: string; app_market: string; counts: Record<string, number> }>;
}

export const dataServiceReports = {
  getAppMarketSummary: async (filters: { start_date?: string; end_date?: string; app_markets?: string[]; channel_types?: string[] }) => {
    return http.post('/reports/app-market/summary', { filters });
  },
  getAppMarketFunnel: async (filters: { start_date?: string; end_date?: string; app_markets?: string[]; channel_types?: string[] }) => {
    return http.post('/reports/app-market/funnel', { filters });
  },
  getAppMarketDetail: async (params: { filters?: Record<string, unknown>; page?: number; page_size?: number }) => {
    return http.post('/reports/app-market/detail', params);
  },
  getAppMarketFilterOptions: async () => {
    return http.get('/reports/app-market/filter-options');
  },
  getAppMarketCreative: async (params: { filters?: Record<string, unknown>; top_n?: number }) => {
    return http.post('/reports/app-market/creative', params);
  },
};


// 全渠道获客情况报表 v3.1（v3.1 §二.5 重构：单一独立数据源 agg_daily_channel_open）
export interface OmniChannelCategoryRow {
  channel_category: string;
  opens: number;
  deposit: number;
  valid: number;
  valid_rate: number;
  deposit_rate: number;
}
export interface OmniChannelSubchannelRow extends OmniChannelCategoryRow {
  channel_name: string;
}
export interface OmniChannelTotals {
  opens: number;
  deposit: number;
  valid: number;
}
export interface OmniChannelSummary {
  totals: OmniChannelTotals;
  by_category: OmniChannelCategoryRow[];
  by_subchannel: OmniChannelSubchannelRow[];
}
// daily-trend: 每个日期一条，4 大类各一字段
export interface OmniChannelDailyTrendRow {
  date: string;
  channel_category: string;
  opens: number;
  deposit: number;
  valid: number;
}
export interface OmniChannelDailyTrend {
  daily_trend: OmniChannelDailyTrendRow[];
}
export interface OmniChannelByChannel {
  items: OmniChannelSubchannelRow[];
  channel_category: string;
}
export interface OmniChannelFilterOptions {
  channel_categories: string[];
  sub_channels: string[];
}
// 主播聚类 (Bug 6): 按 客户来源 中的 [平台引流-主播名] 聚类
export const dataServiceLeadsAnchor = {
  getAnchorClusters: async (params: { filters?: Record<string, unknown>; top_n?: number } = {}) => {
    return http.post('/leads-detail/anchor-clusters', params);
  },
  // v3.1.27: 主播引流走势 (daily/weekly/monthly, 按平台 series)
  getAnchorClustersTrend: async (params: { filters?: Record<string, unknown>; granularity?: 'daily' | 'weekly' | 'monthly' } = {}) => {
    return http.post('/leads-detail/anchor-clusters-trend', params);
  },
};

export const dataServiceOmniChannel = {
  getOmniChannelSummary: async (params: { filters?: Record<string, unknown> } = {}) => {
    return http.post('/reports/omni-channel/summary', params);
  },
  getOmniChannelDailyTrend: async (params: { filters?: Record<string, unknown> } = {}) => {
    return http.post('/reports/omni-channel/daily-trend', params);
  },
  getOmniChannelByChannel: async (params: { filters?: Record<string, unknown>; channel_category?: string } = {}) => {
    return http.post('/reports/omni-channel/by-channel', params);
  },
  getOmniChannelFilterOptions: async () => {
    return http.get('/reports/omni-channel/filter-options');
  },
  getOmniChannelDailyCalendar: async (params: { filters?: Record<string, unknown>; days?: number } = {}) => {
    return http.post('/reports/omni-channel/daily-calendar', params);
  },
};




