import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function RequireAuth() {
  const { token, loading } = useAuth()

  if (loading) {
    return <div className="loading-block">加载中…</div>
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
