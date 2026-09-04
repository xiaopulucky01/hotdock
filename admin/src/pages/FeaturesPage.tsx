import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

export function FeaturesPage() {
  const qc = useQueryClient()
  const [newFlag, setNewFlag] = useState('')
  const [error, setError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['features'],
    queryFn: platformApi.listFeatures,
  })

  const setMut = useMutation({
    mutationFn: ({ flag, enabled }: { flag: string; enabled: boolean }) =>
      platformApi.setFeature(flag, enabled),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['features'] })
    },
    onError: (err) => setError(err),
  })

  const entries = Object.entries(query.data ?? {})

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newFlag.trim()) return
    setMut.mutate(
      { flag: newFlag.trim(), enabled: true },
      {
        onSuccess: () => setNewFlag(''),
      },
    )
  }

  return (
    <div>
      <PageHeader title="特性开关" description="控制平台与模块的功能开关" />
      <ErrorBanner error={query.error ?? error} />

      <form className="card card-pad" onSubmit={onCreate} style={{ marginBottom: '1rem' }}>
        <div className="field" style={{ marginBottom: '0.65rem' }}>
          <label htmlFor="newFlag">新增开关</label>
          <input
            id="newFlag"
            value={newFlag}
            onChange={(e) => setNewFlag(e.target.value)}
            placeholder="my.feature.enabled"
          />
        </div>
        <button className="btn" type="submit" disabled={setMut.isPending}>
          创建并启用
        </button>
      </form>

      {query.isLoading ? (
        <LoadingBlock />
      ) : entries.length === 0 ? (
        <EmptyState>暂无特性开关</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>开关</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([flag, enabled]) => (
                  <tr key={flag}>
                    <td className="mono">{flag}</td>
                    <td>
                      <button
                        type="button"
                        className={`toggle${enabled ? ' on' : ''}`}
                        aria-pressed={enabled}
                        disabled={setMut.isPending}
                        onClick={() => setMut.mutate({ flag, enabled: !enabled })}
                        title={enabled ? '关闭' : '开启'}
                      />
                      <span style={{ marginLeft: '0.5rem' }} className="muted">
                        {enabled ? '开' : '关'}
                      </span>
                    </td>
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
