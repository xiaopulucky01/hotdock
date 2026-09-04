import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from '../components/ui'

export function CachePage() {
  const qc = useQueryClient()
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [hint, setHint] = useState<string | null>(null)

  const statsQuery = useQuery({
    queryKey: ['cache-stats'],
    queryFn: platformApi.cacheStats,
  })

  const clearMut = useMutation({
    mutationFn: () => platformApi.clearCache(prefix.trim() || undefined),
    onSuccess: () => {
      setError(null)
      setHint(prefix.trim() ? `已清理前缀「${prefix.trim()}」` : '已清空全部缓存')
      void qc.invalidateQueries({ queryKey: ['cache-stats'] })
    },
    onError: (err) => {
      setHint(null)
      setError(err)
    },
  })

  function onClear(e: FormEvent) {
    e.preventDefault()
    clearMut.mutate()
  }

  return (
    <div>
      <PageHeader
        title="缓存"
        description="进程内 TTL 缓存；可按前缀失效（后续可换 Redis）"
      />
      <ErrorBanner error={statsQuery.error ?? error} />

      {statsQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="card card-pad" style={{ marginBottom: '1rem' }}>
          <div className="stat-label">状态</div>
          <div style={{ marginTop: '0.35rem' }}>
            <StatusBadge status={statsQuery.data?.ok ? 'ok' : 'down'} />
          </div>
          {statsQuery.data?.message ? (
            <p className="muted" style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
              {statsQuery.data.message}
            </p>
          ) : null}
        </div>
      )}

      <form className="card card-pad" onSubmit={onClear}>
        <div className="field" style={{ marginBottom: '0.65rem' }}>
          <label htmlFor="cachePrefix">前缀（可选，空则全部清空）</label>
          <input
            id="cachePrefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="ai-chat."
          />
        </div>
        <button
          className="btn btn-danger"
          type="submit"
          disabled={clearMut.isPending}
        >
          {clearMut.isPending ? '清理中…' : '清理缓存'}
        </button>
        {hint ? (
          <p className="muted" style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
            {hint}
          </p>
        ) : null}
      </form>
    </div>
  )
}
