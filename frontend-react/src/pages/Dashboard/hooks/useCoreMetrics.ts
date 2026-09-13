/**
 * useCoreMetrics Hook
 * 获取数据概览核心指标的自定义 Hook（已收编 useReportData 统一取数范式）
 */
import { useCallback, useMemo } from 'react';
import { postDashboardCoreMetrics } from '@/types/api';
import type {
  CoreMetrics,
  WowChange,
  PostDashboardCoreMetricsBody,
  CoreMetricsResponseAllOfData,
} from '@/types/api.schemas';
import { useReportData } from '@/hooks/useReportData';

export interface UseCoreMetricsResult {
  /** 核心指标数据 */
  coreMetrics: CoreMetrics | null;
  /** 环比变化数据 */
  wowChanges: WowChange | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 获取数据方法 */
  fetchCoreMetrics: (params: PostDashboardCoreMetricsBody) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 获取数据概览核心指标的自定义 Hook
 *
 * @example
 * ```tsx
 * const { coreMetrics, wowChanges, loading, fetchCoreMetrics } = useCoreMetrics();
 *
 * // 获取数据
 * fetchCoreMetrics({
 *   start_date: '2025-01-01',
 *   end_date: '2025-01-31',
 *   platforms: ['腾讯'],
 * });
 * ```
 */
export const useCoreMetrics = (): UseCoreMetricsResult => {
  const fetcher = useCallback(
    async (params: PostDashboardCoreMetricsBody): Promise<CoreMetricsResponseAllOfData> => {
      const response = await postDashboardCoreMetrics(params);
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取核心指标失败');
      }
      // HTTP client extracts data.data, so response.data is CoreMetricsResponseAllOfData
      return response.data as CoreMetricsResponseAllOfData;
    },
    []
  );

  const { data, loading, error, load, reset } = useReportData<
    CoreMetricsResponseAllOfData,
    PostDashboardCoreMetricsBody
  >(fetcher, { errorMessage: '获取核心指标失败' });

  // 响应字段拆解为两个对外字段（派生自统一 data）
  const coreMetrics = useMemo(() => data?.core_metrics || null, [data]);
  const wowChanges = useMemo(() => data?.wow_changes || null, [data]);

  const fetchCoreMetrics = useCallback(
    async (params: PostDashboardCoreMetricsBody): Promise<void> => {
      await load(params);
    },
    [load]
  );

  return {
    coreMetrics,
    wowChanges,
    loading,
    error,
    fetchCoreMetrics,
    reset,
  };
};

export default useCoreMetrics;
