import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './components/Layout/AppShell'
import DashboardPage from './components/Dashboard/DashboardPage'
import AuditsListPage from './components/Audit/AuditsListPage'
import NewAuditPage from './components/Audit/NewAuditPage'
import AuditProgressPage from './components/Audit/AuditProgressPage'
import AuditResultsPage from './components/Results/AuditResultsPage'
import ReportViewPage from './components/Reports/ReportViewPage'
import FrameworkBrowser from './components/Framework/FrameworkBrowser'
// Quality Check — unified single-stage workflow
import QualityCheckBrowserPage from './components/QualityCheck/QualityCheckBrowserPage'
import QualityCheckPage from './components/QualityCheck/QualityCheckPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />

            {/* Sessions */}
            <Route path="sessions" element={<AuditsListPage />} />
            <Route path="sessions/new" element={<NewAuditPage />} />
            <Route path="sessions/:id/progress" element={<AuditProgressPage />} />
            <Route path="sessions/:id/results" element={<AuditResultsPage />} />
            <Route path="sessions/:id/report" element={<ReportViewPage />} />

            {/* Quality Check — unified workflow */}
            <Route path="sessions/:id/check" element={<QualityCheckBrowserPage />} />
            <Route path="sessions/:id/check/:questionId" element={<QualityCheckPage />} />

            {/* Legacy route redirects */}
            <Route path="sessions/:id/respond" element={<Navigate to="../check" relative="path" replace />} />
            <Route path="sessions/:id/respond/:qid" element={<Navigate to="../../check" relative="path" replace />} />
            <Route path="sessions/:id/review" element={<Navigate to="../check" relative="path" replace />} />
            <Route path="sessions/:id/review/:qid" element={<Navigate to="../../check" relative="path" replace />} />
            <Route path="audits" element={<Navigate to="/sessions" replace />} />
            <Route path="audits/new" element={<Navigate to="/sessions/new" replace />} />

            <Route path="framework" element={<FrameworkBrowser />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
