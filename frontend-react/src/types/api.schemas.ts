/**
 * /**
 *  * API 类型定义 - 自动生成
 *  * 生成时间: 2026-03-12T04:01:15.202Z
 *  * 请勿手动修改此文件
 *  *\/
 */
export type SuccessResponseData = { [key: string]: unknown };

export interface SuccessResponse {
  success: boolean;
  data?: SuccessResponseData;
  message?: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  message?: string;
}

export interface CoreMetrics {
  /** 总投入（元） */
  investment?: number;
  /** 总曝光数 */
  total_impressions?: number;
  /** 总点击数 */
  total_clicks?: number;
  /** 总线索数 */
  total_leads?: number;
  /** 新开客户数 */
  new_customers?: number;
  /** 新有效户数 */
  new_valid_accounts?: number;
  /** 线索成本 */
  cost_per_lead?: number;
  /** 有效户成本 */
  cost_per_valid_account?: number;
  /** 新客户资产 */
  customer_assets?: number;
  /** 客户贡献 */
  customer_contribution?: number;
  /** 存量客户资产 */
  existing_customers_assets?: number;
}

/**
 * 趋势方向
 */
export type WowChangeTrend = typeof WowChangeTrend[keyof typeof WowChangeTrend];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const WowChangeTrend = {
  up: 'up',
  down: 'down',
  flat: 'flat',
} as const;

/**
 * 显示颜色（绿色表示正向，红色表示负向）
 */
export type WowChangeColor = typeof WowChangeColor[keyof typeof WowChangeColor];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const WowChangeColor = {
  green: 'green',
  red: 'red',
} as const;

/**
 * 环比变化
 */
export interface WowChange {[key: string]: {
  /** 变化百分比 */
  value?: number;
  /** 趋势方向 */
  trend?: WowChangeTrend;
  /** 显示颜色（绿色表示正向，红色表示负向） */
  color?: WowChangeColor;
}}

export type CoreMetricsResponseAllOfData = {
  core_metrics?: CoreMetrics;
  wow_changes?: WowChange;
};

export type CoreMetricsResponseAllOf = {
  data?: CoreMetricsResponseAllOfData;
};

export type CoreMetricsResponse = SuccessResponse & CoreMetricsResponseAllOf;

export type DashboardAccountsResponseAllOfData = {
  /** 账号列表 */
  accounts?: string[];
};

export type DashboardAccountsResponseAllOf = {
  data?: DashboardAccountsResponseAllOfData;
};

export type DashboardAccountsResponse = SuccessResponse & DashboardAccountsResponseAllOf;

/**
 * 指标类型
 */
export type DashboardTrendDataResponseAllOfDataMetricType = typeof DashboardTrendDataResponseAllOfDataMetricType[keyof typeof DashboardTrendDataResponseAllOfDataMetricType];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const DashboardTrendDataResponseAllOfDataMetricType = {
  cost_per_lead: 'cost_per_lead',
  cost_per_customer: 'cost_per_customer',
  cost_per_valid_account: 'cost_per_valid_account',
  investment: 'investment',
  impressions: 'impressions',
  clicks: 'clicks',
  leads: 'leads',
  new_customers: 'new_customers',
} as const;

export type DashboardTrendDataResponseAllOfData = {
  /** 日期数组 */
  dates?: string[];
  /** 指标值数组 */
  values?: number[];
  /** 指标类型 */
  metric_type?: DashboardTrendDataResponseAllOfDataMetricType;
};

export type DashboardTrendDataResponseAllOf = {
  data?: DashboardTrendDataResponseAllOfData;
};

export type DashboardTrendDataResponse = SuccessResponse & DashboardTrendDataResponseAllOf;

export interface TrendDataPoint {
  date?: string;
  cost?: number;
  impressions?: number;
  clicks?: number;
  leads?: number;
  opened_accounts?: number;
}

export type TrendResponseAllOfDataSeriesItem = {
  name?: string;
  data?: number[];
};

export type TrendResponseAllOfData = {
  dates?: string[];
  series?: TrendResponseAllOfDataSeriesItem[];
};

