/**
 * 前端功能显隐配置
 *
 * v3.4.3：集中管理 Web 开发版 vs 桌面编译版的功能差异。
 * 后续调整显隐只需改这一个文件，不用到处找散落的 isDesktop 判断。
 *
 * v3.5：新增移动版（Capacitor）配置。移动端禁用数据导入/备份/报告生成等桌面功能。
 *
 * v3.5.8：Supabase / 鉴权 / SQLite↔PG 双向同步 功能封存（默认关闭）。
 *   - 桌面版（Electron）与 Web 开发版配置完全一致：均走本地 SQLite，无登录
 *   - 后端 AUTH_ENABLED / CLOUD_SYNC_ENABLED 默认 false（见 config.py / .env）
 *   - 需要启用时在后端 .env 设为 true，前端这里同步翻 true 即可恢复
 *
 * 判定方式：
 *   - 桌面版（Electron）：preload 注入 window.desktop 对象 → isDesktopClient()=true
 *   - 移动版（Capacitor）：window.Capacitor.isNative → isMobileClient()=true
 *   - Web 开发版：无 preload 注入 → isDesktopClient()=false
 */
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';

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
  /** 侧边栏「抖音青鸟对账」菜单（移动端禁用，依赖上传+对账桌面工作流） */
  showDataReconciliation: boolean;
}

/**
 * 桌面版 + Web 开发版 共用配置（v3.5.8：合并为同一套）
 *
 * 封存期默认行为：
 *   - 走本地 SQLite，无登录，无账号入口
 *   - 保留 WebDAV 备份菜单（坚果云备份功能，与 Supabase 无关）
 *     DatabaseBackup 页面里的「SQLite↔PG 双向同步」卡片在 CLOUD_SYNC_ENABLED=false 时
 *     会因后端蓝图未注册而 404，前端 catch 后静默降级为「未配置」提示
 *   - 保留账号管理菜单（平台账号映射，与鉴权无关）
 *
 * 启用 Supabase / 鉴权时需要：
 *   1. 后端 .env 设 AUTH_ENABLED=true、CLOUD_SYNC_ENABLED=true
 *   2. 在这里把对应字段翻 true（showAccountEntry/showLoginPage/showDataSyncMenu）
 */
const desktopAndWebFlags: FeatureFlags = {
  showAccountEntry: false,
  showLoginPage: false,
  showDataSyncMenu: false,
  showGithubSyncButton: true,
  showDataImport: true,
  showAccountManagement: true,
  showDatabaseBackup: true,
  showReportGeneration: true,
  showDataReconciliation: true,
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
  // v3.6.1：移动端禁用抖音青鸟对账（核心是文件上传+对账桌面工作流，mobileRouteHandler 未实现）
  showDataReconciliation: false,
};

/**
 * 当前运行环境的功能配置
 *
 * v3.6.2：PWA 端（iOS Safari 添加到主屏）与移动端共用 mobileFlags，
 *   都没有 Flask 后端，都依赖本地 SQLite（PWA 用 sql.js，安卓用 Capacitor）。
 *
 * 用法：
 *   import { featureFlags } from '@/config/features';
 *   {featureFlags.showAccountEntry && <AccountDropdown />}
 */
export const featureFlags: FeatureFlags = (isMobileClient() || isPwaClient())
  ? mobileFlags
  : desktopAndWebFlags;
