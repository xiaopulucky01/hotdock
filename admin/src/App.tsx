import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { RequireAuth } from './components/RequireAuth'
import { AiChatPage } from './pages/AiChatPage'
import { AuditPage } from './pages/AuditPage'
import { ConfigPage } from './pages/ConfigPage'
import { DashboardPage } from './pages/DashboardPage'
import { DemoPage } from './pages/DemoPage'
import { EventsPage } from './pages/EventsPage'
import { ExtensionsPage } from './pages/ExtensionsPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { JobsPage } from './pages/JobsPage'
import { LoginPage } from './pages/LoginPage'
import { ModulesPage } from './pages/ModulesPage'
import { RbacPage } from './pages/RbacPage'
import { RegisterPage } from './pages/RegisterPage'
import { StoragePage } from './pages/StoragePage'
import { TenantsPage } from './pages/TenantsPage'
import { UsersPage } from './pages/UsersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="modules" element={<ModulesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="tenants" element={<TenantsPage />} />
                <Route path="rbac" element={<RbacPage />} />
                <Route path="config" element={<ConfigPage />} />
                <Route path="features" element={<FeaturesPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="jobs" element={<JobsPage />} />
                <Route path="storage" element={<StoragePage />} />
                <Route path="extensions" element={<ExtensionsPage />} />
                <Route path="ai-chat" element={<AiChatPage />} />
                <Route path="demo" element={<DemoPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
