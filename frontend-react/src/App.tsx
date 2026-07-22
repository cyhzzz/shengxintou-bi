import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from '@/router';
import { useAppStore } from '@/stores/useAppStore';
import { isMobileClient } from '@/utils/isDesktop';
import { initMobileDatabase, databaseExists } from '@/services/mobileSqlite';
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
  // 如果数据库文件已存在（已同步过数据），打开连接供报表查询使用
  // 如果不存在，跳过初始化（等待用户先同步数据）
  useEffect(() => {
    if (!isMobileClient()) return;
    // 注入移动端缩放 class（v3.5.2：安卓横屏下前端整体偏大 1.5 倍）
    document.body.classList.add('mobile-zoom');
    (async () => {
      try {
        const exists = await databaseExists();
        if (exists) {
          await initMobileDatabase();
          console.log('[mobile] SQLite 数据库已初始化');
        } else {
          console.log('[mobile] 数据库文件不存在，请先同步数据');
        }
      } catch (err) {
        console.error('[mobile] 数据库初始化失败:', err);
      }
    })();
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