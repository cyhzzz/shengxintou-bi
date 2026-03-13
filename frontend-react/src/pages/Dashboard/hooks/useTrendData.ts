/**
 * useTrendData Hook
 * 获取数据概览趋势数据的自定义 Hook
 * 使用自动生成的 API 函数
 */
import { useState, useCallback } from 'react';
import { message } from 'antd';
import { postDashboardTrendData } from '@/types/api';
import type {
  PostDashboardTrendDataBody,
  DashboardTrendDataResponseAllOfData,
} from '@/types/api.schemas';
import type { DashboardTrendData } from '@/types';
import { transformDashboardTrendData } from '@/types';

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
  const [rawTrendData, setRawTrendData] = useState<DashboardTrendDataResponseAllOfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 转换后的趋势数据（适配前端图表格式）
  const trendData = rawTrendData ? transformDashboardTrendData(rawTrendData) : null;

  const fetchTrendData = useCallback(async (params: PostDashboardTrendDataBody) => {
    setLoading(true);
    setError(null);

    try {
      const response = await postDashboardTrendData(params);

      if (response.success && response.data) {
        // HTTP client extracts data.data, so response.data is DashboardTrendDataResponseAllOfData
        const responseData = response.data as DashboardTrendDataResponseAllOfData;
        setRawTrendData(responseData);
      } else {
        const errorMsg = response.error || '获取趋势数据失败';
        setError(errorMsg);
        message.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取趋势数据失败';
      setError(errorMsg);
      message.error(errorMsg);
      console.error('[useTrendData] 获取趋势数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRawTrendData(null);
    setLoading(false);
    setError(null);
  }, []);

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