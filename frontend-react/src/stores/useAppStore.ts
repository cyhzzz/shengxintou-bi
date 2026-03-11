/**
 * 全局应用状态管理
 * 使用 Zustand 进行状态管理
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // 侧边栏状态
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 主题模式
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark') => void;

  // 当前激活的菜单
  activeMenuKey: string;
  setActiveMenuKey: (key: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 侧边栏状态
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // 主题模式
      themeMode: 'light',
      toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
      setThemeMode: (mode) => set({ themeMode: mode }),

      // 当前激活的菜单
      activeMenuKey: '/dashboard',
      setActiveMenuKey: (key) => set({ activeMenuKey: key }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        themeMode: state.themeMode,
      }),
    }
  )
);