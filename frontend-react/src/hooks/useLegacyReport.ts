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

    // 等待旧版类加载的函数
    const waitForLegacyClass = (className: string, maxWait: number = 10000): Promise<any> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkInterval = 100;

        const check = () => {
          const LegacyClass = (window as any)[className];
          if (LegacyClass) {
            resolve(LegacyClass);
            return;
          }

          if (Date.now() - startTime > maxWait) {
            reject(new Error(`Legacy class "${className}" not found after ${maxWait}ms`));
            return;
          }

          setTimeout(check, checkInterval);
        };

        check();
      });
    };

    // 初始化旧版报表
    const initLegacyReport = async () => {
      try {
        // 等待旧版类加载
        const LegacyClass = await waitForLegacyClass(className);

        // 为旧版类创建必要的容器（如果不存在）
        // 旧版 AgencyAnalysisReport 需要 #mainContent 来渲染筛选器
        // 但在混合迁移模式下，我们使用 React 筛选器，所以创建一个隐藏容器
        let tempMainContent = document.getElementById('mainContent');
        if (!tempMainContent) {
          tempMainContent = document.createElement('div');
          tempMainContent.id = 'mainContent';
          tempMainContent.style.display = 'none'; // 隐藏旧版筛选器
          document.body.appendChild(tempMainContent);
          console.log('[useLegacyReport] 创建隐藏的 #mainContent 容器');
        }

        // 延迟初始化，确保 DOM 已渲染
        setTimeout(() => {
          try {
            // 混合迁移模式：跳过筛选器，使用外部容器渲染图表和表格
            const instance = new LegacyClass({ hybridMode: true });
            setReport(instance);
            console.log(`[useLegacyReport] 成功初始化: ${className} (混合模式)`);
          } catch (err) {
            console.error(`[useLegacyReport] 实例化失败:`, err);
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        }, 100);
      } catch (err) {
        console.warn(`[useLegacyReport] ${err}`);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    initLegacyReport();

    // 清理函数
    return () => {
      setReport((currentReport) => {
        if (currentReport && typeof currentReport.destroy === 'function') {
          console.log(`[useLegacyReport] 销毁实例: ${className}`);
          currentReport.destroy();
        }
        return null;
      });
      isInitialized.current = false;

      // 清理隐藏容器
      const hiddenContainer = document.getElementById('mainContent');
      if (hiddenContainer && hiddenContainer.style.display === 'none') {
        hiddenContainer.remove();
        console.log('[useLegacyReport] 清理隐藏容器');
      }
    };
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