export type TrendResponseAllOf = {
  data?: TrendResponseAllOfData;
};

export type TrendResponse = SuccessResponse & TrendResponseAllOf;

export interface AgencyAnalysisItem {
  platform?: string;
  agency?: string;
  business_model?: string;
  cost?: number;
  impressions?: number;
  clicks?: number;
  leads?: number;
  opened_accounts?: number;
  valid_customers?: number;
}

export type AgencyAnalysisResponseAllOfData = {
  summary?: AgencyAnalysisItem[];
  trend?: TrendResponse;
};

export type AgencyAnalysisResponseAllOf = {
  data?: AgencyAnalysisResponseAllOfData;
};

export type AgencyAnalysisResponse = SuccessResponse & AgencyAnalysisResponseAllOf;

export interface FunnelStage {
  /** 漏斗阶段名称 */
  step?: string;
  /** 该阶段数值 */
  value?: number;
  /** 转化率（百分比） */
  rate?: number;
}

export type ConversionFunnelResponseAllOfData = {
  funnel?: FunnelStage[];
  core_metrics?: CoreMetrics;
  is_employee_mode?: boolean;
};

export type ConversionFunnelResponseAllOf = {
  data?: ConversionFunnelResponseAllOfData;
};

export type ConversionFunnelResponse = SuccessResponse & ConversionFunnelResponseAllOf;

