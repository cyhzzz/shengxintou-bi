/**
 * 旧版报表类动态加载器
 * 用于在React组件中动态加载和使用旧版JS报表类
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface LegacyReportInstance {
  init: () => Promise<void>;
  loadData: (filters: Record<string, any>) => Promise<void>;
  updateData: () => void;
  destroy: () => void;
  setContainer: (containerId: string) => void;
  [key: string]: any;
}

interface UseLegacyReportOptions {
  /** 报表JS文件路径 */
  scriptPath: string;
  /** 报表类名 */
  className: string;
  /** 容器ID */
  containerId: string;
  /** 初始化参数 */
  initParams?: Record<string, any>;
  /** 初始化完成回调 */
  onInitialized?: (instance: LegacyReportInstance) => void;
  /** 数据加载完成回调 */
  onDataLoaded?: (data: any) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

declare global {
  interface Window {
    DynamicLoader?: {
      loadReport: (reportId: string) => Promise<new () => LegacyReportInstance>;
    };
  }
}

/**
 * 动态加载旧版报表类
 */
export async function loadLegacyReport(
  scriptPath: string,
  className: string
): Promise<new () => LegacyReportInstance> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    const existingScript = document.querySelector(`script[data-report="${className}"]`);
    if (existingScript) {
      const constructor = (window as any)[className];
      if (constructor) {
        resolve(constructor);
        return;
      }
    }

    const script = document.createElement('script');
    script.src = scriptPath;
    script.dataset.report = className;
    script.async = true;

    script.onload = () => {
      const constructor = (window as any)[className];
      if (constructor) {
        resolve(constructor);
      } else {
        reject(new Error(`报表类 ${className} 未找到`));
      }
    };

    script.onerror = (error) => {
      reject(new Error(`加载报表 ${className} 失败: ${error}`));
    };

    document.head.appendChild(script);
  });
}

/**
 * 旧版报表Hook
 */
export function useLegacyReport(options: UseLegacyReportOptions) {
  const {
    scriptPath,
    className,
    containerId,
    initParams = {},
    onInitialized,
    onDataLoaded,
    onError,
  } = options;

  const [instance, setInstance] = useState<LegacyReportInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  const isMountedRef = useRef(true);

  // 初始化报表
  const initReport = useCallback(async () => {
    if (!containerId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 动态加载报表类
      const ReportClass = await loadLegacyReport(scriptPath, className);

      if (!isMountedRef.current) {
        return;
      }

      // 创建实例
      const reportInstance = new ReportClass() as LegacyReportInstance;

      if (!isMountedRef.current) {
        return;
      }

      // 设置容器
      reportInstance.setContainer(containerId);

      // 初始化
      await reportInstance.init();

      if (!isMountedRef.current) {
        reportInstance.destroy();
        return;
      }

      // 如果有初始参数，加载数据
      if (Object.keys(initParams).length > 0) {
        await reportInstance.loadData(initParams);
      }

      setInstance(reportInstance);
      setIsReady(true);
      onInitialized?.(reportInstance);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('初始化报表失败');
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [scriptPath, className, containerId, initParams, onInitialized, onError]);

  // 加载数据
  const loadData = useCallback(async (filters: Record<string, any>) => {
    if (!instance) {
      throw new Error('报表实例未初始化');
    }

    try {
      setLoading(true);
      await instance.loadData(filters);
      onDataLoaded?.(instance);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('加载数据失败');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [instance, onDataLoaded, onError]);

  // 更新数据（不重新请求，只更新UI）
  const updateData = useCallback(() => {
    if (!instance) {
      throw new Error('报表实例未初始化');
    }
    instance.updateData();
  }, [instance]);

  // 销毁实例
  const destroy = useCallback(() => {
    if (instance) {
      instance.destroy();
      setInstance(null);
      setIsReady(false);
    }
  }, [instance]);

  // 组件挂载时初始化
  useEffect(() => {
    isMountedRef.current = true;
    initReport();

    return () => {
      isMountedRef.current = false;
      destroy();
    };
  }, [initReport, destroy]);

  return {
    instance,
    loading,
    error,
    isReady,
    loadData,
    updateData,
    destroy,
  };
}

/**
 * 预加载旧版工具类
 */
const loadedScripts = new Set<string>();

export async function preloadLegacyUtils(): Promise<void> {
  const basePath = 'http://localhost:3001/js';

  const utils = [
    `${basePath}/utils/api.js`,
    `${basePath}/utils/chartHelper.js`,
    `${basePath}/utils/formatHelper.js`,
    `${basePath}/utils/dateHelper.js`,
  ];

  const loadPromises = utils
    .filter(path => !loadedScripts.has(path))
    .map(path => {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = path;
        script.async = true;
        script.onload = () => {
          loadedScripts.add(path);
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    });

  await Promise.all(loadPromises);
}

/**
 * 预加载旧版组件
 */
export async function preloadLegacyComponents(): Promise<void> {
  const basePath = 'http://localhost:3001/js';

  const components = [
    `${basePath}/components/FilterBar.js`,
    `${basePath}/components/DateRangeFilter.js`,
    `${basePath}/components/MultiSelectForm.js`,
    `${basePath}/components/ChartCard.js`,
    `${basePath}/components/MetricCard.js`,
    `${basePath}/components/DataTable.js`,
  ];

  const loadPromises = components
    .filter(path => !loadedScripts.has(path))
    .map(path => {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = path;
        script.async = true;
        script.onload = () => {
          loadedScripts.add(path);
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    });

  await Promise.all(loadPromises);
}