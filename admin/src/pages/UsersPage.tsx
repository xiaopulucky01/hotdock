import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
} from '../components/ui'

export function UsersPage() {
  const [tenantId, setTenantId] = useState('')
  const query = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => platformApi.listUsers(tenantId || undefined),
  })

  return (
    <div>
      <PageHeader
        title="用户"
        description="登录账号；归属某个租户，通过角色获得权限"
      />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="tenantFilter">按租户过滤</label>
          <input
            id="tenantFilter"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenant_default"
          />
        </div>
      </div>
      <ErrorBanner error={query.error} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState>暂无用户</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>邮箱</th>
                  <th>租户</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {query.data!.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      <div className="mono muted" style={{ fontSize: '0.75rem' }}>
                        {u.id}
                      </div>
                    </td>
                    <td>{u.email ?? '—'}</td>
                    <td className="mono">{u.tenantId ?? '—'}</td>
                    <td className="mono">{u.roleIds.join(', ')}</td>
                    <td>
                      <StatusBadge status={u.active ? 'enabled' : 'disabled'}>
                        {u.active ? '启用' : '停用'}
                      </StatusBadge>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
