import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
} from '../components/ui'

export function TenantsPage() {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['tenants'],
    queryFn: platformApi.listTenants,
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
    create.mutate()
  }

  return (
    <div>
      <PageHeader title="租户" description="多租户管理" />
      <ErrorBanner error={query.error ?? error} />

      <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
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
