import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import { lazy, Suspense, ReactNode } from 'react';
import MainLayout from '@/layouts/MainLayout';

// v3.2.5：所有页面改 React.lazy 按需加载，主包只保留 MainLayout，
// 首屏只拉当前路由对应的 chunk，避免一次加载全部 21 个页面 + 重型依赖（echarts/plots/framer-motion）。
// Suspense fallback 用一个轻量占位，避免闪烁的 antd Spin。
const PageFallback = () => (
  <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
    加载中...
  </div>
);

// 统一 lazy 包装：Suspense 边界 + 错误边界
function withSuspense(Comp: React.ComponentType<any>): ReactNode {
  return (
    <Suspense fallback={<PageFallback />}>
      <Comp />
    </Suspense>
  );
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
const OmniChannelReportPage = lazy(() => import('@/pages/Reports/OmniChannel'));

// 应用市场 v3.1: 拆为 4 个独立子报表
const AppMarketFunnelPage = lazy(() => import('@/pages/Reports/AppMarket/Funnel'));
const AppMarketComparisonPage = lazy(() => import('@/pages/Reports/AppMarket/Comparison'));
const AppMarketDetailPage = lazy(() => import('@/pages/Reports/AppMarket/Detail'));
const AppMarketCreativePage = lazy(() => import('@/pages/Reports/AppMarket/Creative'));

// 直播 v3.1
const LiveFunnelPage = lazy(() => import('@/pages/Live/Funnel'));
const AnchorClusterPage = lazy(() => import('@/pages/AnchorCluster'));
const ReportGenerationPage = lazy(() => import('@/pages/ReportGeneration'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
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
          { path: 'creative', element: withSuspense(AppMarketCreativePage) },
        ],
      },
      // 直播 v3.1 占位
      {
        path: 'live',
        children: [
          { index: true, element: <Navigate to="/live/funnel" replace /> },
          { path: 'funnel', element: withSuspense(LiveFunnelPage) },
        ],
      },
      { path: 'report-generation', element: withSuspense(ReportGenerationPage) },

      // v3.1 老路由重定向 (兼容旧链接)
      { path: 'reports/app-market', element: <Navigate to="/app-market/funnel" replace /> },
      { path: 'reports/omni-channel', element: <Navigate to="/omni-channel" replace /> },

      {
        path: 'system',
        children: [
          { path: 'data-import', element: withSuspense(DataImportPage) },
          { path: 'account-management', element: withSuspense(AccountManagementPage) },
          { path: 'database-backup', element: withSuspense(DatabaseBackupPage) },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
