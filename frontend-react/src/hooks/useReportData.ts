/**
 * 报表页统一取数 hook（Dashboard useCoreMetrics 范式的泛型化推广）
 *
 * 页面只提供 fetcher（怎么取数、怎么转数据），本 hook 统一封装：
 * - data / loading / error 三态
 * - 失败统一 message.error 提示（fetcher throw Error 即触发）
 * - load(args) 支持参数覆盖，避免 setState 后闭包读到旧值
 */
import { useCallback, useState } from 'react';
import { message } from 'antd';

export interface UseReportDataOptions {
  /** 请求异常且 fetcher 未抛出带 message 的 Error 时的兜底提示文案 */
  errorMessage?: string;
}

export interface UseReportDataResult<T, TArgs> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** load 返回本次取到的数据；失败返回 null（页面可据此做成功提示等后续动作） */
  load: (args: TArgs) => Promise<T | null>;
  reset: () => void;
}

export function useReportData<T, TArgs = void>(
  fetcher: (args: TArgs) => Promise<T>,
  options: UseReportDataOptions = {}
): UseReportDataResult<T, TArgs> {
  const { errorMessage = '加载失败，请稍后重试' } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (args: TArgs): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(args);
      setData(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : errorMessage;
      setError(msg);
      message.error(msg);
      console.error('[useReportData] fetch failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetcher, errorMessage]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, load, reset };
}

export default useReportData;
