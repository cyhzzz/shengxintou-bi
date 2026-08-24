/**
 * 数据 API 服务
 * 提供数据查询相关接口
 */
import { http } from './http';
import type { ApiResponse, SummaryData, TrendData, AgencyAnalysisData, LeadsDetailData, DashboardCoreMetricsData, DashboardTrendData } from '@/types';

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
  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
  // 获取汇总数据
  getSummary: async (filters?: FilterParams): Promise<ApiResponse<SummaryData>> => {
    return http.post('/summary', { filters });
  },

  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
  // 获取趋势数据
  getTrend: async (
    filters?: FilterParams,
    metrics?: string[],
    granularity?: 'daily' | 'weekly' | 'monthly'
  ): Promise<ApiResponse<TrendData>> => {
    return http.post('/trend', { filters, metrics, granularity });
  },

  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
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

  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
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

  /**
   * @deprecated v3.3.9 起未使用，前端改走 @/types/api 的同名函数
   */
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

  // 获取转化漏斗拆分数据（v3.1 §三: 内容平台 + 应用市场 双漏斗）
  getConversionFunnelSplit: async (filters?: FilterParams) => {
    return http.post('/conversion-funnel/split', { filters });
  },

  /**
   * @deprecated v3.3.9 起未使用，前端改走 @/types/api 的同名函数
   */
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

  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
  // 获取小红书运营分析
  getXhsNotesOperation: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/xhs-notes-operation-analysis', { filters });
  },

  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
  // 获取员工转化分析
  getEmployeeConversionAnalysis: async (filters?: FilterParams): Promise<ApiResponse<unknown>> => {
    return http.post('/employee-conversion/analysis', { filters });
  },

  /**
   * @deprecated v3.3.9 起自更新前端入口已移除，3 个方法全部闲置
   */
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
  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
  // 启动一次自更新（git pull origin main）
  selfUpdateStart: async (force = false): Promise<ApiResponse<{ task_id: string; message: string }>> => {
    return http.post('/system/self-update/start', { force });
  },
  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
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
  // v3.7.0：前端热更新（Windows Electron 用，从 GitHub Release 下载 dist.zip 覆盖本地）
  frontendUpdateStart: async (): Promise<ApiResponse<{ task_id: string; message: string }>> => {
    return http.post('/system/frontend-update/start', {});
  },
  frontendUpdateStatus: async (taskId: string): Promise<ApiResponse<{
    task_id: string;
    status: string;
    progress?: number;
    message?: string;
    error?: string;
    log?: string[];
  }>> => {
    return http.get('/system/frontend-update/status', { task_id: taskId });
  },
  // v3.9.0：Windows 完整静默更新（下载 full-update.zip 并暂存，重启时替换后端+前端+版本号）
  fullUpdateStart: async (): Promise<ApiResponse<{ task_id: string; message: string }>> => {
    return http.post('/system/full-update/download', {});
  },
  fullUpdateStatus: async (taskId: string): Promise<ApiResponse<{
    task_id: string;
    status: string;
    progress?: number;
    message?: string;
    error?: string;
    data?: { version?: string; staging?: string };
    log?: string[];
  }>> => {
    return http.get('/system/full-update/status', { task_id: taskId });
  },
  getVersion: async (): Promise<ApiResponse<{
    version: string;
    release_date: string;
    changelog?: string[];
    support_contact?: string;
  }>> => {
    return http.get('/version/local');
  },

  // v3.3.6 抖音青鸟线索通对账
  getDouyinQingniaoMatch: async (params: {
    start_date?: string;
    end_date?: string;
    date_tolerance_days?: number;
    batch_tag?: string;
  }) => {
    return http.post('/data-reconciliation/douyin-qingniao/match', params);
  },
  // v3.3.6：date-range 支持 batch_tag 查询参数（仅统计该批次）
  getDouyinQingniaoDateRange: async (batchTag?: string) => {
    const qs = batchTag ? `?batch_tag=${encodeURIComponent(batchTag)}` : '';
    return http.get(`/data-reconciliation/douyin-qingniao/date-range${qs}`);
  },
  // v3.3.6：获取所有导入批次列表
  getDouyinQingniaoBatches: async () => {
    return http.get('/data-reconciliation/douyin-qingniao/batches');
  },
  // 查询导入任务状态（用于「导入青鸟数据」按钮轮询）
  getDouyinQingniaoImportStatus: async (taskId: string) => {
    return http.get(`/status/${taskId}`);
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

// v3.4.1: 坚果云同步检测（启动时自动跑一次 + 前端一键同步按钮共用）
//   返回 success=true + data.cloud_available=false 表示坚果云不可达（前端静默显示）
//   v3.5.10: not_configured=true 表示尚未配置 WebDAV，前端显示友好引导而非报错
export interface WebdavSyncStatus {
  cloud_available: boolean;
  cloud_latest: string | null;
  cloud_filename: string | null;
  cloud_data_latest: string | null;
  meta_source: 'meta' | 'file_mtime' | null;
  needs_meta_rebuild: boolean;
  local_latest: string | null;
  need_sync: boolean;
  diff_hours: number;
  local_sources: Record<string, string>;
  not_configured?: boolean;
}
export const dataServiceWebdav = {
  checkSyncStatus: async (): Promise<{ success: boolean; data: WebdavSyncStatus }> => {
    return http.get('/webdav/sync-check') as unknown as { success: boolean; data: WebdavSyncStatus };
  },
  autoSyncBackup: async (): Promise<{ success: boolean; task_id?: string; filename?: string; message?: string; error?: string }> => {
    return http.post('/webdav/auto-sync', {}) as unknown as { success: boolean; task_id?: string; filename?: string; message?: string; error?: string };
  },
  getProgress: async (taskId: string): Promise<{ success: boolean; data?: { status: string; progress: number; message: string; pre_restore_backup?: string } }> => {
    return http.get(`/webdav/progress/${taskId}`) as unknown as { success: boolean; data?: { status: string; progress: number; message: string; pre_restore_backup?: string } };
  },
  // v3.5.8：WebDAV 配置可视化读写
  getConfig: async (): Promise<{ success: boolean; data?: WebdavConfig; message?: string }> => {
    return http.get('/webdav/config') as unknown as { success: boolean; data?: WebdavConfig; message?: string };
  },
  saveConfig: async (config: Partial<WebdavConfig>): Promise<{ success: boolean; data?: WebdavConfig; message?: string }> => {
    return http.put('/webdav/config', config) as unknown as { success: boolean; data?: WebdavConfig; message?: string };
  },
  testConnection: async (): Promise<{ success: boolean; data?: { success: boolean; status_code?: number; message?: string }; message?: string }> => {
    return http.get('/webdav/test') as unknown as { success: boolean; data?: { success: boolean; status_code?: number; message?: string }; message?: string };
  },
};

// v3.5.8：WebDAV 配置（与后端 /webdav/config 响应一致）
export interface WebdavConfig {
  url: string;
  username: string;
  password: string;           // 掩码（••••••1234），写入时清空表示保留原值
  password_configured: boolean;
  backup_dir: string;
  max_backups: number;
  use_compression: boolean;
  verify_ssl: boolean;
  env_path?: string;
}

// v3.4.3：双向数据同步（SQLite ↔ Supabase PG）
export interface SyncStatus {
  available: boolean;
  message?: string;
  local?: { dialect: string; counts: Record<string, number>; latest_date: string | null };
  cloud?: { dialect: string; counts: Record<string, number>; latest_date: string | null };
}

export interface SyncResult {
  direction: 'upload' | 'download';
  results: Record<string, { rows?: number; error?: string; skipped?: boolean }>;
  total_rows: number;
}

export const dataServiceSync = {
  getStatus: async (): Promise<{ success: boolean; data: SyncStatus }> => {
    return http.get('/data-sync/status') as unknown as { success: boolean; data: SyncStatus };
  },
  upload: async (tables?: string[]): Promise<{ success: boolean; data: SyncResult; message?: string }> => {
    return http.post('/data-sync/upload', { tables }) as unknown as { success: boolean; data: SyncResult; message?: string };
  },
  download: async (tables?: string[]): Promise<{ success: boolean; data: SyncResult; message?: string }> => {
    return http.post('/data-sync/download', { tables }) as unknown as { success: boolean; data: SyncResult; message?: string };
  },
};

export const dataServiceReports = {
  getAppMarketSummary: async (filters: { start_date?: string; end_date?: string; app_markets?: string[]; channel_types?: string[] }) => {
    return http.post('/reports/app-market/summary', { filters });
  },
  /**
   * @deprecated v3.3.9 起未使用，Funnel 页改用 getAppMarketSummary
   */
  getAppMarketFunnel: async (filters: { start_date?: string; end_date?: string; app_markets?: string[]; channel_types?: string[] }) => {
    return http.post('/reports/app-market/funnel', { filters });
  },
  getAppMarketDetail: async (params: { filters?: Record<string, unknown>; page?: number; page_size?: number }) => {
    return http.post('/reports/app-market/detail', params);
  },
  getAppMarketFilterOptions: async () => {
    return http.get('/reports/app-market/filter-options');
  },
  /**
   * @deprecated v3.3.9 起未使用，Creative 页改用 getAppMarketPlanAnalysis
   */
  getAppMarketCreative: async (params: { filters?: Record<string, unknown>; top_n?: number }) => {
    return http.post('/reports/app-market/creative', params);
  },
  // v3.3.5 计划分析（按周度走势 + 按平台单选）
  getAppMarketPlanAnalysis: async (params: { filters?: Record<string, unknown>; top_n?: number }) => {
    return http.post('/reports/app-market/plan-analysis', params);
  },
  // v3.3.10 小红书 · 计划分析（按周度走势 + 按代理商单选）
  //   filters.agency: 单值字符串，可为 None=全部（仅 TARGET_AGENCIES 内代理商）
  //   filters.start_date / end_date: 日期区间
  //   top_n: Top N 计划（默认 30）
  getXhsPlanAnalysis: async (params: { filters?: Record<string, unknown>; top_n?: number }) => {
    return http.post('/reports/xhs/plan-analysis', params);
  },
  // v3.6.3 应用市场 · 消耗和成本
  getAppMarketCostAnalysis: async (filters: { start_date: string; end_date: string }) => {
    return http.post('/reports/app-market/cost-analysis', { filters });
  },
  // v3.8.1 应用市场 · 归因转化率分析
  getAppMarketAttributionConversion: async (filters: {
    start_date?: string; end_date?: string; platforms?: string[];
  }) => {
    return http.post('/reports/app-market/attribution-conversion', { filters });
  },
  // v3.8.2 应用市场 · 广告计划分析（计划分解 + 下载链路 + 消耗）
  getAppMarketAdPlanAnalysis: async (params: {
    filters?: { platforms?: string[]; start_date?: string; end_date?: string };
  }) => {
    return http.post('/reports/app-market/ad-plan-analysis', params);
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
  /**
   * @deprecated v3.3.9 起未使用，保留接口待后续清理
   */
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


// 小红书 · 分支KOS转化周报 v3.8.0
// 数据源：fact_conv_content.笔记ID 关联 agg_xhs_note.创作者（分支KOS投顾名单）
export interface XhsKosRankingItem {
  kos_name: string;
  platform: string;
  total_leads: number;
  mouth_count: number;
  valid_lead_count: number;
  opened_count: number;
  valid_customer_count: number;
  total_assets: number;
  opening_rate: number;
  valid_customer_rate: number;
}

export interface XhsKosWeeklyData {
  platform: string;
  roster_count: number;
  roster: string[];
  rankings: Record<string, {
    total: XhsKosRankingItem[];
    existing: XhsKosRankingItem[];
    new: XhsKosRankingItem[];
    existing_new_open: XhsKosRankingItem[];
  }>;
  overview: Record<string, {
    total_leads: number;
    mouth_count: number;
    valid_lead_count: number;
    opened_count: number;
    valid_customer_count: number;
    total_assets: number;
    opening_rate: number;
  }>;
  trend: { period: string; leads: number; opened: number; valid: number }[];
}

export const dataServiceXhsKos = {
  getXhsKosWeekly: async (params: { start_date?: string; end_date?: string } = {}) => {
    return http.post('/xhs/kos-weekly', params);
  },
  getXhsKosWeeklyFilterOptions: async () => {
    return http.get('/xhs/kos-weekly/filter-options');
  },
};




