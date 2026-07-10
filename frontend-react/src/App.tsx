import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from '@/router';
import { useAppStore } from '@/stores/useAppStore';
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
      lightSiderBg: '#f5f5f5',
    },
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f5f5',
      siderBg: '#f5f5f5',
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