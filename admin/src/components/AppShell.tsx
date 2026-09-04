import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const NAV = [
  {
    label: '概览',
    items: [{ to: '/app', end: true, label: '控制台' }],
  },
  {
    label: '平台',
    items: [
      { to: '/app/modules', label: '模块管理' },
      { to: '/app/users', label: '用户' },
      { to: '/app/tenants', label: '租户' },
      { to: '/app/rbac', label: '角色权限' },
      { to: '/app/config', label: '配置' },
      { to: '/app/features', label: '特性开关' },
      { to: '/app/audit', label: '审计日志' },
      { to: '/app/events', label: '事件' },
      { to: '/app/jobs', label: '定时任务' },
      { to: '/app/storage', label: '对象存储' },
      { to: '/app/extensions', label: '扩展点' },
    ],
  },
  {
    label: '业务模块',
    items: [
      { to: '/app/ai-chat', label: 'AI 对话' },
      { to: '/app/demo', label: '演示模块' },
    ],
  },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>AI Nest 平台</h1>
          <p>热插拔模块管理台</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{user?.username ?? '—'}</div>
          <div className="user-meta">
            {(user?.roles ?? []).join(', ') || '暂无角色'}
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="muted">平台管理</div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            退出登录
          </button>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
