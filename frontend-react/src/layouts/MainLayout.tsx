import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Icon, ICONS, HelpModal } from '@/components';
import type { MenuProps } from 'antd';
import styles from './MainLayout.module.scss';

const { Sider, Header, Content } = Layout;

// Custom icon component for menu items
const MenuIcon = ({ name }: { name: string }) => (
  <Icon name={name} style={{ width: 18, height: 18 }} />
);

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <MenuIcon name={ICONS.数据概览} />,
    label: '数据概览',
  },
  {
    key: '/conversion-funnel',
    icon: <MenuIcon name={ICONS.转化漏斗} />,
    label: '转化漏斗',
  },
  {
    key: '/leads-detail',
    icon: <MenuIcon name={ICONS.线索明细} />,
    label: '线索明细',
  },
  {
    key: '/agency-analysis',
    icon: <MenuIcon name={ICONS.厂商分析} />,
    label: '厂商分析',
  },
  {
    key: 'xhs-notes',
    icon: <MenuIcon name={ICONS.小红书报表} />,
    label: '小红书',
    children: [
      { key: '/xhs-notes/list', label: '笔记列表', icon: <MenuIcon name={ICONS.笔记列表} /> },
      { key: '/xhs-notes/operation', label: '运营分析', icon: <MenuIcon name={ICONS.运营分析} /> },
    ],
  },
  {
    key: 'employee-conversion',
    icon: <MenuIcon name={ICONS.员工转化报表} />,
    label: '员工转化',
    children: [
      { key: '/employee-conversion/analysis', label: '转化分析', icon: <MenuIcon name={ICONS.转化效果分析} /> },
      { key: '/employee-conversion/weekly', label: '转化周报', icon: <MenuIcon name={ICONS.转化周报生成} /> },
    ],
  },
  { type: 'divider' },
  {
    key: 'system',
    icon: <MenuIcon name={ICONS.系统配置} />,
    label: '系统配置',
    children: [
      { key: '/system/data-import', icon: <MenuIcon name={ICONS.数据导入} />, label: '数据导入' },
      { key: '/system/account-management', icon: <MenuIcon name={ICONS.账号管理} />, label: '账号管理' },
      { key: '/system/abbreviation-management', icon: <MenuIcon name={ICONS.简称管理} />, label: '简称管理' },
      { key: '/system/database-backup', icon: <MenuIcon name={ICONS.数据同步} />, label: '数据同步' },
    ],
  },
  {
    key: '/report-generation',
    icon: <MenuIcon name={ICONS.报告生成} />,
    label: '报告生成',
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
        width={200}
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
      <Layout>
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