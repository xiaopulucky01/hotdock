import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

export function RbacPage() {
  const [module, setModule] = useState('')
  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: platformApi.listRoles,
  })
  const permsQuery = useQuery({
    queryKey: ['permissions', module],
    queryFn: () => platformApi.listPermissions(module || undefined),
  })

  return (
    <div>
      <PageHeader title="角色权限" description="角色与权限" />
      <ErrorBanner error={rolesQuery.error ?? permsQuery.error} />

      <div className="grid-2">
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <strong>角色</strong>
          </div>
          {rolesQuery.isLoading ? (
            <LoadingBlock />
          ) : (rolesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState>暂无角色</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>编码</th>
                    <th>名称</th>
                    <th>权限</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesQuery.data!.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.code}</td>
                      <td>
                        {r.name}
                        {r.system ? <span className="muted"> · 系统</span> : null}
                      </td>
                      <td className="mono" style={{ fontSize: '0.78rem' }}>
                        {r.permissionCodes.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <strong>权限</strong>
            <div className="field" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
              <label htmlFor="moduleFilter">按模块过滤</label>
              <input
                id="moduleFilter"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="ai-chat / platform / demo"
              />
            </div>
          </div>
          {permsQuery.isLoading ? (
            <LoadingBlock />
          ) : (permsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState>暂无权限</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>编码</th>
                    <th>名称</th>
                    <th>模块</th>
                  </tr>
                </thead>
                <tbody>
                  {permsQuery.data!.map((p) => (
                    <tr key={p.code}>
                      <td className="mono">{p.code}</td>
                      <td>{p.name}</td>
                      <td className="mono">{p.module ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
