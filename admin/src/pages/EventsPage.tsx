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

type Tab = 'recent' | 'dead-letters'

export function EventsPage() {
  const [tab, setTab] = useState<Tab>('recent')
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('50')
  const [expanded, setExpanded] = useState<number | null>(null)

  const recentQuery = useQuery({
    queryKey: ['events', name, limit],
    queryFn: () =>
      platformApi.recentEvents({
        name: name || undefined,
        limit: Number(limit) || 50,
      }),
    refetchInterval: 5000,
    enabled: tab === 'recent',
  })

  const dlqQuery = useQuery({
    queryKey: ['dead-letters', limit],
    queryFn: () => platformApi.listDeadLetters(Number(limit) || 50),
    refetchInterval: 5000,
    enabled: tab === 'dead-letters',
  })

  const events = [...(recentQuery.data ?? [])].reverse()
  const deadLetters = [...(dlqQuery.data ?? [])].reverse()

  return (
    <div>
      <PageHeader
        title="事件"
        description="事件总线近期事件与死信队列（自动刷新）"
      />

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn btn-sm${tab === 'recent' ? '' : ' btn-ghost'}`}
          onClick={() => {
            setTab('recent')
            setExpanded(null)
          }}
        >
          近期事件
        </button>
        <button
          type="button"
          className={`btn btn-sm${tab === 'dead-letters' ? '' : ' btn-ghost'}`}
          onClick={() => {
            setTab('dead-letters')
            setExpanded(null)
          }}
        >
          死信队列
        </button>
      </div>

      <div className="toolbar">
        {tab === 'recent' ? (
          <div className="field">
            <label htmlFor="eventName">事件名称</label>
            <input
              id="eventName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="platform.module.enabled"
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="limit">条数</label>
          <input
            id="limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
      </div>

      {tab === 'recent' ? (
        <>
          <ErrorBanner error={recentQuery.error} />
          {recentQuery.isLoading ? (
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
                      <th>租户</th>
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
                          <td className="mono muted">{ev.tenantId ?? '—'}</td>
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
                            <td colSpan={5}>
                              <pre className="pre-json">
                                {JSON.stringify(
                                  {
                                    payload: ev.payload,
                                    correlationId: ev.correlationId,
                                    userId: ev.userId,
                                  },
                                  null,
                                  2,
                                )}
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
        </>
      ) : (
        <>
          <ErrorBanner error={dlqQuery.error} />
          {dlqQuery.isLoading ? (
            <LoadingBlock />
          ) : deadLetters.length === 0 ? (
            <EmptyState>暂无死信</EmptyState>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>事件</th>
                      <th>尝试</th>
                      <th>错误</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {deadLetters.map((entry, idx) => (
                      <Fragment key={`${entry.at}-${idx}`}>
                        <tr>
                          <td>{formatDate(entry.at)}</td>
                          <td className="mono">{entry.event.name}</td>
                          <td>{entry.attempts}</td>
                          <td className="muted" style={{ maxWidth: 280 }}>
                            {entry.error}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                setExpanded(expanded === idx ? null : idx)
                              }
                            >
                              {expanded === idx ? '收起' : '详情'}
                            </button>
                          </td>
                        </tr>
                        {expanded === idx ? (
                          <tr>
                            <td colSpan={5}>
                              <pre className="pre-json">
                                {JSON.stringify(entry.event, null, 2)}
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
        </>
      )}
    </div>
  )
}
