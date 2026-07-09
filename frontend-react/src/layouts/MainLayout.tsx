import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  TagOutlined,
  SyncOutlined,
  FilePdfOutlined,
  MobileOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { HelpModal } from '@/components';
import type { MenuProps } from 'antd';
import styles from './MainLayout.module.scss';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
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
    key: 'leads-detail-group',
    icon: <UnorderedListOutlined />,
    label: '线索明细',
    children: [
      { key: '/leads-detail', label: '线索明细', icon: <UnorderedListOutlined /> },
      { key: '/anchor-clusters', label: '主播聚类', icon: <UserOutlined /> },
    ],
  },
  {
    key: '/agency-analysis',
    icon: <BarChartOutlined />,
    label: '厂商分析',
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
  // v3.1 §六: 应用市场升顶级
  {
    key: 'app-market',
    icon: <MobileOutlined />,
    label: '应用市场',
    children: [
      { key: '/app-market/funnel', label: '获客漏斗', icon: <FunnelPlotOutlined /> },
      { key: '/app-market/comparison', label: '市场对比', icon: <AppstoreOutlined /> },
      { key: '/app-market/detail', label: '明细查询', icon: <UnorderedListOutlined /> },
      { key: '/app-market/creative', label: '创意效果', icon: <FileTextOutlined /> },
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
  // v3.1 §八: 直播占位
  {
    key: 'live',
    icon: <VideoCameraOutlined />,
    label: '直播获客',
    children: [
      { key: '/live/funnel', label: '直播漏斗', icon: <FunnelPlotOutlined /> },
    ],
  },
  { type: 'divider' },
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
      { key: '/system/abbreviation-management', icon: <TagOutlined />, label: '简称管理' },
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
  return '页面';
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const getSelectedKeys = () => {
    return [location.pathname];
  };

  const getOpenKeys = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      return [`/${pathParts[0]}`];
    }
    return [];
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
            <img src="/icons/LOGO.svg" className={styles.logoIcon} alt="申万宏源" />
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
              {findLabel(menuItems, location.pathname)}
            </span>
          </div>
          <div className={styles.headerRight}>
            <HelpModal />
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
