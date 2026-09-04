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

export function JobsPage() {
  const [module, setModule] = useState('')
  const query = useQuery({
    queryKey: ['jobs', module],
    queryFn: () => platformApi.listJobs(module || undefined),
    refetchInterval: 5000,
  })

  return (
    <div>
      <PageHeader title="定时任务" description="定时任务调度状态" />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="module">模块</label>
          <input id="module" value={module} onChange={(e) => setModule(e.target.value)} />
        </div>
      </div>
      <ErrorBanner error={query.error} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState>暂无任务</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>模块</th>
                  <th>间隔</th>
                  <th>状态</th>
                  <th>上次运行</th>
                  <th>错误</th>
                </tr>
              </thead>
              <tbody>
                {query.data!.map((j) => (
                  <tr key={`${j.module}:${j.name}`}>
                    <td className="mono">{j.name}</td>
                    <td className="mono">{j.module}</td>
                    <td>{j.intervalMs} 毫秒</td>
                    <td>
                      <StatusBadge status={j.enabled === false ? 'disabled' : 'enabled'} />
                    </td>
                    <td>{formatDate(j.lastRunAt)}</td>
                    <td className="muted">{j.lastError ?? '—'}</td>
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
