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

  // 重置所有筛选条件
  resetAll: () => void;
}

// 默认日期范围（最近30天）
const getDefaultDateRange = (): DateRange => ({
  startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
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

      // 重置所有
      resetAll: () =>
        set({
          dateRange: getDefaultDateRange(),
          selectedPlatforms: [],
          selectedAgencies: [],
          selectedBusinessModels: [],
        }),
    }),
    {
      name: 'filter-storage',
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedPlatforms: state.selectedPlatforms,
        selectedAgencies: state.selectedAgencies,
        selectedBusinessModels: state.selectedBusinessModels,
      }),
    }
  )
);