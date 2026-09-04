import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner } from '../components/ui'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await register({
        username,
        password,
        email: email || undefined,
        tenantId: tenantId || undefined,
      })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>创建账号</h1>
        <p className="subtitle">注册后使用新账号登录管理台</p>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">邮箱（可选）</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tenantId">租户 ID（可选）</label>
          <input
            id="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? '提交中…' : '注册'}
        </button>
        <p className="footer-link">
          已有账号？ <Link to="/login">去登录</Link>
        </p>
      </form>
    </div>
  )
}