export interface LeadsDetailItem {
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

export type LeadsDetailResponseAllOfData = {
  total?: number;
  page?: number;
  page_size?: number;
  items?: LeadsDetailItem[];
};

export type LeadsDetailResponseAllOf = {
  data?: LeadsDetailResponseAllOfData;
};

export type LeadsDetailResponse = SuccessResponse & LeadsDetailResponseAllOf;

export interface XhsNotesListItem {
  date?: string;
  note_id?: string;
  note_title?: string;
  note_url?: string;
  creator_name?: string;
  producer?: string;
  ad_strategy?: string;
  note_type?: string;
  cost?: number;
  impressions?: number;
  clicks?: number;
  lead_users?: number;
  opened_account_users?: number;
}

export type XhsNotesListResponseAllOfData = {
  total?: number;
  page?: number;
  page_size?: number;
  items?: XhsNotesListItem[];
};

export type XhsNotesListResponseAllOf = {
  data?: XhsNotesListResponseAllOfData;
};

export type XhsNotesListResponse = SuccessResponse & XhsNotesListResponseAllOf;

export type AccountMappingPlatform = typeof AccountMappingPlatform[keyof typeof AccountMappingPlatform];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AccountMappingPlatform = {
  腾讯: '腾讯',
  抖音: '抖音',
  小红书: '小红书',
} as const;

export type AccountMappingBusinessModel = typeof AccountMappingBusinessModel[keyof typeof AccountMappingBusinessModel];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AccountMappingBusinessModel = {
  直播: '直播',
  信息流: '信息流',
  搜索: '搜索',
} as const;

export interface AccountMapping {
  id?: number;
  platform?: AccountMappingPlatform;
  account_id?: string;
  account_name?: string;
  main_account_id?: string;
  agency?: string;
  business_model?: AccountMappingBusinessModel;
  created_at?: string;
  updated_at?: string;
}

export type AccountMappingCreatePlatform = typeof AccountMappingCreatePlatform[keyof typeof AccountMappingCreatePlatform];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AccountMappingCreatePlatform = {
  腾讯: '腾讯',
  抖音: '抖音',
  小红书: '小红书',
} as const;

export type AccountMappingCreateBusinessModel = typeof AccountMappingCreateBusinessModel[keyof typeof AccountMappingCreateBusinessModel];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AccountMappingCreateBusinessModel = {
  直播: '直播',
  信息流: '信息流',
  搜索: '搜索',
} as const;

export interface AccountMappingCreate {
  platform: AccountMappingCreatePlatform;
  account_id?: string;
  account_name?: string;
  main_account_id?: string;
  agency: string;
  business_model?: AccountMappingCreateBusinessModel;
}

export type AccountMappingUpdateBusinessModel = typeof AccountMappingUpdateBusinessModel[keyof typeof AccountMappingUpdateBusinessModel];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AccountMappingUpdateBusinessModel = {
  直播: '直播',
  信息流: '信息流',
  搜索: '搜索',
} as const;

export interface AccountMappingUpdate {
  account_name?: string;
  agency?: string;
  business_model?: AccountMappingUpdateBusinessModel;
}

export type AccountMappingListResponseAllOf = {
  data?: AccountMapping[];
};

export type AccountMappingListResponse = SuccessResponse & AccountMappingListResponseAllOf;

export type UploadResponseAllOfData = {
  total_rows?: number;
  success_count?: number;
  failed_count?: number;
  failed_rows?: number[];
  errors?: string[];
};

export type UploadResponseAllOf = {
  data?: UploadResponseAllOfData;
};

export type UploadResponse = SuccessResponse & UploadResponseAllOf;

export type MetadataDateRange = {
  min?: string;
  max?: string;
};

export interface Metadata {
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  date_range?: MetadataDateRange;
}

export type MetadataResponseAllOf = {
  data?: Metadata;
};

export type MetadataResponse = SuccessResponse & MetadataResponseAllOf;

export type PostDashboardAccountsBodyFiltersPlatformsItem = typeof PostDashboardAccountsBodyFiltersPlatformsItem[keyof typeof PostDashboardAccountsBodyFiltersPlatformsItem];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostDashboardAccountsBodyFiltersPlatformsItem = {
  腾讯: '腾讯',
  抖音: '抖音',
  小红书: '小红书',
} as const;

export type PostDashboardAccountsBodyFilters = {
  /** 平台筛选 */
  platforms?: PostDashboardAccountsBodyFiltersPlatformsItem[];
  /** 代理商筛选 */
  agencies?: string[];
};

export type PostDashboardAccountsBody = {
  filters?: PostDashboardAccountsBodyFilters;
};

export type PostDashboardCoreMetricsBodyPlatformsItem = typeof PostDashboardCoreMetricsBodyPlatformsItem[keyof typeof PostDashboardCoreMetricsBodyPlatformsItem];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostDashboardCoreMetricsBodyPlatformsItem = {
  腾讯: '腾讯',
  抖音: '抖音',
  小红书: '小红书',
} as const;

export type PostDashboardCoreMetricsBodyBusinessModelsItem = typeof PostDashboardCoreMetricsBodyBusinessModelsItem[keyof typeof PostDashboardCoreMetricsBodyBusinessModelsItem];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostDashboardCoreMetricsBodyBusinessModelsItem = {
  直播: '直播',
  信息流: '信息流',
  搜索: '搜索',
} as const;

export type PostDashboardCoreMetricsBody = {
  /** 开始日期 (YYYY-MM-DD) */
  start_date?: string;
  /** 结束日期 (YYYY-MM-DD) */
  end_date?: string;
  /** 平台筛选 */
  platforms?: PostDashboardCoreMetricsBodyPlatformsItem[];
  /** 代理商筛选 */
  agencies?: string[];
  /** 业务模式筛选 */
  business_models?: PostDashboardCoreMetricsBodyBusinessModelsItem[];
};

/**
 * 指标类型
 */
export type PostDashboardTrendDataBodyMetricType = typeof PostDashboardTrendDataBodyMetricType[keyof typeof PostDashboardTrendDataBodyMetricType];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostDashboardTrendDataBodyMetricType = {
  cost_per_lead: 'cost_per_lead',
  cost_per_customer: 'cost_per_customer',
  cost_per_valid_account: 'cost_per_valid_account',
  investment: 'investment',
  impressions: 'impressions',
  clicks: 'clicks',
  leads: 'leads',
  new_customers: 'new_customers',
} as const;

/**
 * 趋势数据聚合粒度
 */
export type PostDashboardTrendDataBodyGranularity = typeof PostDashboardTrendDataBodyGranularity[keyof typeof PostDashboardTrendDataBodyGranularity];

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostDashboardTrendDataBodyGranularity = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
} as const;

