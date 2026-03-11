// 日级指标聚合
export interface DailyMetrics {
  date: string;
  platform: string;
  agency: string;
  business_model: string;
  cost: number;
  impressions: number;
  click_users: number;
  lead_users: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

// 环比变化数据
export interface WowChange {
  value: number;
  trend: 'up' | 'down';
  color: 'green' | 'red';
}

// 核心指标数据
export interface CoreMetrics {
  new_customers: number;           // 新开客户数 (total_opened)
  investment: number;              // 总投入 (total_cost)
  new_valid_accounts: number;      // 新有效户数 (total_valid)
  total_leads: number;             // 总线索数
  total_impressions: number;       // 总曝光数
  total_clicks: number;            // 总点击数
  customer_assets: number;         // 客户资产
  customer_contribution: number;   // 客户贡献
  existing_customers_assets: number; // 存量客户资产
  cost_per_valid_account: number;  // 有效户成本
  cost_per_lead: number;           // 线索成本
}

// 环比变化数据集合
export interface WowChanges {
  new_customers: WowChange;
  investment: WowChange;
  new_valid_accounts: WowChange;
  total_leads: WowChange;
  total_impressions: WowChange;
  total_clicks: WowChange;
  customer_assets: WowChange;
  customer_contribution: WowChange;
  existing_customers_assets: WowChange;
  cost_per_valid_account: WowChange;
  cost_per_lead: WowChange;
}

// 数据概览核心指标响应
export interface DashboardCoreMetricsData {
  core_metrics: CoreMetrics;
  wow_changes: WowChanges;
}

// 趋势数据响应
export interface DashboardTrendData {
  trend_data: Array<{
    date: string;
    value: number;
  }>;
  summary: {
    cost_per_lead: number;
    cost_per_customer: number;
    cost_per_valid_account: number;
  };
}

// 转化漏斗数据
export interface ConversionFunnelData {
  funnel: FunnelStage[];
  core_metrics: CoreMetricsData;
  is_employee_mode: boolean;
}

export interface FunnelStage {
  step: string;
  value: number;
  rate: number;
}

export interface CoreMetricsData {
  cost: number;
  impressions: number;
  click_users: number;
  lead_users: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

// 后端转化明细
export interface BackendConversion {
  id: number;
  lead_date: string;
  platform_source: string;
  wechat_nickname: string | null;
  capital_account: string | null;
  agency: string | null;
  ad_account: string | null;
  note_id: string | null;
  is_customer_mouth: boolean;
  is_valid_lead: boolean;
  is_opened_account: boolean;
  is_valid_customer: boolean;
  assets: number | null;
}

// 小红书笔记数据
export interface XhsNote {
  note_id: string;
  note_title: string;
  creator_name: string;
  date: string;
  cost: number;
  impressions: number;
  clicks: number;
  lead_users: number;
  opened_account_users: number;
}

// 员工转化数据
export interface EmployeeConversion {
  employee_no: string;
  employee_name: string;
  total_leads: number;
  valid_leads: number;
  opened_accounts: number;
  valid_customers: number;
  assets: number;
}