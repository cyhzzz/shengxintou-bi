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

// 转化漏斗数据
export interface ConversionFunnelData {
  stages: FunnelStage[];
  comparison?: FunnelStage[];
}

export interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
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