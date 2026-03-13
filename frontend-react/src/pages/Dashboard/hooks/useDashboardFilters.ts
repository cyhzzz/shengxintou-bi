/**
 * useDashboardFilters Hook
 * 管理数据概览筛选条件的自定义 Hook
 */
import { useState, useCallback, useMemo } from 'react';

export interface DashboardFilters {
  /** 开始日期 (YYYY-MM-DD) */
  start_date: string;
  /** 结束日期 (YYYY-MM-DD) */
  end_date: string;
  /** 平台筛选 */
  platforms: string[];
  /** 代理商筛选 */
  agencies: string[];
  /** 业务模式筛选 */
  business_models: string[];
}

export interface UseDashboardFiltersResult {
  /** 当前筛选条件 */
  filters: DashboardFilters;
  /** 更新筛选条件 */
  updateFilters: (newFilters: Partial<DashboardFilters>) => void;
  /** 重置筛选条件 */
  resetFilters: () => void;
  /** 设置日期范围 */
  setDateRange: (start: string, end: string) => void;
  /** 设置平台筛选 */
  setPlatforms: (platforms: string[]) => void;
  /** 设置代理商筛选 */
  setAgencies: (agencies: string[]) => void;
  /** 设置业务模式筛选 */
  setBusinessModels: (businessModels: string[]) => void;
  /** 获取默认日期范围（近30天） */
  getDefaultDateRange: () => { start_date: string; end_date: string };
  /** 是否有激活的筛选条件 */
  hasActiveFilters: boolean;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 获取默认日期范围（近30天）
 */
const getDefaultDateRange = (): { start_date: string; end_date: string } => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30 + 1);

  return {
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
  };
};

/**
 * 管理数据概览筛选条件的自定义 Hook
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   updateFilters,
 *   resetFilters,
 *   hasActiveFilters,
 * } = useDashboardFilters();
 *
 * // 更新筛选条件
 * updateFilters({ platforms: ['腾讯'] });
 *
 * // 重置筛选条件
 * resetFilters();
 * ```
 */
export const useDashboardFilters = (): UseDashboardFiltersResult => {
  const defaultRange = getDefaultDateRange();

  const [filters, setFilters] = useState<DashboardFilters>({
    start_date: defaultRange.start_date,
    end_date: defaultRange.end_date,
    platforms: [],
    agencies: [],
    business_models: [],
  });

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    const defaultRange = getDefaultDateRange();
    setFilters({
      start_date: defaultRange.start_date,
      end_date: defaultRange.end_date,
      platforms: [],
      agencies: [],
      business_models: [],
    });
  }, []);

  const setDateRange = useCallback((start: string, end: string) => {
    setFilters((prev) => ({
      ...prev,
      start_date: start,
      end_date: end,
    }));
  }, []);

  const setPlatforms = useCallback((platforms: string[]) => {
    setFilters((prev) => ({
      ...prev,
      platforms,
    }));
  }, []);

  const setAgencies = useCallback((agencies: string[]) => {
    setFilters((prev) => ({
      ...prev,
      agencies,
    }));
  }, []);

  const setBusinessModels = useCallback((business_models: string[]) => {
    setFilters((prev) => ({
      ...prev,
      business_models,
    }));
  }, []);

  // 检查是否有激活的筛选条件
  const hasActiveFilters = useMemo(() => {
    return (
      filters.platforms.length > 0 ||
      filters.agencies.length > 0 ||
      filters.business_models.length > 0
    );
  }, [filters.platforms, filters.agencies, filters.business_models]);

  return {
    filters,
    updateFilters,
    resetFilters,
    setDateRange,
    setPlatforms,
    setAgencies,
    setBusinessModels,
    getDefaultDateRange,
    hasActiveFilters,
  };
};

export default useDashboardFilters;