export type PostDashboardTrendDataBody = {
  /** 开始日期 (YYYY-MM-DD) */
  start_date: string;
  /** 结束日期 (YYYY-MM-DD) */
  end_date: string;
  /** 平台筛选 */
  platforms?: string[];
  /** 代理商筛选 */
  agencies?: string[];
  /** 业务模式筛选 */
  business_models?: string[];
  /** 指标类型 */
  metric_type?: PostDashboardTrendDataBodyMetricType;
  /** 聚合粒度 (daily/weekly/monthly) */
  granularity?: PostDashboardTrendDataBodyGranularity;
};

export type GetTrendDailyParams = {
/**
 * 开始日期 (YYYY-MM-DD)
 */
start_date: string;
/**
 * 结束日期 (YYYY-MM-DD)
 */
end_date: string;
/**
 * 平台筛选
 */
platforms?: string[];
/**
 * 指标列表
 */
metrics?: GetTrendDailyMetricsItem[];
};

export type GetTrendDailyMetricsItem = typeof GetTrendDailyMetricsItem[keyof typeof GetTrendDailyMetricsItem];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const GetTrendDailyMetricsItem = {
  cost: 'cost',
  impressions: 'impressions',
  clicks: 'clicks',
  leads: 'leads',
  opened_accounts: 'opened_accounts',
} as const;

export type GetAgencyAnalysisParams = {
start_date?: string;
end_date?: string;
platforms?: string[];
business_models?: GetAgencyAnalysisBusinessModelsItem[];
agencies?: string[];
};

export type GetAgencyAnalysisBusinessModelsItem = typeof GetAgencyAnalysisBusinessModelsItem[keyof typeof GetAgencyAnalysisBusinessModelsItem];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const GetAgencyAnalysisBusinessModelsItem = {
  直播: '直播',
  信息流: '信息流',
  搜索: '搜索',
} as const;

export type GetConversionFunnelParams = {
start_date: string;
end_date: string;
platforms?: string[];
agencies?: string[];
business_models?: string[];
/**
 * 是否按服务人员维度统计
 */
employee_mode?: boolean;
};

export type GetLeadsDetailParams = {
page?: number;
page_size?: number;
start_date?: string;
end_date?: string;
platform?: string;
is_customer?: boolean;
is_opened_account?: boolean;
};

export type GetXhsNotesListParams = {
page?: number;
page_size?: number;
start_date?: string;
end_date?: string;
creator_name?: string;
producer?: string;
ad_strategy?: string;
};

/**
 * 数据类型
 */
export type PostUploadBodyDataType = typeof PostUploadBodyDataType[keyof typeof PostUploadBodyDataType];


// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PostUploadBodyDataType = {
  tencent_ads: 'tencent_ads',
  douyin_ads: 'douyin_ads',
  xiaohongshu_ads: 'xiaohongshu_ads',
  xhs_notes: 'xhs_notes',
  backend_conversion: 'backend_conversion',
} as const;

export type PostUploadBody = {
  /** 上传的文件 */
  file: Blob;
  /** 数据类型 */
  data_type: PostUploadBodyDataType;
  /** 是否覆盖已有数据 */
  overwrite?: boolean;
};

// ===== 简称映射API类型 =====

/**
 * 映射类型
 */
export type MappingType = typeof MappingType[keyof typeof MappingType];

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const MappingType = {
  agency: 'agency',
  platform: 'platform',
} as const;

