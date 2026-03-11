import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/Dashboard';
import ConversionFunnelPage from '@/pages/ConversionFunnel';
import LeadsDetailPage from '@/pages/LeadsDetail';
import AgencyAnalysisPage from '@/pages/AgencyAnalysis';
import XhsNotesListPage from '@/pages/XhsNotes/List';
import XhsNotesOperationPage from '@/pages/XhsNotes/Operation';
import EmployeeConversionAnalysisPage from '@/pages/EmployeeConversion/Analysis';
import EmployeeConversionWeeklyPage from '@/pages/EmployeeConversion/Weekly';
import DataImportPage from '@/pages/System/DataImport';
import AccountManagementPage from '@/pages/System/AccountManagement';
import AbbreviationManagementPage from '@/pages/System/AbbreviationManagement';
import DatabaseBackupPage from '@/pages/System/DatabaseBackup';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'conversion-funnel', element: <ConversionFunnelPage /> },
      { path: 'leads-detail', element: <LeadsDetailPage /> },
      { path: 'agency-analysis', element: <AgencyAnalysisPage /> },
      {
        path: 'xhs-notes',
        children: [
          { path: 'list', element: <XhsNotesListPage /> },
          { path: 'operation', element: <XhsNotesOperationPage /> },
        ],
      },
      {
        path: 'employee-conversion',
        children: [
          { path: 'analysis', element: <EmployeeConversionAnalysisPage /> },
          { path: 'weekly', element: <EmployeeConversionWeeklyPage /> },
        ],
      },
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