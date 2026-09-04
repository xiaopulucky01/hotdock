import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
} from '../components/ui'

export function TenantsPage() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('platform.tenant.read')
  const canCreate = hasPermission('platform.tenant.create')
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['tenants'],
    queryFn: platformApi.listTenants,
    enabled: canRead,
  })

  const create = useMutation({
    mutationFn: () => platformApi.createTenant({ code, name }),
    onSuccess: () => {
      setCode('')
      setName('')
      setError(null)
      void qc.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => setError(err),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    create.mutate()
  }

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="租户"
          description="租户由平台开户创建；员工账号归属租户，不可管理全部公司"
        />
        <EmptyState>当前账号无查看租户权限（需要 platform.tenant.read）</EmptyState>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="租户"
        description="公司/组织（平台开户）。员工账号归属租户，不能自行创建租户"
      />
      <ErrorBanner error={query.error ?? error} />

      {canCreate ? (
        <form
          className="card card-pad"
          onSubmit={onSubmit}
          style={{ marginBottom: '1rem' }}
        >
          <div style={{ marginBottom: '0.65rem' }}>
            <strong>平台开户</strong>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              仅拥有 platform.tenant.create 的平台管理员可创建
            </p>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="code">编码</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="acme"
              />
            </div>
            <div className="field">
              <label htmlFor="name">名称</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="示例公司"
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            创建租户
          </button>
        </form>
      ) : null}

      {query.isLoading ? (
        <LoadingBlock />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState>暂无租户</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>ID</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {query.data!.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.code}</td>
                    <td>{t.name}</td>
                    <td className="mono">{t.id}</td>
                    <td>
                      <StatusBadge status={t.active ? 'enabled' : 'disabled'}>
                        {t.active ? '启用' : '停用'}
                      </StatusBadge>
                    </td>
                    <td>{formatDate(t.createdAt)}</td>
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
