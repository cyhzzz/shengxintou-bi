/**
 * 类型导出入口
 * 自动生成的类型来自 api.schemas.ts，手动维护的类型添加在下方
 */

// =====================================================
// 自动生成的类型（从 api.schemas.ts 重新导出）
// =====================================================
export type {
  // 基础响应类型
  SuccessResponse,
  ErrorResponse,
  SuccessResponseData,

  // 核心指标相关
  CoreMetrics,
  WowChange,
  WowChangeTrend,
  WowChangeColor,
  CoreMetricsResponse,
  CoreMetricsResponseAllOfData,

  // Dashboard 相关
  DashboardAccountsResponse,
  DashboardTrendDataResponse,
  DashboardTrendDataResponseAllOfData,
  DashboardTrendDataResponseAllOfDataMetricType,

  // 趋势相关
  TrendDataPoint,
  TrendResponse,

  // 代理商分析
  AgencyAnalysisItem,
  AgencyAnalysisResponse,

  // 转化漏斗
  FunnelStage,
  ConversionFunnelResponse,

  // 线索明细
  LeadsDetailItem,
  LeadsDetailResponse,

  // 小红书笔记
  XhsNotesListItem,
  XhsNotesListResponse,

  // 账号映射
  AccountMapping,
  AccountMappingCreate,
  AccountMappingUpdate,
  AccountMappingListResponse,
  AccountMappingPlatform,
  AccountMappingBusinessModel,

  // 上传相关
  UploadResponse,
  PostUploadBody,
  PostUploadBodyDataType,

  // 元数据
  Metadata,
  MetadataResponse,
  MetadataDateRange,

  // 请求参数类型
  PostDashboardAccountsBody,
  PostDashboardAccountsBodyFilters,
  PostDashboardCoreMetricsBody,
  PostDashboardTrendDataBody,
  GetTrendDailyParams,
  GetAgencyAnalysisParams,
  GetConversionFunnelParams,
  GetLeadsDetailParams,
  GetXhsNotesListParams,
} from './api.schemas';

// 导出常量（使用别名避免与类型导出冲突）
export {
  WowChangeTrend as WowChangeTrendConst,
  WowChangeColor as WowChangeColorConst,
  DashboardTrendDataResponseAllOfDataMetricType as MetricType,
  PostDashboardTrendDataBodyMetricType,
  PostDashboardCoreMetricsBodyPlatformsItem,
  PostDashboardCoreMetricsBodyBusinessModelsItem,
  AccountMappingPlatform as AccountMappingPlatformConst,
  AccountMappingBusinessModel as AccountMappingBusinessModelConst,
  PostUploadBodyDataType as PostUploadBodyDataTypeConst,
} from './api.schemas';

// =====================================================
// 手动维护的类型（业务特定）
// =====================================================

import type { CoreMetrics, WowChange, DashboardTrendDataResponseAllOfData } from './api.schemas';

/**
 * 通用 API 响应类型（简化版）
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Dashboard 核心指标响应数据
 */
export interface DashboardCoreMetricsData {
  core_metrics?: CoreMetrics;
  wow_changes?: WowChange;
}

/**
 * 环比变化项（单个指标的变化）
 */
export interface WowChangeItem {
  value?: number;
  trend?: 'up' | 'down' | 'flat';
  color?: 'green' | 'red';
}

/**
 * 趋势数据点（用于图表）
 */
export interface TrendDataItem {
  date: string;
  value: number;
  category?: string;
}

/**
 * Dashboard 趋势数据（适配前端图表格式）
 */
export interface DashboardTrendData {
  dates?: string[];
  values?: number[];
  metric_type?: 'cost_per_lead' | 'cost_per_customer' | 'cost_per_valid_account' | 'investment' | 'impressions' | 'clicks' | 'leads' | 'new_customers';
  /** 适配前端图表格式的趋势数据 */
  trend_data: TrendDataItem[];
}

/**
 * 转换 API 响应为前端使用的趋势数据格式
 *
 * 后端实际返回格式：
 * {
 *   trend_data: [{date: "2025-01-01", value: 100}, ...],
 *   summary: { cost_per_lead: 50, ... }
 * }
 *
 * 兼容处理：支持两种格式
 * 1. 后端实际格式：trend_data 数组
 * 2. OpenAPI schema 格式：dates + values 数组
 */
export function transformDashboardTrendData(
  response: DashboardTrendDataResponseAllOfData | undefined
): DashboardTrendData {
  if (!response) {
    return { trend_data: [] };
  }

  // 类型断言：后端实际返回的格式可能包含 trend_data
  const actualResponse = response as unknown as {
    trend_data?: Array<{ date: string; value: number }>;
    dates?: string[];
    values?: number[];
    metric_type?: string;
  };

  // 优先使用后端实际返回的 trend_data 格式
  if (actualResponse.trend_data && Array.isArray(actualResponse.trend_data)) {
    return {
      metric_type: actualResponse.metric_type as DashboardTrendData['metric_type'],
      trend_data: actualResponse.trend_data,
    };
  }

  // 兼容 OpenAPI schema 格式：dates + values
  const { dates, values, metric_type } = actualResponse;

  if (!dates || !values) {
    return { metric_type: metric_type as DashboardTrendData['metric_type'], trend_data: [] };
  }

  const trend_data = dates.map((date, index) => ({
    date,
    value: values[index] ?? 0,
  }));

  return {
    dates,
    values,
    metric_type: metric_type as DashboardTrendData['metric_type'],
    trend_data,
  };
}

// =====================================================
// 数据服务相关类型（兼容现有代码）
// =====================================================

/**
 * 汇总数据
 */
export interface SummaryData {
  total_cost?: number;
  total_impressions?: number;
  total_clicks?: number;
  total_leads?: number;
  total_opened_accounts?: number;
  by_platform?: Array<{
    platform: string;
    cost: number;
    impressions: number;
    clicks: number;
    leads: number;
  }>;
}

/**
 * 趋势数据
 */
export interface TrendData {
  dates?: string[];
  series?: Array<{
    name: string;
    data: number[];
  }>;
}

/**
 * 代理商分析数据
 */
export interface AgencyAnalysisData {
  summary?: Array<{
    platform?: string;
    agency?: string;
    business_model?: string;
    cost?: number;
    impressions?: number;
    clicks?: number;
    leads?: number;
    opened_accounts?: number;
  }>;
  trend?: TrendData;
}

/**
 * 转化漏斗数据
 */
export interface ConversionFunnelData {
  funnel?: Array<{
    step?: string;
    value?: number;
    rate?: number;
  }>;
  core_metrics?: CoreMetrics;
}

/**
 * 线索明细数据
 */
export interface LeadsDetailData {
  lead_date?: string;
  platform_source?: string;
  ad_account?: string;
  agency?: string;
  wechat_nickname?: string;
  capital_account?: string;
  is_customer?: boolean;
  is_valid_lead?: boolean;
  is_opened_account?: boolean;
  is_valid_customer?: boolean;
}