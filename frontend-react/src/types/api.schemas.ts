/**
 * /**
 *  * API 类型定义 - 自动生成
 *  * 生成时间: 2026-03-17T02:47:31.528Z
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

/**
 * 趋势数据系列项（每个日期的详细数据）
 */
export type TrendResponseAllOfDataSeriesItem = {
  date?: string;
  platform?: string;
  business_model?: string;
  agency?: string;
  metrics?: {
    cost?: number;
    impressions?: number;
    clicks?: number;
    lead_users?: number;
    opened_account_users?: number;
    valid_customer_users?: number;
  };
};

// TrendResponse 直接包含 dates 和 series（与后端返回一致）
export type TrendResponse = {
  dates?: string[];
  series?: TrendResponseAllOfDataSeriesItem[];
};

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
  // 基本字段
  note_id?: string;
  note_name?: string;
  note_title?: string;
  note_url?: string;
  note_type?: string;
  content_type?: string;
  // 创作者信息
  producer?: string;
  creator_name?: string;
  // 账号和发布信息
  publish_account?: string;
  publish_time?: string;
  // 广告策略
  ad_strategy?: string;
  is_ad?: boolean;
  // 总量指标（投放+自然）
  exposure?: number;
  impressions?: number;
  reads?: number;
  clicks?: number;
  interactions?: number;
  click_rate?: number;
  // 成本指标
  ad_spend?: number;
  cost?: number;
  // 互动指标
  likes?: number;
  comments?: number;
  favorites?: number;
  shares?: number;
  // 私信指标
  private_messages?: number;
  // 转化指标
  lead_users?: number;
  customer_mouth_users?: number;
  valid_lead_users?: number;
  opened_account_users?: number;
  valid_customer_users?: number;
  customer_assets_users?: number;
  customer_assets_amount?: number;
  // 推广数据（投放）
  ad_impressions?: number;
  ad_clicks?: number;
  ad_interactions?: number;
  ad_click_rate?: number;
  // 自然数据
  organic_impressions?: number;
  organic_clicks?: number;
  organic_interactions?: number;
  // 计算成本
  add_wechat_cost?: number;
  open_account_cost?: number;
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

// ============================================
// Employee Conversion - 员工转化分析
// ============================================

/**
 * 员工转化排行榜项
 */
export interface EmployeeConversionRankingItem {
  /** 排名 */
  rank: number;
  /** 员工姓名 */
  employee_name: string;
  /** 总线索数 */
  total_leads: number;
  /** 开口数 */
  mouth_count: number;
  /** 有效线索数 */
  valid_lead_count: number;
  /** 开户数 */
  opened_count: number;
  /** 有效户数 */
  valid_customer_count: number;
  /** 开户率 */
  opening_rate: number;
  /** 有效户率 */
  valid_customer_rate: number;
  /** 总资产 */
  total_assets: number;
}

/**
 * 员工转化分析核心指标
 */
export interface EmployeeConversionCoreMetrics {
  total_leads: number;
  total_mouth: number;
  total_valid_lead: number;
  total_opened: number;
  total_valid_customer: number;
  avg_opening_rate: number;
  total_assets: number;
}

/**
 * 转化趋势数据
 */
export interface EmployeeConversionTrend {
  weeks: string[];
  dateRanges?: string[];
  lead_users: number[];
  customer_mouth_users: number[];
  valid_lead_users: number[];
  opened_account_users: number[];
}

/**
 * 员工转化率走势数据（与小红书报表格式一致）
 */
export interface EmployeeConversionRateTrend {
  weeks: string[];
  employees: string[];
  series: number[][]; // 每个员工的周度转化率数据
}

/**
 * 平台概览项
 */
export interface EmployeeConversionPlatformItem {
  platform: string;
  total_leads: number;
  mouth_count: number;
  valid_lead_count: number;
  opened_count: number;
  valid_customer_count: number;
  opening_rate: number;
}

/**
 * 员工转化分析数据
 */
