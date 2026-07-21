import { useState } from 'react';
import { Layout, Menu, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { LazyMotion, domAnimation } from 'framer-motion';
import {
  DashboardOutlined,
  FunnelPlotOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  BookOutlined,
  FileTextOutlined,
  LineChartOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  FileAddOutlined,
  SettingOutlined,
  UploadOutlined,
  UserOutlined,
  SyncOutlined,
  FilePdfOutlined,
  MobileOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  VideoCameraOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  BulbOutlined,
  SunOutlined,
  MoonOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { HelpModal } from '@/components';
import AnimatedOutlet from '@/components/AnimatedOutlet';
import { useAppStore } from '@/stores/useAppStore';
import type { MenuProps } from 'antd';
import styles from './MainLayout.module.scss';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  // ===== 第一段：业务总览 =====
  // v3.1 §二.5: 全渠道获客放最上面（顶级 1）
  {
    key: '/omni-channel',
    icon: <GlobalOutlined />,
    label: '全渠道获客',
  },
  // v3.1 §二: 互联网渠道数据概览（口径限定互联网渠道：内容平台+应用市场）
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '互联网渠道数据概览',
  },
  {
    key: '/conversion-funnel',
    icon: <FunnelPlotOutlined />,
    label: '转化漏斗',
  },
  {
    key: '/agency-analysis',
    icon: <BarChartOutlined />,
    label: '厂商分析',
  },
  { type: 'divider' },
  // ===== 第二段：业务专题 =====
  // 内容平台（v3.3.6 新增一级菜单：线索明细 + 抖音青鸟对账；v3.3.10 增加投放评审）
  {
    key: 'content-platform',
    icon: <FileTextOutlined />,
    label: '内容平台',
    children: [
      { key: '/leads-detail', label: '线索明细', icon: <UnorderedListOutlined /> },
      { key: '/investment-review', label: '投放评审', icon: <AuditOutlined /> },
      { key: '/data-reconciliation/douyin-qingniao', label: '抖音青鸟对账', icon: <AuditOutlined /> },
    ],
  },
  // v3.1 §六: 应用市场升顶级
  {
    key: 'app-market',
    icon: <MobileOutlined />,
    label: '应用市场',
    children: [
      { key: '/app-market/funnel', label: '获客漏斗', icon: <FunnelPlotOutlined /> },
      { key: '/app-market/comparison', label: '市场对比', icon: <AppstoreOutlined /> },
      { key: '/app-market/detail', label: '明细查询', icon: <UnorderedListOutlined /> },
      { key: '/app-market/creative', label: '计划分析', icon: <FileTextOutlined /> },
    ],
  },
  {
    key: 'xhs-notes',
    icon: <BookOutlined />,
    label: '小红书',
    children: [
      { key: '/xhs-notes/list', label: '笔记列表', icon: <FileTextOutlined /> },
      { key: '/xhs-notes/operation', label: '运营分析', icon: <LineChartOutlined /> },
    ],
  },
  // 直播获客（含主播聚类二级菜单）
  {
    key: 'live',
    icon: <VideoCameraOutlined />,
    label: '直播获客',
    children: [
      { key: '/live/funnel', label: '直播漏斗', icon: <FunnelPlotOutlined /> },
      { key: '/live/direct-sales', label: '直播带货', icon: <ShoppingCartOutlined /> },
      { key: '/live/advisor-ip', label: '投顾IP', icon: <SolutionOutlined /> },
      { key: '/live/analyst', label: '分析师', icon: <BulbOutlined /> },
      { key: '/anchor-clusters', label: '主播分析', icon: <UserOutlined /> },
    ],
  },
  {
    key: 'employee-conversion',
    icon: <TeamOutlined />,
    label: '员工转化',
    children: [
      { key: '/employee-conversion/analysis', label: '转化分析', icon: <UserSwitchOutlined /> },
      { key: '/employee-conversion/weekly', label: '转化周报', icon: <FileAddOutlined /> },
    ],
  },
  { type: 'divider' },
  // ===== 第三段：系统功能 =====
  {
    key: '/report-generation',
    icon: <FilePdfOutlined />,
    label: '报告生成',
  },
  {
    key: 'system',
    icon: <SettingOutlined />,
    label: '系统配置',
    children: [
      { key: '/system/data-import', icon: <UploadOutlined />, label: '数据导入' },
      { key: '/system/account-management', icon: <UserOutlined />, label: '账号管理' },
      { key: '/system/database-backup', icon: <SyncOutlined />, label: '数据同步' },
    ],
  },
];

// Find label by path
const findLabel = (items: MenuProps['items'], key: string): string => {
  for (const item of items || []) {
    if (!item) continue;
    if ('key' in item && item.key === key && 'label' in item) {
      return item.label as string;
    }
    if ('children' in item && item.children) {
      const found = findLabel(item.children, key);
      if (found) return found;
    }
  }
  return '';  // falsy — prevents recursion short-circuit; caller falls back to '页面'
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { themeMode, toggleTheme } = useAppStore();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const getSelectedKeys = () => {
    return [location.pathname];
  };

  const getOpenKeys = () => {
    // 遍历 menuItems 反查当前路径所在父级菜单的 key
    const openKeys: string[] = [];
    for (const item of menuItems || []) {
      if (!item || !('children' in item) || !item.children) continue;
      if ('key' in item && item.key && item.children.some(c => c && 'key' in c && c.key === location.pathname)) {
        openKeys.push(item.key as string);
      }
    }
    return openKeys;
  };

  return (
    <Layout className={styles.layout}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={210}
        className={styles.sider}
      >
        {/* Sidebar Logo - Matching original frontend */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            {/* v3.3.10: 收起时换方形 LOGO（256×255），避免横版 logo 被报表区域截断成半个 */}
            <img
              src={collapsed ? '/icons/LOGO-square.png' : '/icons/LOGO.svg'}
              className={styles.logoIcon}
              alt="申万宏源"
            />
            {!collapsed && (
              <img src="/icons/省心投.svg" className={styles.logoTextIcon} alt="省心投" />
            )}
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          className={styles.menu}
        />
      </Sider>
      <Layout className={styles.mainLayout}>
        <Header className={styles.header}>
          <div className={styles.breadcrumb}>
            <span className={styles.brand}>省心投</span>
            <span className={styles.separator}>/</span>
            <span className={styles.current}>
              {findLabel(menuItems, location.pathname) || '页面'}
            </span>
          </div>
          <div className={styles.headerRight}>
            <Tooltip title={themeMode === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label="切换主题"
              >
                {themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </button>
            </Tooltip>
            <HelpModal />
          </div>
        </Header>
        <Content className={styles.content}>
          <LazyMotion features={domAnimation} strict>
            <AnimatedOutlet />
          </LazyMotion>
        </Content>
      </Layout>
    </Layout>
  );
}
