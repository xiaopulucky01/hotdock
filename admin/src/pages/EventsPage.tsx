import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDate,
} from '../components/ui'

export function EventsPage() {
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('50')
  const [expanded, setExpanded] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['events', name, limit],
    queryFn: () =>
      platformApi.recentEvents({
        name: name || undefined,
        limit: Number(limit) || 50,
      }),
    refetchInterval: 5000,
  })

  const events = [...(query.data ?? [])].reverse()

  return (
    <div>
      <PageHeader title="事件" description="事件总线近期事件（自动刷新）" />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="eventName">事件名称</label>
          <input
            id="eventName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="platform.module.enabled"
          />
        </div>
        <div className="field">
          <label htmlFor="limit">条数</label>
          <input id="limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
      </div>
      <ErrorBanner error={query.error} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : events.length === 0 ? (
        <EmptyState>暂无事件</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>名称</th>
                  <th>来源</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => (
                  <Fragment key={`${ev.name}-${ev.occurredAt}-${idx}`}>
                    <tr>
                      <td>{formatDate(ev.occurredAt)}</td>
                      <td className="mono">{ev.name}</td>
                      <td className="mono">{ev.source}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setExpanded(expanded === idx ? null : idx)
                          }
                        >
                          {expanded === idx ? '收起' : '载荷'}
                        </button>
                      </td>
                    </tr>
                    {expanded === idx ? (
                      <tr>
                        <td colSpan={4}>
                          <pre className="pre-json">
                            {JSON.stringify(ev.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