export interface EmployeeConversionAnalysisData {
  core_metrics: EmployeeConversionCoreMetrics;
  platform_overview: EmployeeConversionPlatformItem[];
  conversion_trend: EmployeeConversionTrend;
  employee_rate_trend: EmployeeConversionRateTrend;
  ranking: EmployeeConversionRankingItem[];
}

/**
 * 员工转化分析响应
 */
export interface EmployeeConversionAnalysisResponse extends SuccessResponse {
  data?: EmployeeConversionAnalysisData;
}

/**
 * 员工转化筛选选项响应
 */
export interface EmployeeConversionFilterOptionsResponse extends SuccessResponse {
  data?: {
    platforms: string[];
    employees: string[];
    lead_types: Array<{ value: string; label: string }>;
  };
}

/**
 * 员工转化周报数据
 */
export interface EmployeeConversionWeeklyData {
  period: {
    start_date: string;
    end_date: string;
  };
  overview: EmployeeConversionCoreMetrics;
  rankings: {
    opening_rate: EmployeeConversionRankingItem[];
    valid_customer_rate: EmployeeConversionRankingItem[];
    assets: EmployeeConversionRankingItem[];
  };
  stars?: {
    opening_rate_star?: EmployeeConversionRankingItem;
    valid_customer_rate_star?: EmployeeConversionRankingItem;
    assets_star?: EmployeeConversionRankingItem;
  };
}

/**
 * 员工转化周报响应
 */
export interface EmployeeConversionWeeklyResponse extends SuccessResponse {
  data?: EmployeeConversionWeeklyData;
}

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
/**
 * 平台列表（逗号分隔）
 */
platforms?: string;
/**
 * 服务员工姓名
 */
employee_name?: string;
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

// ============================================
// XHS Operation Analysis - 小红书运营分析
// ============================================

/**
 * 创作者内容数据项
 */
export interface XhsCreatorContentItem {
  /** 制作人 */
  producer?: string;
  /** 笔记数量 */
  note_count?: number;
  /** 总曝光数 */
  total_impressions?: number;
  /** 总点击数 */
  total_clicks?: number;
  /** 总互动数 */
  total_interactions?: number;
  /** 总花费 */
  total_cost?: number;
  /** 平均点击率 */
  avg_click_rate?: number;
  /** 平均互动率 */
  avg_interaction_rate?: number;
}

/**
 * 创作者转化数据项
 */
export interface XhsCreatorConversionItem {
  /** 制作人 */
  producer?: string;
  /** 私信数 */
  private_messages?: number;
  /** 线索用户数 */
  lead_users?: number;
  /** 开口用户数 */
  customer_mouth_users?: number;
  /** 有效线索用户数 */
  valid_lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
  /** 有效户用户数 */
  valid_customer_users?: number;
}

/**
 * 热门笔记项
 */
export interface XhsTopNoteItem {
  /** 笔记ID */
  note_id?: string;
  /** 笔记标题 */
  note_title?: string;
  /** 发布时间 */
  note_publish_time?: string;
  /** 笔记链接 */
  note_url?: string;
  /** 制作人 */
  producer?: string;
  /** 推广策略 */
  ad_strategy?: string;
  /** 总花费 */
  total_cost?: number;
  /** 总曝光数 */
  total_impressions?: number;
  /** 总点击数 */
  total_clicks?: number;
  /** 总私信数 */
  total_private_messages?: number;
  /** 线索用户数 */
  lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
}

/**
 * 创作者年度排行项
 */
export interface XhsCreatorAnnualRankingItem {
  /** 制作人 */
  producer?: string;
  /** 总花费 */
  total_cost?: number;
  /** 总曝光数 */
  total_impressions?: number;
  /** 总点击数 */
  total_clicks?: number;
  /** 总私信数 */
  total_private_messages?: number;
  /** 线索用户数 */
  lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
  /** 笔记数量 */
  note_count?: number;
}

/**
 * 代理商数据项
 */
