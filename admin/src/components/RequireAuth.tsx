import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { LoadingBlock } from './ui'

export function RequireAuth() {
  const { token, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingBlock label="正在恢复会话…" />
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
