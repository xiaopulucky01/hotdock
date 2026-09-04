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

export function NotificationsPage() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState('*')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<unknown>(null)

  const webhooksQuery = useQuery({
    queryKey: ['webhooks'],
    queryFn: platformApi.listWebhooks,
  })

  const recentQuery = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: () => platformApi.recentNotifications(50),
    refetchInterval: 8000,
  })

  const registerMut = useMutation({
    mutationFn: () =>
      platformApi.registerWebhook({
        url: url.trim(),
        events: events
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        secret: secret.trim() || undefined,
      }),
    onSuccess: () => {
      setError(null)
      setUrl('')
      setSecret('')
      void qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: (err) => setError(err),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => platformApi.removeWebhook(id),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: (err) => setError(err),
  })

  function onRegister(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    registerMut.mutate()
  }

  return (
    <div>
      <PageHeader
        title="通知 / Webhook"
        description="注册外部回调并查看近期投递记录（可分布式对接）"
      />
      <ErrorBanner
        error={webhooksQuery.error ?? recentQuery.error ?? error}
      />

      <form
        className="card card-pad"
        onSubmit={onRegister}
        style={{ marginBottom: '1rem' }}
      >
        <div className="grid-2">
          <div className="field">
            <label htmlFor="whUrl">回调 URL</label>
            <input
              id="whUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:4000/hooks"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="whEvents">事件（逗号分隔，* = 全部）</label>
            <input
              id="whEvents"
              value={events}
              onChange={(e) => setEvents(e.target.value)}
              placeholder="*"
              required
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="whSecret">签名密钥（可选，请求头 X-Webhook-Secret）</label>
          <input
            id="whSecret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          className="btn"
          type="submit"
          style={{ marginTop: '0.85rem' }}
          disabled={registerMut.isPending}
        >
          注册 Webhook
        </button>
      </form>

      <div className="grid-2">
        <div>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>
            已注册端点
          </h3>
          {webhooksQuery.isLoading ? (
            <LoadingBlock />
          ) : (webhooksQuery.data?.length ?? 0) === 0 ? (
            <EmptyState>暂无 Webhook</EmptyState>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>事件</th>
                      <th>状态</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {webhooksQuery.data!.map((wh) => (
                      <tr key={wh.id}>
                        <td className="mono" style={{ maxWidth: 220, wordBreak: 'break-all' }}>
                          {wh.url}
                        </td>
                        <td className="mono muted">
                          {wh.events.join(', ')}
                        </td>
                        <td>
                          <StatusBadge
                            status={wh.active ? 'active' : 'inactive'}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={removeMut.isPending}
                            onClick={() => removeMut.mutate(wh.id)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>
            近期投递
          </h3>
          {recentQuery.isLoading ? (
            <LoadingBlock />
          ) : (recentQuery.data?.length ?? 0) === 0 ? (
            <EmptyState>暂无投递记录</EmptyState>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>事件</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(recentQuery.data ?? [])].reverse().map((n) => (
                      <tr key={n.id}>
                        <td>{formatDate(n.at)}</td>
                        <td className="mono">{n.event}</td>
                        <td>
                          <StatusBadge status={n.status} />
                          {n.error ? (
                            <div className="muted" style={{ fontSize: '0.8rem' }}>
                              {n.error}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
