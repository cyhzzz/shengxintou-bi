import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { StatusBar, Style } from '@capacitor/status-bar';
import AppRouter from '@/router';
import { useAppStore } from '@/stores/useAppStore';
import { isMobileClient } from '@/utils/isDesktop';
import { initMobileDatabase, databaseExists, copyDatabaseFromAssets } from '@/services/mobileSqlite';
import { syncFromWebDAV } from '@/services/mobileSync';
import './styles/global.scss';

// 亮色模式主题 — 显式设定所有颜色 token
const lightTheme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#15a877',
    colorWarning: '#e27900',
    colorError: '#e8463a',
    colorInfo: '#2f74ff',

    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorBorder: 'rgba(115, 115, 115, 0.12)',
    colorBorderSecondary: 'rgba(115, 115, 115, 0.24)',

    colorText: '#171717',
    colorTextSecondary: '#525252',
    colorTextTertiary: '#737373',
    colorTextDisabled: '#a1a1a1',

    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,

    fontFamily: '"SF Pro Text", "PingFang SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',

    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,

    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    },
    Table: {
      headerBg: '#f5f5f5',
      headerColor: '#525252',
      rowHoverBg: 'rgba(115, 115, 115, 0.06)',
      borderColor: 'rgba(115, 115, 115, 0.12)',
    },
    Menu: {
      itemBg: 'transparent',
      itemHoverBg: 'rgba(115, 115, 115, 0.06)',
      itemSelectedBg: 'rgba(24, 144, 255, 0.08)',
      itemColor: '#525252',
      itemHoverColor: '#1890ff',
      itemSelectedColor: '#1890ff',
    },
    Sider: {
      lightSiderBg: '#ffffff',  // 与 MainLayout.module.scss var(--bg-content) 对齐
    },
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f5f5',
      siderBg: '#ffffff',  // 与 MainLayout.module.scss var(--bg-content) 对齐
    },
    DatePicker: {
      cellActiveWithRangeBg: 'rgba(24, 144, 255, 0.08)',
    },
    Select: {
      optionSelectedBg: 'rgba(24, 144, 255, 0.08)',
    },
  },
};

// 暗色模式主题 — 只设品牌色和非颜色 token，让 darkAlgorithm 自动计算其余颜色
const darkTheme = {
  token: {
    colorPrimary: '#6a9fff',
    colorSuccess: '#2fb287',
    colorWarning: '#f39a35',
    colorError: '#ea574c',
    colorInfo: '#4c88ff',

    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,

    fontFamily: '"SF Pro Text", "PingFang SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,

    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
    },
    Menu: {
      itemHoverColor: '#6a9fff',
      itemSelectedColor: '#6a9fff',
    },
  },
};

function App() {
  const themeMode = useAppStore((s) => s.themeMode);

  // 同步 data-theme 属性到 <html>，驱动 CSS 自定义属性切换
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [themeMode]);

  // 移动端：应用启动时初始化本地 SQLite 数据库
  // v3.5.3 双保险方案：
  //   1. DB 不存在 → 先 copyFromAssets 从 APK 内置 DB 初始化（开箱即用，无需联网）
  //   2. 后台异步从坚果云拉取最新数据覆盖内置版本（保证数据最新）
  useEffect(() => {
    if (!isMobileClient()) return;
    // 注入移动端缩放 class 到 <body>（v3.5.3：CSS zoom 方案）
    document.body.classList.add('mobile-scaled');

    // v3.5.3：隐藏系统状态栏（电量/时间/通知图标），
    // 防止右上角系统信息栏遮挡 Header 按钮。
    // Android 12+ Splash Screen API 在启动动画结束后会恢复状态栏，
    // 仅靠 styles.xml 的 windowFullscreen 不够，需 JS 主动隐藏。
    // setOverlaysWebview(false) 作为兜底：即使状态栏仍显示，内容也不延伸到其下方。
    (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.hide();
        console.log('[mobile] StatusBar hidden');
      } catch (err) {
        console.warn('[mobile] StatusBar hide failed (non-critical):', err);
      }
    })();

    let cancelled = false;
    (async () => {
      try {
        let exists = await databaseExists();
        if (!exists) {
          console.log('[mobile] 首次启动：从 APK 内置 assets 复制数据库...');
          try {
            await copyDatabaseFromAssets(false);
            exists = true;
            console.log('[mobile] 内置 DB 复制成功');
          } catch (err) {
            console.warn('[mobile] 内置 DB 复制失败，尝试从坚果云拉取:', err);
            // 兜底：从坚果云拉取
            const r = await syncFromWebDAV();
            if (r.success) {
              exists = true;
              console.log('[mobile] 坚果云首次拉取成功');
            } else {
              console.warn('[mobile] 坚果云首次拉取失败:', r.message);
            }
          }
        }
        if (cancelled) return;
        if (exists) {
          await initMobileDatabase();
          console.log('[mobile] SQLite 数据库已初始化');
        } else {
          console.warn('[mobile] 数据库仍未就绪，请在"数据同步"页手动同步');
        }
      } catch (err) {
        console.error('[mobile] 数据库初始化失败:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isDark = themeMode === 'dark';

  return (
    <ConfigProvider
      theme={{
        ...(isDark ? darkTheme : lightTheme),
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
      locale={zhCN}
    >
      <AppRouter />
    </ConfigProvider>
  );
}

export default App;