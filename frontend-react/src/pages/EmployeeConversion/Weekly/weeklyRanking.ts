export const FIXED_ASSISTANTS = [
  '陈鸿',
  '荣杜娟',
  '贾芳',
  '赵梅',
  '袁孝春',
  '张杰明',
  '吴茂秋',
  '何泳萍',
  '李兆俊',
  '史菡漾',
  '朱橙青',
  '杨华',
] as const;

export interface WeeklyRankingItem {
  employee_name: string;
  platform?: string;
  total_leads: number;
  mouth_count?: number;
  valid_lead_count?: number;
  opened_count: number;
  valid_customer_count?: number;
  total_assets?: number;
  opening_rate: number;
  valid_customer_rate?: number;
}

export interface WeeklyPlatformRankings {
  total: WeeklyRankingItem[];
  existing: WeeklyRankingItem[];
  new: WeeklyRankingItem[];
  existing_new_open?: WeeklyRankingItem[];
}

export interface WeeklyOverviewItem {
  total_leads?: number;
  leads?: number;
  opened_count?: number;
  opened?: number;
  opening_rate?: number;
  rate?: number;
}

export interface WeeklyReportData {
  roster_count?: number;
  overview: Record<string, WeeklyOverviewItem>;
  rankings: Record<string, WeeklyPlatformRankings>;
  stars?: Record<string, { name?: string; rate?: number }>;
  trend?: unknown[];
}

export function withFixedAssistants(
  data: WeeklyRankingItem[],
  platform: string,
): WeeklyRankingItem[] {
  const assistantSet = new Set<string>(FIXED_ASSISTANTS);
  const rankedAssistants = data.filter((item) => assistantSet.has(item.employee_name));
  const rankedNames = new Set(rankedAssistants.map((item) => item.employee_name));
  const assistantsWithoutData = FIXED_ASSISTANTS
    .filter((name) => !rankedNames.has(name))
    .map((employeeName): WeeklyRankingItem => ({
      employee_name: employeeName,
      platform,
      total_leads: 0,
      mouth_count: 0,
      valid_lead_count: 0,
      opened_count: 0,
      valid_customer_count: 0,
      total_assets: 0,
      opening_rate: 0,
      valid_customer_rate: 0,
    }));

  return [...rankedAssistants, ...assistantsWithoutData];
}
