/**
 * 筛选器状态管理
 * 管理全局筛选条件：日期范围、平台、代理商、业务模式等
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';

// 日期范围类型
export interface DateRange {
  startDate: string;
  endDate: string;
}

// 筛选器状态
interface FilterState {
  // 日期范围
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  setQuickDateRange: (days: number) => void;
  resetDateRange: () => void;

  // 平台筛选 (多选)
  selectedPlatforms: string[];
  setPlatforms: (platforms: string[]) => void;
  togglePlatform: (platform: string) => void;
  clearPlatforms: () => void;

  // 代理商筛选 (多选)
  selectedAgencies: string[];
  setAgencies: (agencies: string[]) => void;
  toggleAgency: (agency: string) => void;
  clearAgencies: () => void;

  // 业务模式筛选 (多选)
  selectedBusinessModels: string[];
  setBusinessModels: (models: string[]) => void;
  toggleBusinessModel: (model: string) => void;
  clearBusinessModels: () => void;

  // 服务人员筛选 (多选)
  selectedEmployees: string[];
  setEmployees: (employees: string[]) => void;
  toggleEmployee: (employee: string) => void;
  clearEmployees: () => void;

  // 应用市场筛选 (多选)
  selectedAppMarkets: string[];
  setAppMarkets: (markets: string[]) => void;
  toggleAppMarket: (market: string) => void;
  clearAppMarkets: () => void;

  // 渠道类型筛选 (多选)
  selectedChannelTypes: string[];
  setChannelTypes: (types: string[]) => void;
  toggleChannelType: (type: string) => void;
  clearChannelTypes: () => void;

  // 重置所有筛选条件
  resetAll: () => void;
}

// 默认日期范围（v3.1.10: 全局统一 2026-01-01 ~ 2026-12-31）
const getDefaultDateRange = (): DateRange => ({
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      // 日期范围
      dateRange: getDefaultDateRange(),
      setDateRange: (range) => set({ dateRange: range }),
      setQuickDateRange: (days) =>
        set({
          dateRange: {
            startDate: dayjs().subtract(days, 'day').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD'),
          },
        }),
      resetDateRange: () => set({ dateRange: getDefaultDateRange() }),

      // 平台筛选
      selectedPlatforms: [],
      setPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
      togglePlatform: (platform) =>
        set((state) => {
          const isSelected = state.selectedPlatforms.includes(platform);
          return {
            selectedPlatforms: isSelected
              ? state.selectedPlatforms.filter((p) => p !== platform)
              : [...state.selectedPlatforms, platform],
          };
        }),
      clearPlatforms: () => set({ selectedPlatforms: [] }),

      // 代理商筛选
      selectedAgencies: [],
      setAgencies: (agencies) => set({ selectedAgencies: agencies }),
      toggleAgency: (agency) =>
        set((state) => {
          const isSelected = state.selectedAgencies.includes(agency);
          return {
            selectedAgencies: isSelected
              ? state.selectedAgencies.filter((a) => a !== agency)
              : [...state.selectedAgencies, agency],
          };
        }),
      clearAgencies: () => set({ selectedAgencies: [] }),

      // 业务模式筛选
      selectedBusinessModels: [],
      setBusinessModels: (models) => set({ selectedBusinessModels: models }),
      toggleBusinessModel: (model) =>
        set((state) => {
          const isSelected = state.selectedBusinessModels.includes(model);
          return {
            selectedBusinessModels: isSelected
              ? state.selectedBusinessModels.filter((m) => m !== model)
              : [...state.selectedBusinessModels, model],
          };
        }),
      clearBusinessModels: () => set({ selectedBusinessModels: [] }),

      // 服务人员筛选
      selectedEmployees: [],
      setEmployees: (employees) => set({ selectedEmployees: employees }),
      toggleEmployee: (employee) =>
        set((state) => {
          const isSelected = state.selectedEmployees.includes(employee);
          return {
            selectedEmployees: isSelected
              ? state.selectedEmployees.filter((e) => e !== employee)
              : [...state.selectedEmployees, employee],
          };
        }),
      clearEmployees: () => set({ selectedEmployees: [] }),

      // 应用市场筛选
      selectedAppMarkets: [],
      setAppMarkets: (markets) => set({ selectedAppMarkets: markets }),
      toggleAppMarket: (market) =>
        set((state) => {
          const isSelected = state.selectedAppMarkets.includes(market);
          return {
            selectedAppMarkets: isSelected
              ? state.selectedAppMarkets.filter((m) => m !== market)
              : [...state.selectedAppMarkets, market],
          };
        }),
      clearAppMarkets: () => set({ selectedAppMarkets: [] }),

      // 渠道类型筛选
      selectedChannelTypes: [],
      setChannelTypes: (types) => set({ selectedChannelTypes: types }),
      toggleChannelType: (type) =>
        set((state) => {
          const isSelected = state.selectedChannelTypes.includes(type);
          return {
            selectedChannelTypes: isSelected
              ? state.selectedChannelTypes.filter((t) => t !== type)
              : [...state.selectedChannelTypes, type],
          };
        }),
      clearChannelTypes: () => set({ selectedChannelTypes: [] }),

      // 重置所有
      resetAll: () =>
        set({
          dateRange: getDefaultDateRange(),
          selectedPlatforms: [],
          selectedAgencies: [],
          selectedBusinessModels: [],
          selectedEmployees: [],
          selectedAppMarkets: [],
          selectedChannelTypes: [],
        }),
    }),
    {
      name: 'filter-storage',
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedPlatforms: state.selectedPlatforms,
        selectedAgencies: state.selectedAgencies,
        selectedBusinessModels: state.selectedBusinessModels,
        selectedEmployees: state.selectedEmployees,
        selectedAppMarkets: state.selectedAppMarkets,
        selectedChannelTypes: state.selectedChannelTypes,
      }),
    }
  )
);