export interface XhsAgencyDataItem {
  /** 代理商 */
  agency?: string;
  /** 总花费 */
  total_cost?: number;
  /** 总曝光数 */
  total_impressions?: number;
  /** 总点击数 */
  total_clicks?: number;
  /** 线索用户数 */
  lead_users?: number;
  /** 潜在客户数 */
  potential_customers?: number;
  /** 开口用户数 */
  customer_mouth_users?: number;
  /** 有效线索用户数 */
  valid_lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
  /** 有效户用户数 */
  valid_customer_users?: number;
}

/**
 * 笔记转化排行项
 */
export interface XhsNoteConversionItem {
  /** 笔记ID */
  note_id?: string;
  /** 笔记标题 */
  note_title?: string;
  /** 制作人 */
  producer?: string;
  /** 线索用户数 */
  lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
  /** 转化率 */
  conversion_rate?: number;
}

/**
 * 创作者创作数据项
 */
export interface XhsCreatorCreationItem {
  /** 制作人 */
  producer?: string;
  /** 笔记数量 */
  note_count?: number;
  /** 曝光数 */
  impressions?: number;
}

/**
 * 创作者互动数据项
 */
export interface XhsCreatorInteractionItem {
  /** 制作人 */
  producer?: string;
  /** 点赞数 */
  likes?: number;
  /** 收藏数 */
  favorites?: number;
  /** 评论数 */
  comments?: number;
  /** 分享数 */
  shares?: number;
  /** 总互动数 */
  total_interactions?: number;
}

/**
 * 员工转化排行项
 */
export interface XhsEmployeeConversionItem {
  /** 员工姓名 */
  employee_name?: string;
  /** 线索用户数 */
  lead_users?: number;
  /** 微信添加数 */
  wechat_adds?: number;
  /** 有效线索用户数 */
  valid_lead_users?: number;
  /** 开户用户数 */
  opened_account_users?: number;
  /** 有效户用户数 */
  valid_customer_users?: number;
  /** 开户率 */
  opening_rate?: number;
  /** 有效户率 */
  valid_customer_rate?: number;
  /** 总资产 */
  total_assets?: number;
}

/**
 * 小红书创作趋势数据
 */
export interface XhsCreationTrend {
  dates?: string[];
  note_counts?: number[];
  impression_series?: number[];
  interaction_series?: number[];
  cost_series?: number[];
}

/**
 * 小红书转化趋势数据
 */
export interface XhsConversionTrend {
  weeks?: string[];
  dateRanges?: string[];
  lead_users?: number[];
  customer_mouth_users?: number[];
  valid_lead_users?: number[];
  opened_account_users?: number[];
}

/**
 * 员工周转化率数据
 */
export interface XhsEmployeeWeeklyConversion {
  /** 周列表 */
  weeks: string[];
  /** 员工列表 */
  employees: string[];
  /** 转化率数据（二维数组，每个员工每周的转化率） */
  series: number[][];
}

/**
 * 小红书运营分析数据
 */
export interface XhsOperationAnalysisData {
  /** 核心指标 */
  core_metrics?: Record<string, unknown>;
  /** 创作者内容数据 */
  creator_content_data?: XhsCreatorContentItem[];
  /** 创作者转化数据 */
  creator_conversion_data?: XhsCreatorConversionItem[];
  /** 创作趋势 */
  creation_trend?: XhsCreationTrend;
  /** 热门笔记 */
  top_notes?: XhsTopNoteItem[];
  /** 创作者年度排行 */
  creator_annual_ranking?: XhsCreatorAnnualRankingItem[];
  /** 代理商数据 */
  agency_data?: XhsAgencyDataItem[];
  /** 转化趋势 */
  conversion_trend?: XhsConversionTrend;
  /** 笔记转化排行 */
  note_conversion_ranking?: XhsNoteConversionItem[];
  /** 创作者创作数据 */
  creator_creation_data?: XhsCreatorCreationItem[];
  /** 创作者互动数据 */
  creator_interaction_data?: XhsCreatorInteractionItem[];
  /** 员工转化排行 */
  employee_conversion_ranking?: XhsEmployeeConversionItem[];
  /** 员工周转化率趋势 */
  employee_weekly_conversion?: XhsEmployeeWeeklyConversion;
}

