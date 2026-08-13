import { useState, useMemo } from 'react';
import { Layout, Menu, Tooltip, Button, Dropdown, Modal, Form, Input, App as AntApp } from 'antd';
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
  DollarOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { HelpModal } from '@/components';
import MobileSyncButton from '@/components/MobileSyncButton';
import AnimatedOutlet from '@/components/AnimatedOutlet';
import { useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { logout, changePassword } from '@/services/auth';
import { useEffect } from 'react';
import { fetchMe } from '@/services/auth';
import type { MenuProps } from 'antd';
import { featureFlags } from '@/config/features';
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
      // v3.3.10: 路由 key 由 /app-market/creative 改为 /app-market/plan-analysis（命名统一）
      { key: '/app-market/plan-analysis', label: '计划分析', icon: <FileTextOutlined /> },
      // v3.6.3: 消耗和成本
      { key: '/app-market/cost-analysis', label: '消耗和成本', icon: <DollarOutlined /> },
      // v3.7.3: 归因转化率分析
      { key: '/app-market/attribution-conversion', label: '归因转化率', icon: <RiseOutlined /> },
    ],
  },
  {
    key: 'xhs-notes',
    icon: <BookOutlined />,
    label: '小红书',
    children: [
      { key: '/xhs-notes/list', label: '笔记列表', icon: <FileTextOutlined /> },
      { key: '/xhs-notes/operation', label: '运营分析', icon: <LineChartOutlined /> },
      // v3.3.10: 小红书计划分析（仿应用市场 plan-analysis 报表）
      { key: '/xhs-notes/plan-analysis', label: '计划分析', icon: <FileTextOutlined /> },
      // v3.8.0: 分支KOS转化周报（笔记ID 关联创作者=分支投顾名单）
      { key: '/xhs-notes/kos-weekly', label: '分支KOS转化周报', icon: <BarChartOutlined /> },
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
  // 用 featureFlags 控制菜单显隐（配置文件统一管理）
  const visibleMenuItems = useMemo(() => {
    return (menuItems || []).map(item => {
      if (!item || typeof item !== 'object') return item;
      const it = item as any;
      // 过滤报告生成
      if (it.key === '/report-generation' && !featureFlags.showReportGeneration) {
        return null;
      }
      // 过滤系统配置子菜单
      if (it.key === 'system' && it.children) {
        const filteredChildren = it.children.filter((c: any) => {
          if (!c) return false;
          if (c.key === '/system/data-import' && !featureFlags.showDataImport) return false;
          if (c.key === '/system/account-management' && !featureFlags.showAccountManagement) return false;
          if (c.key === '/system/database-backup' && !featureFlags.showDatabaseBackup) return false;
          return true;
        });
        // 如果没有子菜单了，隐藏整个系统配置
        if (filteredChildren.length === 0) return null;
        return { ...it, children: filteredChildren };
      }
      // v3.8.0：小红书子菜单按 features 过滤（移动端禁用分支KOS转化周报）
      if (it.key === 'xhs-notes' && it.children) {
        const filteredChildren = it.children.filter((c: any) => {
          if (!c) return false;
          if (c.key === '/xhs-notes/kos-weekly' && !featureFlags.showKosWeekly) return false;
          return true;
        });
        if (filteredChildren.length === 0) return null;
        return { ...it, children: filteredChildren };
      }
      // v3.6.1：内容平台子菜单按 features 过滤（移动端禁用抖音青鸟对账）
      if (it.key === 'content-platform' && it.children) {
        const filteredChildren = it.children.filter((c: any) => {
          if (!c) return false;
          if (c.key === '/data-reconciliation/douyin-qingniao' && !featureFlags.showDataReconciliation) return false;
          return true;
        });
        if (filteredChildren.length === 0) return null;
        return { ...it, children: filteredChildren };
      }
      // v3.8.1：应用市场子菜单按 features 过滤（归因转化率）
      if (it.key === 'app-market' && it.children) {
        const filteredChildren = it.children.filter((c: any) => {
          if (!c) return false;
          if (c.key === '/app-market/attribution-conversion' && !featureFlags.showAppMarketAttribution) return false;
          return true;
        });
        if (filteredChildren.length === 0) return null;
        return { ...it, children: filteredChildren };
      }
      return item;
    }).filter(Boolean) as MenuProps['items'];
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { themeMode, toggleTheme } = useAppStore();

  // feat-desktop：右上角账号下拉 → 修改密码
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdForm] = Form.useForm<{ old_password: string; new_password: string; confirm_password: string }>();
  const { message: antdMessage } = AntApp.useApp();

  // feat-cloud-supabase：右上角"当前账号 + 退出"
  // v3.5.8：仅在 showAccountEntry=true 时拉用户元数据，避免鉴权关闭时无谓的 401
  const email = useAuthStore((s) => s.email);
  const profile = useAuthStore((s) => s.profile);
  useEffect(() => {
    if (!featureFlags.showAccountEntry) return;
    // 进入布局时拉一次当前用户元数据
    fetchMe().catch(() => {/* 静默失败 */});
  }, []);
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };
  const handleOpenChangePwd = () => {
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };
  const handleChangePwdOk = async () => {
    try {
      const values = await pwdForm.validateFields();
      if (values.new_password !== values.confirm_password) {
        antdMessage.error('两次输入的新密码不一致');
        return;
      }
      if (values.old_password === values.new_password) {
        antdMessage.warning('新密码不能与原密码相同');
        return;
      }
      setPwdSubmitting(true);
      try {
        await changePassword(values.old_password, values.new_password);
        antdMessage.success('密码修改成功，请重新登录');
        setPwdModalOpen(false);
        // 改完密码强制重新登录
        await logout();
        navigate('/login', { replace: true });
      } catch (e: unknown) {
        const err = e as { message?: string };
        antdMessage.error(err.message || '修改密码失败');
      } finally {
        setPwdSubmitting(false);
      }
    } catch {
      /* validateFields 已显示具体错误 */
    }
  };

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
              src={`${import.meta.env.BASE_URL}icons/${collapsed ? 'LOGO-square.png' : 'LOGO.svg'}`}
              className={styles.logoIcon}
              alt="申万宏源"
            />
            {!collapsed && (
              <img src={`${import.meta.env.BASE_URL}icons/省心投.svg`} className={styles.logoTextIcon} alt="省心投" />
            )}
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={visibleMenuItems}
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
            <MobileSyncButton />
            <Tooltip title={themeMode === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label="切换主题"
              >
                {themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </button>
            </Tooltip>
            {featureFlags.showAccountEntry && (
              <Dropdown
                menu={{
                  items: [
                    { key: 'email', label: email || '未登录', disabled: true },
                    ...(profile?.role ? [{ key: 'role', label: `角色：${profile.role}`, disabled: true }] : []),
                    { type: 'divider' as const },
                    { key: 'change-password', label: '修改密码', onClick: handleOpenChangePwd },
                    { key: 'logout', label: '退出', onClick: handleLogout },
                  ],
                }}
                placement="bottomRight"
              >
                <Button type="text" size="small">
                  {(email || '账号').split('@')[0]}
                </Button>
              </Dropdown>
            )}
            <HelpModal />
          </div>
        </Header>
        <Content className={styles.content}>
          <LazyMotion features={domAnimation} strict>
            <AnimatedOutlet />
          </LazyMotion>
        </Content>
      </Layout>

      {/* feat-desktop：修改自己的密码（无 admin 角色显示） */}
      <Modal
        title="修改密码"
        open={pwdModalOpen}
        onOk={handleChangePwdOk}
        onCancel={() => setPwdModalOpen(false)}
        confirmLoading={pwdSubmitting}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" preserve={false}>
          <Form.Item
            name="old_password"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password autoComplete="current-password" placeholder="原密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '新密码至少 6 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="新密码（至少 6 位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的新密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
