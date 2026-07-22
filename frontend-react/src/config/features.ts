/**
 * 前端功能显隐配置
 *
 * v3.4.3：集中管理 Web 开发版 vs 桌面编译版的功能差异。
 * 后续调整显隐只需改这一个文件，不用到处找散落的 isDesktop 判断。
 *
 * 判定方式：
 *   - 桌面版（Electron）：preload 注入 window.desktop 对象 → isDesktopClient()=true
 *   - Web 开发版：无 preload 注入 → isDesktopClient()=false
 */
import { isDesktopClient } from '@/utils/isDesktop';

export interface FeatureFlags {
  /** 右上角账号入口（Dropdown：邮箱/修改密码/退出） */
  showAccountEntry: boolean;
  /** 登录功能（/login 路由 + ProtectedRoute 鉴权拦截） */
  showLoginPage: boolean;
  /** 侧边栏「数据同步」菜单（WebDAV 备份 + 双向同步） */
  showDataSyncMenu: boolean;
  /** 关于页 GitHub 代码同步按钮（git pull 自更新） */
  showGithubSyncButton: boolean;
}

/** Web 开发版配置（本地 3000/5000） */
const webFlags: FeatureFlags = {
  showAccountEntry: false,
  showLoginPage: false,
  showDataSyncMenu: true,
  showGithubSyncButton: true,
};

/** 桌面编译版配置（Electron + Supabase） */
const desktopFlags: FeatureFlags = {
  showAccountEntry: true,
  showLoginPage: true,
  showDataSyncMenu: false,
  showGithubSyncButton: true,
};

/**
 * 当前运行环境的功能配置
 *
 * 用法：
 *   import { featureFlags } from '@/config/features';
 *   {featureFlags.showAccountEntry && <AccountDropdown />}
 */
export const featureFlags: FeatureFlags = isDesktopClient() ? desktopFlags : webFlags;
