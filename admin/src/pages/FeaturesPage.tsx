import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import type { FeatureFlagRecord } from '../api/types'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

function parseTenants(raw: string): string[] | undefined {
  const list = raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length ? list : undefined
}

export function FeaturesPage() {
  const qc = useQueryClient()
  const [newFlag, setNewFlag] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [drafts, setDrafts] = useState<
    Record<string, { tenants: string; percentage: string }>
  >({})

  const query = useQuery({
    queryKey: ['features-detailed'],
    queryFn: platformApi.listFeaturesDetailed,
  })

  useEffect(() => {
    if (!query.data) return
    const next: Record<string, { tenants: string; percentage: string }> = {}
    for (const [flag, rec] of Object.entries(query.data)) {
      next[flag] = {
        tenants: (rec.tenants ?? []).join(', '),
        percentage:
          typeof rec.percentage === 'number' ? String(rec.percentage) : '',
      }
    }
    setDrafts(next)
  }, [query.data])

  const setMut = useMutation({
    mutationFn: ({
      flag,
      body,
    }: {
      flag: string
      body: { enabled: boolean; tenants?: string[]; percentage?: number }
    }) => platformApi.setFeature(flag, body),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['features-detailed'] })
    },
    onError: (err) => setError(err),
  })

  const entries = Object.entries(query.data ?? {}) as Array<
    [string, FeatureFlagRecord]
  >

  function buildBody(
    flag: string,
    enabled: boolean,
  ): { enabled: boolean; tenants?: string[]; percentage?: number } {
    const draft = drafts[flag]
    const tenants = parseTenants(draft?.tenants ?? '')
    const pctRaw = draft?.percentage?.trim() ?? ''
    const percentage =
      pctRaw === '' ? undefined : Math.min(100, Math.max(0, Number(pctRaw)))
    return {
      enabled,
      tenants,
      percentage: Number.isFinite(percentage) ? percentage : undefined,
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newFlag.trim()) return
    setMut.mutate(
      { flag: newFlag.trim(), body: { enabled: true } },
      {
        onSuccess: () => setNewFlag(''),
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="特性开关"
        description="支持租户白名单与百分比灰度（可隔离）"
      />
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
                  <th>租户白名单</th>
                  <th>灰度 %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map(([flag, rec]) => {
                  const draft = drafts[flag] ?? {
                    tenants: '',
                    percentage: '',
                  }
                  return (
                    <tr key={flag}>
                      <td className="mono">{flag}</td>
                      <td>
                        <button
                          type="button"
                          className={`toggle${rec.enabled ? ' on' : ''}`}
                          aria-pressed={rec.enabled}
                          disabled={setMut.isPending}
                          onClick={() =>
                            setMut.mutate({
                              flag,
                              body: buildBody(flag, !rec.enabled),
                            })
                          }
                          title={rec.enabled ? '关闭' : '开启'}
                        />
                        <span style={{ marginLeft: '0.5rem' }} className="muted">
                          {rec.enabled ? '开' : '关'}
                        </span>
                      </td>
                      <td>
                        <input
                          value={draft.tenants}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [flag]: { ...draft, tenants: e.target.value },
                            }))
                          }
                          placeholder="tenant_a, tenant_b（空=全部）"
                          style={{ minWidth: 180 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.percentage}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [flag]: { ...draft, percentage: e.target.value },
                            }))
                          }
                          placeholder="100"
                          style={{ width: 72 }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={setMut.isPending}
                          onClick={() =>
                            setMut.mutate({
                              flag,
                              body: buildBody(flag, rec.enabled),
                            })
                          }
                        >
                          保存
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
