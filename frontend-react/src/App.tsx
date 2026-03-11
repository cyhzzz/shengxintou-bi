import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from '@/router';
import './styles/global.scss';

// Ant Design 主题配置
const themeConfig = {
  token: {
    // 品牌主色
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',

    // 圆角
    borderRadius: 4,
    borderRadiusLG: 8,
    borderRadiusSM: 2,

    // 字体
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
      'Noto Color Emoji'`,
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    // 间距
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

    // 线框风格
    wireframe: false,
  },
  components: {
    // 按钮组件
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    // 卡片组件
    Card: {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.08)',
    },
    // 表格组件
    Table: {
      headerBg: '#f5f7fa',
      headerColor: '#333333',
      rowHoverBg: '#f5f7fa',
    },
    // 菜单组件
    Menu: {
      itemBg: 'transparent',
      itemHoverBg: 'rgba(216, 216, 216, 0.3)',
      itemSelectedBg: '#d8d8d8',
      itemColor: '#2b323f',
      itemHoverColor: '#165dff',
      itemSelectedColor: '#165dff',
    },
    // 侧边菜单
    Sider: {
      lightSiderBg: '#f5f7fa',
    },
    // 布局
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f0f2f5',
      siderBg: '#f5f7fa',
    },
    // 日期选择器
    DatePicker: {
      cellActiveWithRangeBg: '#e6f7ff',
    },
    // 选择器
    Select: {
      optionSelectedBg: '#e6f7ff',
    },
  },
};

function App() {
  return (
    <ConfigProvider
      theme={{
        ...themeConfig,
        algorithm: theme.defaultAlgorithm,
      }}
      locale={zhCN}
    >
      <AppRouter />
    </ConfigProvider>
  );
}

export default App;