// 开发代码/frontend-react/src/hooks/useLegacyReport.ts
/**
 * 封装旧版报表类的 React Hook
 * 管理旧版类的生命周期、数据加载和清理
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface LegacyReportInstance {
  loadData: (filters?: any) => Promise<void>;
  updateData: () => void;
  destroy: () => void;
  exportTableToExcel?: () => void;
  [key: string]: any;
}

interface UseLegacyReportReturn {
  report: LegacyReportInstance | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (filters?: any) => Promise<void>;
  exportData: () => void;
}

/**
 * 封装旧版报表类的 Hook
 * @param className 旧版类名（挂载在 window 对象上）
 */
export function useLegacyReport(className: string): UseLegacyReportReturn {
  const [report, setReport] = useState<LegacyReportInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitialized = useRef(false);

  // 初始化旧版报表实例
  useEffect(() => {
    // 避免重复初始化
    if (isInitialized.current) return;
    isInitialized.current = true;

    const LegacyClass = (window as any)[className];

    if (!LegacyClass) {
      console.warn(`[useLegacyReport] 未找到旧版类: ${className}`);
      setError(new Error(`Legacy class "${className}" not found`));
      return;
    }

    try {
      // 延迟初始化，确保 DOM 已渲染
      const timer = setTimeout(() => {
        const instance = new LegacyClass();
        setReport(instance);
        console.log(`[useLegacyReport] 成功初始化: ${className}`);
      }, 100);

      // 清理函数
      return () => {
        clearTimeout(timer);
        setReport((currentReport) => {
          if (currentReport && typeof currentReport.destroy === 'function') {
            console.log(`[useLegacyReport] 销毁实例: ${className}`);
            currentReport.destroy();
          }
          return null;
        });
        isInitialized.current = false;
      };
    } catch (err) {
      console.error(`[useLegacyReport] 初始化失败:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [className]);

  // 刷新数据
  const refresh = useCallback(
    async (filters?: any) => {
      if (!report) {
        console.warn('[useLegacyReport] 报表实例未初始化，无法刷新');
        return;
      }

      setIsLoading(true);
      try {
        if (typeof report.loadData === 'function') {
          await report.loadData(filters);
        }
        if (typeof report.updateData === 'function') {
          report.updateData();
        }
      } catch (err) {
        console.error('[useLegacyReport] 刷新数据失败:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [report]
  );

  // 导出数据
  const exportData = useCallback(() => {
    if (report && typeof report.exportTableToExcel === 'function') {
      report.exportTableToExcel();
    }
  }, [report]);

  return {
    report,
    isLoading,
    error,
    refresh,
    exportData,
  };
}