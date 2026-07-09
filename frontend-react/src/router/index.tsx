import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/Dashboard';
import ConversionFunnelPage from '@/pages/ConversionFunnel';
import LeadsDetailPage from '@/pages/LeadsDetail';
import AgencyAnalysisPage from '@/pages/AgencyAnalysis';
import XhsNotesListPage from '@/pages/XhsNotes/List';
import EmployeeConversionAnalysisPage from '@/pages/EmployeeConversion/Analysis';
import EmployeeConversionWeeklyPage from '@/pages/EmployeeConversion/Weekly';
import DataImportPage from '@/pages/System/DataImport';
import AccountManagementPage from '@/pages/System/AccountManagement';
import AbbreviationManagementPage from '@/pages/System/AbbreviationManagement';
import DatabaseBackupPage from '@/pages/System/DatabaseBackup';
import OmniChannelReportPage from '@/pages/Reports/OmniChannel';

// 应用市场 v3.1: 拆为 4 个独立子报表 (v3.1 §六)
import AppMarketFunnelPage from '@/pages/Reports/AppMarket/Funnel';
import AppMarketComparisonPage from '@/pages/Reports/AppMarket/Comparison';
import AppMarketDetailPage from '@/pages/Reports/AppMarket/Detail';
import AppMarketCreativePage from '@/pages/Reports/AppMarket/Creative';

// 直播 v3.1 占位 (v3.1 §八)
import LiveFunnelPage from '@/pages/Live/Funnel';
import AnchorClusterPage from '@/pages/AnchorCluster';

// React.lazy 包装用于运营分析 + 报告生成 等大页面，按需加载 (v3.1 §四)
const LazyXhsNotesOperation = lazy(() => import('@/pages/XhsNotes/Operation').then((m) => ({ default: m.default })));
const LazyReportGeneration = lazy(() => import('@/pages/ReportGeneration').then((m) => ({ default: m.default })));

const PageFallback = () => <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>加载中...</div>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/omni-channel" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // v3.1 顶级菜单
      { path: 'omni-channel', element: <OmniChannelReportPage /> },

      { path: 'conversion-funnel', element: <ConversionFunnelPage /> },
      { path: 'leads-detail', element: <LeadsDetailPage /> },
      { path: 'anchor-clusters', element: <AnchorClusterPage /> },
      { path: 'agency-analysis', element: <AgencyAnalysisPage /> },
      {
        path: 'xhs-notes',
        children: [
          { path: 'list', element: <XhsNotesListPage /> },
          { path: 'operation', element: (
            <Suspense fallback={<PageFallback />}>
              <LazyXhsNotesOperation />
            </Suspense>
          ) },
        ],
      },
      {
        path: 'employee-conversion',
        children: [
          { path: 'analysis', element: <EmployeeConversionAnalysisPage /> },
          { path: 'weekly', element: <EmployeeConversionWeeklyPage /> },
        ],
      },
      // 应用市场 v3.1: 顶级菜单 + 4 子页
      {
        path: 'app-market',
        children: [
          { index: true, element: <Navigate to="/app-market/funnel" replace /> },
          { path: 'funnel', element: <AppMarketFunnelPage /> },
          { path: 'comparison', element: <AppMarketComparisonPage /> },
          { path: 'detail', element: <AppMarketDetailPage /> },
          { path: 'creative', element: <AppMarketCreativePage /> },
        ],
      },
      // 直播 v3.1 占位
      {
        path: 'live',
        children: [
          { index: true, element: <Navigate to="/live/funnel" replace /> },
          { path: 'funnel', element: <LiveFunnelPage /> },
        ],
      },
      { path: 'report-generation', element: (
        <Suspense fallback={<PageFallback />}>
          <LazyReportGeneration />
        </Suspense>
      ) },

      // v3.1 老路由重定向 (兼容旧链接)
      { path: 'reports/app-market', element: <Navigate to="/app-market/funnel" replace /> },
      { path: 'reports/omni-channel', element: <Navigate to="/omni-channel" replace /> },

      {
        path: 'system',
        children: [
          { path: 'data-import', element: <DataImportPage /> },
          { path: 'account-management', element: <AccountManagementPage /> },
          { path: 'abbreviation-management', element: <AbbreviationManagementPage /> },
          { path: 'database-backup', element: <DatabaseBackupPage /> },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
