import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { platformApi } from '../api'
import { useAuth } from '../auth/AuthProvider'

type NavItem = {
  to: string
  label: string
  end?: boolean
  /** If set, nav item is shown only when the user has this permission */
  permission?: string
}

const NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: '概览',
    items: [{ to: '/app', end: true, label: '控制台' }],
  },
  {
    label: '平台',
    items: [
      { to: '/app/modules', label: '模块管理', permission: 'platform.module.manage' },
      { to: '/app/users', label: '用户', permission: 'platform.user.read' },
      { to: '/app/tenants', label: '租户', permission: 'platform.tenant.read' },
      { to: '/app/rbac', label: '角色权限', permission: 'platform.user.read' },
      { to: '/app/config', label: '配置', permission: 'platform.config.manage' },
      { to: '/app/features', label: '特性开关', permission: 'platform.config.manage' },
      { to: '/app/audit', label: '审计日志', permission: 'platform.audit.read' },
      { to: '/app/events', label: '事件', permission: 'platform.audit.read' },
      {
        to: '/app/notifications',
        label: '通知 / Webhook',
        permission: 'platform.config.manage',
      },
      { to: '/app/jobs', label: '定时任务', permission: 'platform.config.manage' },
      { to: '/app/cache', label: '缓存', permission: 'platform.config.manage' },
      { to: '/app/storage', label: '对象存储', permission: 'platform.config.manage' },
      { to: '/app/extensions', label: '扩展点', permission: 'platform.config.manage' },
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
  const { user, tenantId, setTenantId, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canManageTenants = hasPermission('platform.tenant.read')

  const tenantsQuery = useQuery({
    queryKey: ['tenants'],
    queryFn: platformApi.listTenants,
    enabled: canManageTenants,
  })

  const tenants = tenantsQuery.data ?? []
  const currentTenant = tenants.find((t) => t.id === tenantId)
  const membershipLabel =
    currentTenant?.code ??
    user?.tenantId ??
    (tenantId || null)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Hotdock</h1>
          <p>热插拔模块管理台</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((group) => {
            const items = group.items.filter(
              (item) => !item.permission || hasPermission(item.permission),
            )
            if (items.length === 0) return null
            return (
              <div className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    className={({ isActive }) =>
                      `nav-link${isActive ? ' active' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-name">{user?.username ?? '—'}</div>
            <div className="user-meta">
              {(user?.roles ?? []).join(', ') || '暂无角色'}
            </div>
            {canManageTenants ? (
              <label className="sidebar-tenant" htmlFor="shellTenant">
                <span className="sidebar-tenant-label">租户</span>
                <select
                  id="shellTenant"
                  className="sidebar-tenant-select"
                  value={tenantId ?? ''}
                  title={
                    currentTenant
                      ? `${currentTenant.code} · ${currentTenant.name}`
                      : '未指定租户'
                  }
                  onChange={(e) => {
                    setTenantId(e.target.value || null)
                    void qc.invalidateQueries()
                  }}
                >
                  <option value="">未指定</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </label>
            ) : membershipLabel ? (
              <div className="sidebar-tenant sidebar-tenant-readonly">
                <span className="sidebar-tenant-label">所属租户</span>
                <span className="sidebar-tenant-value" title={membershipLabel}>
                  {membershipLabel.replace(/^tenant_/, '')}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            退出
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
