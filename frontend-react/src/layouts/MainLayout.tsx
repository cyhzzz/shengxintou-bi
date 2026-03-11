import { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  BookOutlined,
  TeamOutlined,
  SettingOutlined,
  ImportOutlined,
  UserOutlined,
  TagsOutlined,
  CloudSyncOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import styles from './MainLayout.module.scss';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '数据概览',
  },
  {
    key: '/conversion-funnel',
    icon: <FilterOutlined />,
    label: '转化漏斗',
  },
  {
    key: '/leads-detail',
    icon: <UnorderedListOutlined />,
    label: '线索明细',
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
      { key: '/xhs-notes/list', label: '笔记列表' },
      { key: '/xhs-notes/operation', label: '运营分析' },
    ],
  },
  {
    key: 'employee-conversion',
    icon: <TeamOutlined />,
    label: '员工转化',
    children: [
      { key: '/employee-conversion/analysis', label: '转化分析' },
      { key: '/employee-conversion/weekly', label: '转化周报' },
    ],
  },
  { type: 'divider' },
  {
    key: 'system',
    icon: <SettingOutlined />,
    label: '系统配置',
    children: [
      { key: '/system/data-import', icon: <ImportOutlined />, label: '数据导入' },
      { key: '/system/account-management', icon: <UserOutlined />, label: '账号管理' },
      { key: '/system/abbreviation-management', icon: <TagsOutlined />, label: '简称管理' },
      { key: '/system/database-backup', icon: <CloudSyncOutlined />, label: '数据同步' },
    ],
  },
  {
    key: '/report-generation',
    icon: <FileTextOutlined />,
    label: '报告生成',
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

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
        width={200}
        className={styles.sider}
      >
        <div className={styles.logo}>
          {!collapsed && <span>省心投 BI</span>}
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
      <Layout>
        <Header className={styles.header}>
          <div className={styles.breadcrumb}>
            <span className={styles.brand}>省心投</span>
            <span className={styles.separator}>/</span>
            <span className={styles.current}>
              {menuItems.find(item => item && 'key' in item && item.key === location.pathname)?.label || '页面'}
            </span>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}