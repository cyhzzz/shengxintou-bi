/**
 * 前端功能显隐配置
 *
 * v3.4.3：集中管理 Web 开发版 vs 桌面编译版的功能差异。
 * 后续调整显隐只需改这一个文件，不用到处找散落的 isDesktop 判断。
 *
 * v3.5：新增移动版（Capacitor）配置。移动端禁用数据导入/备份/报告生成等桌面功能。
 *
 * 判定方式：
 *   - 桌面版（Electron）：preload 注入 window.desktop 对象 → isDesktopClient()=true
 *   - 移动版（Capacitor）：window.Capacitor.isNative → isMobileClient()=true
 *   - Web 开发版：无 preload 注入 → isDesktopClient()=false
 */
import { isDesktopClient, isMobileClient } from '@/utils/isDesktop';

export interface FeatureFlags {
  /** 右上角账号入口（Dropdown：邮箱/修改密码/退出） */
  showAccountEntry: boolean;
  /** 登录功能（/login 路由 + ProtectedRoute 鉴权拦截） */
  showLoginPage: boolean;
  /** 侧边栏「数据同步」菜单（WebDAV 备份 + 双向同步） */
  showDataSyncMenu: boolean;
  /** 关于页 GitHub 代码同步按钮（git pull 自更新） */
  showGithubSyncButton: boolean;
  /** 侧边栏「数据导入」菜单 */
  showDataImport: boolean;
  /** 侧边栏「账号管理」菜单 */
  showAccountManagement: boolean;
  /** 侧边栏「数据同步/数据库备份」菜单 */
  showDatabaseBackup: boolean;
  /** 侧边栏「报告生成」菜单 */
  showReportGeneration: boolean;
}

/** Web 开发版配置（本地 3000/5000） */
const webFlags: FeatureFlags = {
  showAccountEntry: false,
  showLoginPage: false,
  showDataSyncMenu: true,
  showGithubSyncButton: true,
  showDataImport: true,
  showAccountManagement: true,
  showDatabaseBackup: true,
  showReportGeneration: true,
};

/** 桌面编译版配置（Electron + Supabase） */
const desktopFlags: FeatureFlags = {
  showAccountEntry: true,
  showLoginPage: true,
  showDataSyncMenu: false,
  showGithubSyncButton: true,
  showDataImport: true,
  showAccountManagement: true,
  showDatabaseBackup: false,
  showReportGeneration: true,
};

/** 移动版配置（Capacitor Android） */
const mobileFlags: FeatureFlags = {
  showAccountEntry: false,
  showLoginPage: false,
  showDataSyncMenu: false,
  showGithubSyncButton: false,
  showDataImport: false,
  showAccountManagement: false,
  // v3.5.3：移动端开放数据同步菜单，进入简化版同步页（仅下载）
  showDatabaseBackup: true,
  // v3.5.5：移动端开放报告生成菜单（mobileRouteHandler 已支持 /reports/weekly/*）
  showReportGeneration: true,
};

/**
 * 当前运行环境的功能配置
 *
 * 用法：
 *   import { featureFlags } from '@/config/features';
 *   {featureFlags.showAccountEntry && <AccountDropdown />}
 */
export const featureFlags: FeatureFlags = isMobileClient()
  ? mobileFlags
  : isDesktopClient()
    ? desktopFlags
    : webFlags;
