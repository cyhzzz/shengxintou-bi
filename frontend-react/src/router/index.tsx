import { createBrowserRouter, createHashRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/Login';
import { useAuthStore } from '@/stores/useAuthStore';
import { featureFlags } from '@/config/features';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';

// v3.2.5：所有页面改 React.lazy 按需加载，主包只保留 MainLayout，
// 首屏只拉当前路由对应的 chunk，避免一次加载全部 21 个页面 + 重型依赖（echarts/plots/framer-motion）。
// Suspense fallback 用一个轻量占位，避免闪烁的 antd Spin。
const PageFallback = () => (
  <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
    加载中...
  </div>
);

// 统一 lazy 包装：Suspense 边界 + 错误边界
// v3.3.4：支持可选 props（用于 DirectSales 通用组件复用同一 lazy import 传不同 liveType）
function withSuspense(Comp: React.ComponentType<any>, props?: Record<string, any>): ReactNode {
  return (
    <Suspense fallback={<PageFallback />}>
      <Comp {...(props || {})} />
    </Suspense>
  );
}

/**
 * 受保护路由：未登录跳 /login?next=<当前位置>。
 * 仅在桌面版（Electron）启用认证流程；Web 开发版直接放行（后端 AUTH_ENABLED=false 时不要求 token）。
 *   - 桌面版（Electron）：无 token → 跳 /login
 *   - Web 开发版（浏览器）：直接访问（无论后端 AUTH_ENABLED）
 *   - 浏览器访问桌面版后端（AUTH_ENABLED=true）：401 拦截器跳 /login，/login 路由始终注册
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  if (featureFlags.showLoginPage && !token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const ConversionFunnelPage = lazy(() => import('@/pages/ConversionFunnel'));
const LeadsDetailPage = lazy(() => import('@/pages/LeadsDetail'));
const AgencyAnalysisPage = lazy(() => import('@/pages/AgencyAnalysis'));
const XhsNotesListPage = lazy(() => import('@/pages/XhsNotes/List'));
const XhsNotesOperationPage = lazy(() => import('@/pages/XhsNotes/Operation'));
const EmployeeConversionAnalysisPage = lazy(() => import('@/pages/EmployeeConversion/Analysis'));
const EmployeeConversionWeeklyPage = lazy(() => import('@/pages/EmployeeConversion/Weekly'));
const DataImportPage = lazy(() => import('@/pages/System/DataImport'));
const AccountManagementPage = lazy(() => import('@/pages/System/AccountManagement'));
const DatabaseBackupPage = lazy(() => import('@/pages/System/DatabaseBackup'));
// v3.5.3：移动端简化版数据同步页（仅下载，替代桌面端 DatabaseBackup 复杂逻辑）
const MobileDatabaseSyncPage = lazy(() => import('@/pages/System/MobileDatabaseSync'));
const OmniChannelReportPage = lazy(() => import('@/pages/Reports/OmniChannel'));

// 应用市场 v3.1: 拆为 4 个独立子报表
const AppMarketFunnelPage = lazy(() => import('@/pages/Reports/AppMarket/Funnel'));
const AppMarketComparisonPage = lazy(() => import('@/pages/Reports/AppMarket/Comparison'));
const AppMarketDetailPage = lazy(() => import('@/pages/Reports/AppMarket/Detail'));
// v3.3.10: Creative.tsx → PlanAnalysis.tsx（统一为"计划分析"命名）
const AppMarketPlanAnalysisPage = lazy(() => import('@/pages/Reports/AppMarket/PlanAnalysis'));
// v3.6.3: 应用市场 · 消耗和成本
const AppMarketCostAnalysisPage = lazy(() => import('@/pages/Reports/AppMarket/CostAnalysis'));
// v3.7.3: 应用市场 · 归因转化率分析
const AppMarketAttributionConversionPage = lazy(() => import('@/pages/Reports/AppMarket/AttributionConversion'));
// v3.8.2: 应用市场 · 广告计划分析（计划分解 + 下载链路 + 消耗）
const AppMarketAdPlanAnalysisPage = lazy(() => import('@/pages/Reports/AppMarket/AdPlanAnalysis'));

// 直播 v3.1
const LiveFunnelPage = lazy(() => import('@/pages/Live/Funnel'));
const LiveDirectSalesPage = lazy(() => import('@/pages/Live/DirectSales'));
const AnchorClusterPage = lazy(() => import('@/pages/AnchorCluster'));
const ReportGenerationPage = lazy(() => import('@/pages/ReportGeneration'));
const DouyinQingniaoReconciliationPage = lazy(() => import('@/pages/DataReconciliation/DouyinQingniao'));
// v3.3.10: 投放评审（内容平台二级菜单）
const InvestmentReviewPage = lazy(() => import('@/pages/InvestmentReview'));
// v3.3.10: 小红书计划分析（小红书二级菜单）
const XhsPlanAnalysisPage = lazy(() => import('@/pages/Reports/Xhs/PlanAnalysis'));
// v3.8.0: 分支KOS转化周报（小红书二级菜单，featureFlags.showKosWeekly 控制注册）
const XhsKosWeeklyPage = lazy(() => import('@/pages/XhsNotes/KosWeekly'));

// v3.5：移动端（Capacitor）使用 HashRouter，跳过登录路由和 ProtectedRoute
// v3.6.2：PWA 端也使用 HashRouter（部署在 /app/ 子路径，BrowserRouter 需 basename，
//   且 GitHub Pages 不支持 SPA fallback；HashRouter 无需服务端配置即可工作）
const isMobile = isMobileClient() || isPwaClient();

// 主布局子路由（移动端和桌面端共享）
// v3.5.4：被 features 开关禁用的功能路由也不注册，避免移动端通过 URL 直访触发未实现的 API
const mainChildren = [
  { index: true, element: <Navigate to="/omni-channel" replace /> },
  { path: 'dashboard', element: withSuspense(DashboardPage) },

  // v3.1 顶级菜单
  { path: 'omni-channel', element: withSuspense(OmniChannelReportPage) },

  { path: 'conversion-funnel', element: withSuspense(ConversionFunnelPage) },
  { path: 'leads-detail', element: withSuspense(LeadsDetailPage) },
  { path: 'anchor-clusters', element: withSuspense(AnchorClusterPage) },
  { path: 'agency-analysis', element: withSuspense(AgencyAnalysisPage) },
  {
    path: 'xhs-notes',
    children: [
      { path: 'list', element: withSuspense(XhsNotesListPage) },
      { path: 'operation', element: withSuspense(XhsNotesOperationPage) },
      // v3.3.10: 小红书计划分析
      { path: 'plan-analysis', element: withSuspense(XhsPlanAnalysisPage) },
      // v3.8.0: 分支KOS转化周报（移动端禁用，避免 URL 直访触发未实现的 mobile API）
      ...(featureFlags.showKosWeekly
        ? [{ path: 'kos-weekly', element: withSuspense(XhsKosWeeklyPage) }]
        : []),
    ],
  },
  {
    path: 'employee-conversion',
    children: [
      { path: 'analysis', element: withSuspense(EmployeeConversionAnalysisPage) },
      { path: 'weekly', element: withSuspense(EmployeeConversionWeeklyPage) },
    ],
  },
  // 应用市场 v3.1: 顶级菜单 + 4 子页
  {
    path: 'app-market',
    children: [
      { index: true, element: <Navigate to="/app-market/funnel" replace /> },
      { path: 'funnel', element: withSuspense(AppMarketFunnelPage) },
      { path: 'comparison', element: withSuspense(AppMarketComparisonPage) },
      { path: 'detail', element: withSuspense(AppMarketDetailPage) },
      // v3.3.10: 计划分析（应用市场）
      { path: 'plan-analysis', element: withSuspense(AppMarketPlanAnalysisPage) },
      // v3.3.10: 旧路径 creative 重定向到 plan-analysis
      { path: 'creative', element: <Navigate to="/app-market/plan-analysis" replace /> },
      // v3.6.3: 消耗和成本
      { path: 'cost-analysis', element: withSuspense(AppMarketCostAnalysisPage) },
      // v3.7.3: 归因转化率分析
      { path: 'attribution-conversion', element: withSuspense(AppMarketAttributionConversionPage) },
      // v3.8.2: 广告计划分析
      { path: 'ad-plan-analysis', element: withSuspense(AppMarketAdPlanAnalysisPage) },
    ],
  },
  // 直播 v3.1 占位
  {
    path: 'live',
    children: [
      { index: true, element: <Navigate to="/live/funnel" replace /> },
      { path: 'funnel', element: withSuspense(LiveFunnelPage) },
      { path: 'direct-sales', element: withSuspense(LiveDirectSalesPage, { liveType: '带货直播' }) },
      // v3.3.4: 投顾IP / 分析师 专项报表，复用 DirectSales 通用组件
      { path: 'advisor-ip', element: withSuspense(LiveDirectSalesPage, { liveType: '投顾IP' }) },
      { path: 'analyst', element: withSuspense(LiveDirectSalesPage, { liveType: '分析师' }) },
    ],
  },
  // v3.5.4：报告生成路由仅在有 showReportGeneration 的环境注册（移动端禁用）
  ...(featureFlags.showReportGeneration
    ? [{ path: 'report-generation', element: withSuspense(ReportGenerationPage) }]
    : []),
  // v3.6.1：抖音青鸟对账路由仅在 showDataReconciliation 环境注册（移动端禁用，避免 URL 直访触发未实现的 mobile API）
  ...(featureFlags.showDataReconciliation
    ? [{ path: 'data-reconciliation/douyin-qingniao', element: withSuspense(DouyinQingniaoReconciliationPage) }]
    : []),
  // v3.3.10: 投放评审（内容平台二级菜单）
  { path: 'investment-review', element: withSuspense(InvestmentReviewPage) },

  // v3.1 老路由重定向 (兼容旧链接)
  { path: 'reports/app-market', element: <Navigate to="/app-market/funnel" replace /> },
  { path: 'reports/omni-channel', element: <Navigate to="/omni-channel" replace /> },

  {
    path: 'system',
    children: [
      // v3.5.4：系统子菜单按 features 开关条件注册，移动端禁用数据导入/账号管理
      ...(featureFlags.showDataImport
        ? [{ path: 'data-import', element: withSuspense(DataImportPage) }]
        : []),
      ...(featureFlags.showAccountManagement
        ? [{ path: 'account-management', element: withSuspense(AccountManagementPage) }]
        : []),
      // v3.5.3：移动端/PWA 端走简化版同步页（避免触发未实现的 /webdav/list 等 API）
      ...(featureFlags.showDatabaseBackup
        ? [{ path: 'database-backup', element: withSuspense(isMobile ? MobileDatabaseSyncPage : DatabaseBackupPage) }]
        : []),
    ],
  },
];

const routes = isMobile
  ? [
      {
        path: '/',
        element: <MainLayout />,
        errorElement: <RouteErrorBoundary />,
        children: mainChildren,
      },
    ]
  : [
      {
        path: '/login',
        element: <LoginPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        errorElement: <RouteErrorBoundary />,
        children: mainChildren,
      },
    ];

const router = isMobile ? createHashRouter(routes) : createBrowserRouter(routes);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