export interface AbbreviationMapping {
  id: number;
  abbreviation: string;
  full_name: string;
  mapping_type: MappingType;
  platform: string | null;
  display_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAbbreviationMappingBody {
  abbreviation: string;
  full_name: string;
  mapping_type: MappingType;
  platform?: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateAbbreviationMappingBody {
  full_name?: string;
  mapping_type?: MappingType;
  platform?: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface AbbreviationMappingListResponse {
  success: boolean;
  data: AbbreviationMapping[];
}

// ===== WebDAV 数据同步API类型 =====

export interface WebdavBackupResponse {
  success: boolean;
  task_id: string;
  message?: string;
}

export interface WebdavRestoreResponse {
  success: boolean;
  task_id: string;
  message?: string;
}

export interface WebdavBackupFile {
  filename: string;
  size: number;
  created: string;
}

export interface WebdavListResponse {
  success: boolean;
  data: WebdavBackupFile[];
}

export interface WebdavProgressData {
  status: 'pending' | 'uploading' | 'downloading' | 'completed' | 'failed';
  progress: number;
  message: string;
}

export interface WebdavProgressResponse {
  success: boolean;
  data: WebdavProgressData;
}

export interface WebdavDeleteResponse {
  success: boolean;
  message?: string;
}

export interface VersionCompareData {
  needs_update: boolean;
  message?: string;
  cloud_version?: string;
  support_contact?: string;
}

export interface VersionCompareResponse {
  success: boolean;
  data: VersionCompareData;
}

// ===== 员工转化周报API类型 =====

export interface PostEmployeeConversionWeeklyBody {
  start_date: string;
  end_date: string;
  platforms?: string[];
  top_count?: number;
}

export interface EmployeeWeeklyRankingItem {
  employee_name: string;
  employee_no?: string;
  total_leads: number;
  mouth_count?: number;
  valid_lead_count?: number;
  opened_count: number;
  valid_customer_count?: number;
  total_assets?: number;
  opening_rate: number;
  valid_customer_rate?: number;
}

export interface EmployeeWeeklyOverview {
  leads: number;
  opened: number;
  rate: number;
}

export interface EmployeeWeeklyPlatformData {
  overview: EmployeeWeeklyOverview;
  rankings: {
    total: EmployeeWeeklyRankingItem[];
    existing: EmployeeWeeklyRankingItem[];
    new: EmployeeWeeklyRankingItem[];
  };
  star?: {
    name: string;
    rate: number;
  };
}

export interface EmployeeConversionWeeklyData {
  period: {
    start_date: string;
    end_date: string;
  };
  overview: Record<string, EmployeeWeeklyOverview>;
  rankings: Record<string, EmployeeWeeklyPlatformData['rankings']>;
  stars: Record<string, { name: string; rate: number }>;
}

export interface EmployeeConversionWeeklyResponse {
  success: boolean;
  data: EmployeeConversionWeeklyData;
  message?: string;
}

// ===== 员工转化分析API类型 =====

export interface PostEmployeeConversionAnalysisBody {
  platforms?: string[];
  start_date: string;
  end_date: string;
  employees?: string[];
  lead_type?: 'all' | 'existing' | 'new';
}

export interface EmployeeConversionCoreMetrics {
  total_leads: number;
  total_mouth: number;
  total_valid_lead: number;
  total_opened: number;
  total_valid_customer: number;
  avg_opening_rate: number;
  total_assets: number;
}

export interface EmployeeConversionPlatformOverview {
  platform: string;
  leads: number;
  opened: number;
  rate: number;
}

export interface EmployeeConversionTrendData {
  weeks: string[];
  dateRanges: string[];
  lead_users: number[];
  customer_mouth_users: number[];
  valid_lead_users: number[];
  opened_account_users: number[];
}

export interface EmployeeRateTrendItem {
  week: string;
  dateRange: string;
  employee_name: string;
  opening_rate: number;
}

export interface EmployeeConversionRankingItem {
  rank: number;
  employee_name: string;
  total_leads: number;
  mouth_count: number;
  valid_lead_count: number;
  opened_count: number;
  valid_customer_count: number;
  opening_rate: number;
  valid_customer_rate: number;
  total_assets: number;
}

export interface EmployeeConversionAnalysisData {
  core_metrics: EmployeeConversionCoreMetrics;
  platform_overview: EmployeeConversionPlatformOverview[];
  conversion_trend: EmployeeConversionTrendData;
  employee_rate_trend: EmployeeRateTrendItem[];
  ranking: EmployeeConversionRankingItem[];
}

export interface EmployeeConversionAnalysisResponse {
  success: boolean;
  data: EmployeeConversionAnalysisData;
  message?: string;
}

export interface EmployeeConversionFilterOptionsResponse {
  success: boolean;
  data: {
    platforms: string[];
    employees: string[];
    lead_types: Array<{ value: string; label: string }>;
  };
}

// ===== 数据导入API类型 =====

export type DataType =
  | 'tencent_ads'
  | 'douyin_ads'
  | 'xiaohongshu_ads'
  | 'xhs_notes_list'
  | 'xhs_notes_daily'
  | 'xhs_notes_content'
  | 'conversion';

export interface UploadResponseData {
  total_rows: number;
  success_count: number;
  failed_count: number;
  failed_rows: number[];
  errors: string[];
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: UploadResponseData;
}

export interface DataTypeInfo {
  type: DataType;
  label: string;
  description: string;
  requiredFields: string[];
}

export const DATA_TYPES: DataTypeInfo[] = [
  {
    type: 'tencent_ads',
    label: '腾讯广告数据',
    description: '腾讯广告平台投放数据',
    requiredFields: ['日期', '账户ID', '花费', '曝光量', '点击量'],
  },
  {
    type: 'douyin_ads',
    label: '抖音广告数据',
    description: '抖音广告平台投放数据',
    requiredFields: ['日期', '账户ID', '消耗', '展示数', '点击数'],
  },
  {
    type: 'xiaohongshu_ads',
    label: '小红书广告数据',
    description: '小红书广告平台投放数据',
    requiredFields: ['周期', '广告主账户ID', '总消耗', '总展现', '总点击'],
  },
  {
    type: 'xhs_notes_list',
    label: '小红书笔记列表',
    description: '小红书笔记基础信息',
    requiredFields: ['笔记ID', '笔记标题'],
  },
  {
    type: 'xhs_notes_daily',
    label: '小红书笔记投放数据',
    description: '小红书笔记日级投放数据',
    requiredFields: ['日期', '笔记ID', '消耗'],
  },
  {
    type: 'xhs_notes_content',
    label: '小红书笔记运营数据',
    description: '小红书笔记日级运营数据',
    requiredFields: ['数据日期', '笔记ID'],
  },
  {
    type: 'conversion',
    label: '后端转化数据',
    description: '客户转化明细数据',
    requiredFields: ['线索日期'],
  },
];


// ===== 报告生成API类型 =====

/**
 * 报告配置
 */
export interface ReportConfig {
  title: string;
  format: 'pdf' | 'excel' | 'html';
  includeSummary: boolean;
  includeTrends: boolean;
  includeComparison: boolean;
  includeCharts: boolean;
}

/**
 * 报告数据
 */
export interface ReportData {
  summary: SummaryResponse | null;
  trend: TrendResponse | null;
  comparison: ConversionFunnelResponse | null;
  funnel: ConversionFunnelResponse | null;
  external: ExternalDataAnalysisResponse | null;
}

/**
 * 汇总数据响应
 */
export interface SummaryResponse {
  success: boolean;
  data: Array<{
    platform: string;
    metrics: {
      cost: number;
      impressions: number;
      clicks: number;
      leads: number;
      new_accounts: number;
    };
  }>;
}

/**
 * 趋势数据响应
 */
export interface TrendResponse {
  dates: string[];
  series: Array<{
    name: string;
    metric?: string;
    data: number[];
  }>;
}

/**
 * 转化漏斗响应 (报告用)
 */
export interface ConversionFunnelResponse {
  platform_funnel: Array<{
    platform: string;
    impressions: number;
    clicks: number;
    leads: number;
    new_accounts: number;
    rates: {
      overall_conversion_rate: number;
    };
  }>;
}

/**
 * 外部数据分析响应
 */
export interface ExternalDataAnalysisResponse {
  roi_analysis?: {
    roi: number;
    total_investment: number;
    total_returns: number;
    metrics: {
      cost_per_account: number;
    };
  };
  agency_ranking?: Array<{
    agency: string;
    score: number;
    metrics: {
      new_accounts: number;
      cost_per_account: number;
    };
  }>;
}

// ===== 小红书运营分析API类型 =====

export interface XhsOperationFilters {
  date_range?: [string, string];
  top_notes_date_range?: [string, string];
  creator_annual_date_range?: [string, string];
}

export interface PostXhsOperationAnalysisBody {
  filters?: XhsOperationFilters;
}

export interface XhsCoreMetrics {
  new_notes_count: number;
  ad_notes_count: number;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_interactions: number;
  total_private_messages: number;
  total_lead_users: number;
  total_opened_accounts: number;
  impression_click_rate: number;
  click_lead_rate: number;
  lead_to_wechat_rate: number;
  wechat_to_account_rate: number;
  cost_per_mille: number;
  cost_per_click: number;
  cost_per_lead_user: number;
  cost_per_opened_account: number;
}

export interface XhsCreatorContentItem {
  producer: string;
  note_count: number;
  total_impressions: number;
  total_clicks: number;
  total_interactions: number;
  total_cost: number;
  avg_click_rate: number;
  avg_interaction_rate: number;
}

export interface XhsCreatorConversionItem {
  producer: string;
  private_messages: number;
  lead_users: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

export interface XhsCreationTrend {
  dates: string[];
  note_counts: number[];
  impression_series: number[];
  interaction_series: number[];
  cost_series: number[];
}

export interface XhsTopNoteItem {
  note_id: string;
  note_title: string;
  note_publish_time: string;
  note_url: string;
  producer: string;
  ad_strategy: string;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_private_messages: number;
  lead_users: number;
  opened_account_users: number;
}

export interface XhsCreatorAnnualRankingItem {
  producer: string;
  note_count: number;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_private_messages: number;
  lead_users: number;
  opened_account_users: number;
}

export interface XhsAgencyDataItem {
  agency: string;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  lead_users: number;
  potential_customers: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

export interface XhsConversionTrend {
  weeks: string[];
  dateRanges: string[];
  lead_users: number[];
  customer_mouth_users: number[];
  valid_lead_users: number[];
  opened_account_users: number[];
}

export interface XhsWeeklyConversionItem {
  week: string;
  date_range: string;
  lead_users: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
}

export interface XhsNoteConversionItem {
  note_id: string;
  note_title: string;
  note_publish_time: string;
  note_url: string;
  producer: string;
  ad_strategy: string;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_private_messages: number;
  lead_users: number;
  opened_account_users: number;
}

export interface XhsCreatorCreationItem {
  producer: string;
  note_count: number;
  impressions: number;
}

export interface XhsCreatorInteractionItem {
  producer: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  total_interactions: number;
}

export interface XhsEmployeeConversionItem {
  employee_name: string;
  lead_users: number;
  wechat_adds: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
  opening_rate: number;
  valid_customer_rate: number;
  total_assets: number;
}

export interface XhsEmployeeWeeklyConversion {
  weeks: string[];
  employees: string[];
  series: number[][];
}

export interface XhsOperationAnalysisData {
  core_metrics: XhsCoreMetrics;
  creator_content_data: XhsCreatorContentItem[];
  creator_conversion_data: XhsCreatorConversionItem[];
  creation_trend: XhsCreationTrend;
  top_notes: XhsTopNoteItem[];
  creator_annual_ranking: XhsCreatorAnnualRankingItem[];
  agency_data: XhsAgencyDataItem[];
  conversion_trend: XhsConversionTrend;
  note_conversion_ranking: XhsNoteConversionItem[];
  creator_creation_data: XhsCreatorCreationItem[];
  creator_interaction_data: XhsCreatorInteractionItem[];
  employee_conversion_ranking: XhsEmployeeConversionItem[];
  employee_weekly_conversion: XhsEmployeeWeeklyConversion;
}

export interface XhsOperationAnalysisResponse {
  success: boolean;
  data: XhsOperationAnalysisData;
  message?: string;
}

