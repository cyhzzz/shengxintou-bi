/**
 * useDashboardFilters Hook
 * 管理数据概览筛选条件的自定义 Hook
 * 桥接到全局 useFilterStore（持久化到 localStorage），确保跨页面导航后筛选条件不丢失。
 */
import { useCallback, useMemo } from 'react';
import { useFilterStore } from '@/stores';

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
  /** 获取默认日期范围（全部） */
  getDefaultDateRange: () => { start_date: string; end_date: string };
  /** 是否有激活的筛选条件 */
  hasActiveFilters: boolean;
}

/**
 * 获取默认日期范围（v3.1.10: 全局统一 2026-01-01 ~ 2026-12-31）
 */
const getDefaultDateRange = (): { start_date: string; end_date: string } => {
  return {
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  };
};

/**
 * 管理数据概览筛选条件的自定义 Hook
 *
 * 桥接到 useFilterStore，筛选条件持久化到 localStorage，
 * 跨页面导航后仍然保留，且与 FilterBar 组件共享同一状态源。
 */
export const useDashboardFilters = (): UseDashboardFiltersResult => {
  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
    setDateRange: storeSetDateRange,
    setPlatforms: storeSetPlatforms,
    setAgencies: storeSetAgencies,
    setBusinessModels: storeSetBusinessModels,
    resetAll,
  } = useFilterStore();

  // 从 store 派生 Dashboard 筛选条件（单一数据源，避免本地/全局状态漂移）
  const filters = useMemo<DashboardFilters>(() => ({
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    platforms: selectedPlatforms,
    agencies: selectedAgencies,
    business_models: selectedBusinessModels,
  }), [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    if (newFilters.start_date && newFilters.end_date) {
      storeSetDateRange({ startDate: newFilters.start_date, endDate: newFilters.end_date });
    }
    if (newFilters.platforms !== undefined) storeSetPlatforms(newFilters.platforms);
    if (newFilters.agencies !== undefined) storeSetAgencies(newFilters.agencies);
    if (newFilters.business_models !== undefined) storeSetBusinessModels(newFilters.business_models);
  }, [storeSetDateRange, storeSetPlatforms, storeSetAgencies, storeSetBusinessModels]);

  const resetFilters = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const setDateRange = useCallback((start: string, end: string) => {
    storeSetDateRange({ startDate: start, endDate: end });
  }, [storeSetDateRange]);

  const setPlatforms = useCallback((platforms: string[]) => {
    storeSetPlatforms(platforms);
  }, [storeSetPlatforms]);

  const setAgencies = useCallback((agencies: string[]) => {
    storeSetAgencies(agencies);
  }, [storeSetAgencies]);

  const setBusinessModels = useCallback((business_models: string[]) => {
    storeSetBusinessModels(business_models);
  }, [storeSetBusinessModels]);

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
