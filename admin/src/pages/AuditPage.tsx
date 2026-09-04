import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDate,
} from '../components/ui'

export function AuditPage() {
  const [module, setModule] = useState('')
  const [actorId, setActorId] = useState('')
  const [limit, setLimit] = useState('100')

  const query = useQuery({
    queryKey: ['audit', module, actorId, limit],
    queryFn: () =>
      platformApi.listAudit({
        module: module || undefined,
        actorId: actorId || undefined,
        limit: Number(limit) || 100,
      }),
  })

  return (
    <div>
      <PageHeader title="审计日志" description="查看平台操作审计记录" />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="module">模块</label>
          <input id="module" value={module} onChange={(e) => setModule(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="actorId">操作人 ID</label>
          <input id="actorId" value={actorId} onChange={(e) => setActorId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="limit">条数</label>
          <input id="limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
      </div>
      <ErrorBanner error={query.error} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState>暂无审计记录</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>模块</th>
                  <th>操作人</th>
                  <th>资源</th>
                </tr>
              </thead>
              <tbody>
                {[...query.data!].reverse().map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.at)}</td>
                    <td className="mono">{e.action}</td>
                    <td className="mono">{e.module}</td>
                    <td className="mono">{e.actorId ?? '—'}</td>
                    <td>{e.resource ?? '—'}</td>
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
