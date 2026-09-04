import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { platformApi } from '../api'
import type { JobInfo } from '../api/types'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDate,
} from '../components/ui'

type ScheduleDraft = {
  mode: 'interval' | 'cron'
  intervalMs: string
  cron: string
}

function toDraft(job: JobInfo): ScheduleDraft {
  if (job.cron) {
    return { mode: 'cron', intervalMs: '', cron: job.cron }
  }
  return {
    mode: 'interval',
    intervalMs: typeof job.intervalMs === 'number' ? String(job.intervalMs) : '',
    cron: '',
  }
}

function scheduleBody(draft: ScheduleDraft): {
  intervalMs?: number
  cron?: string | null
} {
  if (draft.mode === 'cron') {
    const cron = draft.cron.trim()
    if (!cron) throw new Error('请填写 cron 表达式')
    return { cron }
  }
  const intervalMs = Number(draft.intervalMs)
  if (!Number.isFinite(intervalMs) || intervalMs < 100) {
    throw new Error('间隔须为 >= 100 的毫秒数')
  }
  return { intervalMs, cron: null }
}

export function JobsPage() {
  const qc = useQueryClient()
  const [module, setModule] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({})

  const query = useQuery({
    queryKey: ['jobs', module],
    queryFn: () => platformApi.listJobs(module || undefined),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (!query.data) return
    setDrafts((prev) => {
      const next: Record<string, ScheduleDraft> = {}
      for (const job of query.data) {
        const key = `${job.module}:${job.name}`
        next[key] = prev[key] ?? toDraft(job)
      }
      return next
    })
  }, [query.data])

  const updateMut = useMutation({
    mutationFn: ({
      module: mod,
      name,
      body,
    }: {
      module: string
      name: string
      body: { enabled?: boolean; intervalMs?: number; cron?: string | null }
    }) => platformApi.updateJob(mod, name, body),
    onSuccess: (_data, vars) => {
      setError(null)
      const key = `${vars.module}:${vars.name}`
      if (vars.body.intervalMs !== undefined || vars.body.cron !== undefined) {
        setDrafts((prev) => {
          const { [key]: _, ...rest } = prev
          return rest
        })
      }
      void qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => setError(err),
  })

  const runMut = useMutation({
    mutationFn: ({ module: mod, name }: { module: string; name: string }) =>
      platformApi.runJob(mod, name),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => setError(err),
  })

  const busy = updateMut.isPending || runMut.isPending

  function saveSchedule(job: JobInfo) {
    const key = `${job.module}:${job.name}`
    const draft = drafts[key] ?? toDraft(job)
    try {
      const body = scheduleBody(draft)
      updateMut.mutate({ module: job.module, name: job.name, body })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div>
      <PageHeader
        title="定时任务"
        description="任务由各模块代码注册；可在此启停、改调度或立即运行（覆盖项会持久化）"
      />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="module">模块</label>
          <input
            id="module"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          />
        </div>
      </div>
      <ErrorBanner error={query.error ?? error} />
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
                  <th>调度</th>
                  <th>重试</th>
                  <th>状态</th>
                  <th>上次运行</th>
                  <th>成功/失败</th>
                  <th>错误</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data!.map((j) => {
                  const key = `${j.module}:${j.name}`
                  const draft = drafts[key] ?? toDraft(j)
                  const enabled = j.enabled !== false
                  return (
                    <tr key={key}>
                      <td className="mono">{j.name}</td>
                      <td className="mono">{j.module}</td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            minWidth: 200,
                          }}
                        >
                          <select
                            value={draft.mode}
                            disabled={busy}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: {
                                  ...draft,
                                  mode: e.target.value as 'interval' | 'cron',
                                },
                              }))
                            }
                          >
                            <option value="interval">间隔 (ms)</option>
                            <option value="cron">Cron</option>
                          </select>
                          {draft.mode === 'interval' ? (
                            <input
                              type="number"
                              min={100}
                              value={draft.intervalMs}
                              disabled={busy}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    intervalMs: e.target.value,
                                  },
                                }))
                              }
                              placeholder="60000"
                            />
                          ) : (
                            <input
                              className="mono"
                              value={draft.cron}
                              disabled={busy}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, cron: e.target.value },
                                }))
                              }
                              placeholder="*/5 * * * *"
                            />
                          )}
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => saveSchedule(j)}
                          >
                            保存调度
                          </button>
                        </div>
                      </td>
                      <td>{j.retries ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={`toggle${enabled ? ' on' : ''}`}
                          aria-pressed={enabled}
                          disabled={busy}
                          onClick={() =>
                            updateMut.mutate({
                              module: j.module,
                              name: j.name,
                              body: { enabled: !enabled },
                            })
                          }
                          title={enabled ? '停用' : '启用'}
                        />
                        <span style={{ marginLeft: '0.5rem' }} className="muted">
                          {enabled ? '已启用' : '已停用'}
                        </span>
                      </td>
                      <td>{formatDate(j.lastRunAt)}</td>
                      <td className="muted">
                        {j.runCount ?? 0}/{j.failCount ?? 0}
                      </td>
                      <td className="muted">{j.lastError ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() =>
                            runMut.mutate({
                              module: j.module,
                              name: j.name,
                            })
                          }
                        >
                          立即运行
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
