/**
 * 分支KOS投顾名单（v3.8.0）
 *
 * 口径：fact_conv_content.笔记ID 关联 agg_xhs_note.创作者，
 * 创作者 属于分支KOS投顾名单（含「轮岗（赵茜）」等带前缀写法）。
 * 与后端 backend/routes/data/xhs_kos_weekly.py::KOS_ROSTER 保持一致。
 */
export const KOS_ROSTER = [
  '何慧敏',
  '刘贝',
  '张永强',
  '张靖月',
  '李荣志',
  '汤凯',
  '盛睿雪',
  '陈小芳',
  '黄天平',
  '赵茜',
] as const;

export interface KosRankingItem {
  kos_name: string;
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

export interface KosPlatformRankings {
  total: KosRankingItem[];
  existing: KosRankingItem[];
  new: KosRankingItem[];
  existing_new_open?: KosRankingItem[];
}

export interface KosYearBreakdownItem {
  label: string;
  total_leads: number;
  opened_count: number;
  valid_customer_count: number;
  total_assets: number;
  opening_rate: number;
  valid_customer_rate: number;
}

export interface KosWeeklyData {
  platform: string;
  roster_count?: number;
  roster?: string[];
  overview: Record<string, {
    total_leads?: number;
    leads?: number;
    opened_count?: number;
    opened?: number;
    opening_rate?: number;
    rate?: number;
    mouth_count?: number;
    valid_lead_count?: number;
    valid_customer_count?: number;
    total_assets?: number;
  }>;
  rankings: Record<string, KosPlatformRankings>;
  year_breakdown?: Record<string, { y2025: KosYearBreakdownItem; y2026: KosYearBreakdownItem }>;
  trend?: unknown[];
}

/** 补齐固定名单：后端已按名单补齐 0，这里再兜底一次（防止接口缺人） */
export function withKosRoster(data: KosRankingItem[]): KosRankingItem[] {
  const rosterSet = new Set<string>(KOS_ROSTER);
  const ranked = data.filter((item) => rosterSet.has(item.kos_name));
  const rankedNames = new Set(ranked.map((item) => item.kos_name));
  const missing = KOS_ROSTER
    .filter((name) => !rankedNames.has(name))
    .map((kosName): KosRankingItem => ({
      kos_name: kosName,
      total_leads: 0,
      mouth_count: 0,
      valid_lead_count: 0,
      opened_count: 0,
      valid_customer_count: 0,
      total_assets: 0,
      opening_rate: 0,
      valid_customer_rate: 0,
    }));
  return [...ranked, ...missing];
}
