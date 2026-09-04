import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { platformApi } from '../api'
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatUptime,
} from '../components/ui'

export function DashboardPage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: platformApi.health,
    refetchInterval: 10000,
  })
  const metricsQuery = useQuery({
    queryKey: ['metrics'],
    queryFn: platformApi.metrics,
    refetchInterval: 10000,
  })

  const health = healthQuery.data
  const metrics = metricsQuery.data
  const metricEntries = Object.entries(metrics ?? {})

  return (
    <div>
      <PageHeader
        title="控制台"
        description="平台健康状态、模块摘要与运行指标"
      />
      <ErrorBanner error={healthQuery.error ?? metricsQuery.error} />
      {healthQuery.isLoading || metricsQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: '1rem' }}>
            <div className="card card-pad stat-card">
              <div className="stat-label">健康状态</div>
              <div className="stat-value">
                <StatusBadge status={health?.status ?? 'down'} />
              </div>
            </div>
            <div className="card card-pad stat-card">
              <div className="stat-label">运行时长</div>
              <div className="stat-value">
                {formatUptime(health?.uptimeSec ?? 0)}
              </div>
            </div>
            <div className="card card-pad stat-card">
              <div className="stat-label">模块数量</div>
              <div className="stat-value">{health?.modules.length ?? 0}</div>
            </div>
            <div className="card card-pad stat-card">
              <div className="stat-label">指标项数</div>
              <div className="stat-value">{metricEntries.length}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <strong>健康检查</strong>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>状态</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health?.checks ?? {}).map(([name, check]) => (
                      <tr key={name}>
                        <td className="mono">{name}</td>
                        <td>
                          <StatusBadge status={check.status} />
                        </td>
                        <td className="muted">{check.detail ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <strong>模块</strong>
                <Link to="/app/modules" style={{ float: 'right', fontSize: '0.85rem' }}>
                  管理 →
                </Link>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(health?.modules ?? []).map((m) => (
                      <tr key={m.name}>
                        <td className="mono">{m.name}</td>
                        <td>
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
              <strong>运行指标</strong>
            </div>
            {metricEntries.length === 0 ? (
              <div className="empty">暂无指标</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>键</th>
                      <th>值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricEntries.map(([key, value]) => (
                      <tr key={key}>
                        <td className="mono">{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
