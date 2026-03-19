// 开发代码/frontend-react/src/utils/filterAdapter.ts
/**
 * 筛选器数据格式适配器
 * 将 React/Ant Design 筛选器格式转换为旧版 JS 格式
 */

/**
 * React 筛选器状态（来自 Zustand Store）
 */
export interface ReactFilterState {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  selectedPlatforms: string[];
  selectedAgencies: string[];
  selectedBusinessModels: string[];
  selectedEmployees: string[];
}

/**
 * 旧版 JS 筛选器格式
 */
export interface LegacyFilterFormat {
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
  date_range?: [string, string];
}

/**
 * 将 React 筛选器格式转换为旧版格式
 * @param filters React 筛选器状态
 * @returns 旧版筛选器格式
 */
export function convertToLegacyFormat(filters: ReactFilterState): LegacyFilterFormat {
  const legacyFilters: LegacyFilterFormat = {};

  // 平台（数组保持不变）
  if (filters.selectedPlatforms.length > 0) {
    legacyFilters.platforms = filters.selectedPlatforms;
  }

  // 业务模式
  if (filters.selectedBusinessModels.length > 0) {
    legacyFilters.business_models = filters.selectedBusinessModels;
  }

  // 代理商
  if (filters.selectedAgencies.length > 0) {
    legacyFilters.agencies = filters.selectedAgencies;
  }

  // 日期范围
  if (filters.dateRange.startDate && filters.dateRange.endDate) {
    legacyFilters.date_range = [
      filters.dateRange.startDate,
      filters.dateRange.endDate,
    ];
  }

  return legacyFilters;
}

/**
 * 将旧版筛选器格式转换为 API 查询参数
 * @param filters 旧版筛选器格式
 * @returns API 查询参数对象
 */
export function convertToApiParams(filters: LegacyFilterFormat): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.platforms?.length) {
    params.platforms = filters.platforms.join(',');
  }
  if (filters.business_models?.length) {
    params.business_models = filters.business_models.join(',');
  }
  if (filters.agencies?.length) {
    params.agencies = filters.agencies.join(',');
  }
  if (filters.date_range) {
    params.start_date = filters.date_range[0];
    params.end_date = filters.date_range[1];
  }

  return params;
}

/**
 * 将旧版筛选器格式转换为 React 格式
 * @param legacyFilters 旧版筛选器格式
 * @returns React 筛选器状态
 */
export function convertToReactFormat(legacyFilters: LegacyFilterFormat): ReactFilterState {
  return {
    dateRange: {
      startDate: legacyFilters.date_range?.[0] || '',
      endDate: legacyFilters.date_range?.[1] || '',
    },
    selectedPlatforms: legacyFilters.platforms || [],
    selectedAgencies: legacyFilters.agencies || [],
    selectedBusinessModels: legacyFilters.business_models || [],
    selectedEmployees: [],
  };
}

/**
 * 验证筛选器值
 * @param filters React 筛选器状态
 * @returns 验证结果
 */
export function validateFilters(filters: ReactFilterState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证日期范围
  if (filters.dateRange.startDate && filters.dateRange.endDate) {
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    if (startDate > endDate) {
      errors.push('开始日期不能晚于结束日期');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}