/**
 * useTrendData Hook
 * 获取数据概览趋势数据的自定义 Hook（已收编 useReportData 统一取数范式）
 */
import { useCallback, useMemo } from 'react';
import { postDashboardTrendData } from '@/types/api';
import type {
  PostDashboardTrendDataBody,
  DashboardTrendDataResponseAllOfData,
} from '@/types/api.schemas';
import type { DashboardTrendData } from '@/types';
import { transformDashboardTrendData } from '@/types';
import { useReportData } from '@/hooks/useReportData';

export interface UseTrendDataResult {
  /** 趋势数据（适配前端图表格式） */
  trendData: DashboardTrendData | null;
  /** 原始趋势数据响应 */
  rawTrendData: DashboardTrendDataResponseAllOfData | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 获取数据方法 */
  fetchTrendData: (params: PostDashboardTrendDataBody) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 获取数据概览趋势数据的自定义 Hook
 *
 * @example
 * ```tsx
 * const { trendData, loading, fetchTrendData } = useTrendData();
 *
 * // 获取线索成本趋势
 * fetchTrendData({
 *   start_date: '2025-01-01',
 *   end_date: '2025-01-31',
 *   metric_type: 'cost_per_lead',
 * });
 *
 * // 在图表中使用
 * <LineChart data={trendData?.trend_data} />
 * ```
 */
export const useTrendData = (): UseTrendDataResult => {
  const fetcher = useCallback(
    async (params: PostDashboardTrendDataBody): Promise<DashboardTrendDataResponseAllOfData> => {
      const response = await postDashboardTrendData(params);
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取趋势数据失败');
      }
      // HTTP client extracts data.data, so response.data is DashboardTrendDataResponseAllOfData
      return response.data as DashboardTrendDataResponseAllOfData;
    },
    []
  );

  const { data: rawTrendData, loading, error, load, reset } = useReportData<
    DashboardTrendDataResponseAllOfData,
    PostDashboardTrendDataBody
  >(fetcher, { errorMessage: '获取趋势数据失败' });

  // 转换后的趋势数据（适配前端图表格式）；useMemo 避免无关渲染时重复 transform
  const trendData = useMemo(
    () => (rawTrendData ? transformDashboardTrendData(rawTrendData) : null),
    [rawTrendData]
  );

  const fetchTrendData = useCallback(
    async (params: PostDashboardTrendDataBody): Promise<void> => {
      await load(params);
    },
    [load]
  );

  return {
    trendData,
    rawTrendData,
    loading,
    error,
    fetchTrendData,
    reset,
  };
};

export default useTrendData;
