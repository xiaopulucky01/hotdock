import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner } from '../components/ui'

export function LoginPage() {
  const { login, token, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [tenantId, setTenantId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && token) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password, tenantId || undefined)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>AI Nest 平台</h1>
        <p className="subtitle">登录热插拔模块管理台</p>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="tenantId">租户 ID（可选）</label>
          <input
            id="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenant_default"
          />
        </div>
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? '登录中…' : '登录'}
        </button>
        <p className="footer-link">
          还没有账号？ <Link to="/register">注册</Link>
        </p>
        <p className="footer-link muted" style={{ marginTop: '0.5rem' }}>
          开发账号 admin / admin123
        </p>
      </form>
    </div>
  )
}
