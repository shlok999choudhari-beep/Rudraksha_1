import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import AuthenticatedLayout from '@/app/(app)/layout';
import LoginPage from '@/app/login/page';
import DashboardPage from '@/app/(app)/dashboard/page';
import ScreeningQueuePage from '@/app/(app)/screening/page';
import NewScreeningPage from '@/app/(app)/screening/new/page';
import ScreeningResultPage from '@/app/(app)/screening/[caseId]/page';
import CasesPage from '@/app/(app)/cases/page';
import CaseDetailsPage from '@/app/(app)/cases/[caseId]/page';
import AnalyticsPage from '@/app/(app)/analytics/page';
import AuditLogsPage from '@/app/(app)/audit-logs/page';
import SettingsPage from '@/app/(app)/settings/page';
import DemoDocsPage from '@/app/(app)/demo-docs/page';
import OfficerCockpitPage from '@/pages/OfficerCockpitPage';

export function App() {
  return (
    <ToastProvider>
      <QueryProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Authenticated Console Routes */}
              <Route
                path="/"
                element={
                  <AuthenticatedLayout>
                    <Navigate to="/dashboard" replace />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <AuthenticatedLayout>
                    <DashboardPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/screening"
                element={
                  <AuthenticatedLayout>
                    <ScreeningQueuePage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/screening/cockpit"
                element={
                  <AuthenticatedLayout>
                    <OfficerCockpitPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/screening/new"
                element={
                  <AuthenticatedLayout>
                    <NewScreeningPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/demo-docs"
                element={
                  <AuthenticatedLayout>
                    <DemoDocsPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/screening/:caseId"
                element={
                  <AuthenticatedLayout>
                    <ScreeningResultPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/cases"
                element={
                  <AuthenticatedLayout>
                    <CasesPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/cases/:caseId"
                element={
                  <AuthenticatedLayout>
                    <CaseDetailsPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/analytics"
                element={
                  <AuthenticatedLayout>
                    <AnalyticsPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/audit-logs"
                element={
                  <AuthenticatedLayout>
                    <AuditLogsPage />
                  </AuthenticatedLayout>
                }
              />

              <Route
                path="/settings"
                element={
                  <AuthenticatedLayout>
                    <SettingsPage />
                  </AuthenticatedLayout>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryProvider>
    </ToastProvider>
  );
}

export default App;
