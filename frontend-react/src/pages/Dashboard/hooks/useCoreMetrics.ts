/**
 * useCoreMetrics Hook
 * 获取数据概览核心指标的自定义 Hook
 * 使用自动生成的 API 函数
 */
import { useState, useCallback } from 'react';
import { message } from 'antd';
import { postDashboardCoreMetrics } from '@/types/api';
import type {
  CoreMetrics,
  WowChange,
  PostDashboardCoreMetricsBody,
  CoreMetricsResponseAllOfData,
} from '@/types/api.schemas';

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
  const [coreMetrics, setCoreMetrics] = useState<CoreMetrics | null>(null);
  const [wowChanges, setWowChanges] = useState<WowChange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoreMetrics = useCallback(async (params: PostDashboardCoreMetricsBody) => {
    setLoading(true);
    setError(null);

    try {
      const response = await postDashboardCoreMetrics(params);

      if (response.success && response.data) {
        // HTTP client extracts data.data, so response.data is CoreMetricsResponseAllOfData
        const responseData = response.data as CoreMetricsResponseAllOfData;
        setCoreMetrics(responseData.core_metrics || null);
        setWowChanges(responseData.wow_changes || null);
      } else {
        const errorMsg = response.error || '获取核心指标失败';
        setError(errorMsg);
        message.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取核心指标失败';
      setError(errorMsg);
      message.error(errorMsg);
      console.error('[useCoreMetrics] 获取核心指标失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCoreMetrics(null);
    setWowChanges(null);
    setLoading(false);
    setError(null);
  }, []);

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