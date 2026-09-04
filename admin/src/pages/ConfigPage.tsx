import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { aiChatApi, platformApi } from '../api'
import type { AiModelInfo } from '../api/types'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

function parseValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return raw
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function ConfigPage() {
  const qc = useQueryClient()
  const [prefix, setPrefix] = useState('')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<unknown>(null)

  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<AiModelInfo[]>([])
  const [aiHint, setAiHint] = useState<string | null>(null)
  const [aiPrefillDone, setAiPrefillDone] = useState(false)

  const query = useQuery({
    queryKey: ['config', prefix],
    queryFn: () => platformApi.listConfig(prefix || undefined),
  })

  const schemasQuery = useQuery({
    queryKey: ['config-schemas'],
    queryFn: platformApi.listConfigSchemas,
  })

  const schemaMap = new Map(
    (schemasQuery.data ?? []).map((s) => [s.key, s]),
  )

  const aiConfigQuery = useQuery({
    queryKey: ['config', 'ai-chat.'],
    queryFn: () => platformApi.listConfig('ai-chat.'),
  })

  useEffect(() => {
    if (aiPrefillDone || !aiConfigQuery.data) return
    const data = aiConfigQuery.data
    const savedUrl = asString(data['ai-chat.baseUrl'])
    const savedKey = asString(data['ai-chat.apiKey'])
    const savedModel = asString(data['ai-chat.model'])
    if (savedUrl) setBaseUrl(savedUrl)
    if (savedKey) setApiKey(savedKey)
    if (savedModel) setModel(savedModel)
    setAiPrefillDone(true)
  }, [aiConfigQuery.data, aiPrefillDone])

  const setMut = useMutation({
    mutationFn: () => platformApi.setConfig(key, parseValue(value)),
    onSuccess: () => {
      setError(null)
      setKey('')
      setValue('')
      void qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (err) => setError(err),
  })

  const delMut = useMutation({
    mutationFn: (k: string) => platformApi.deleteConfig(k),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (err) => setError(err),
  })

  const probeMut = useMutation({
    mutationFn: () => aiChatApi.probeModels({ baseUrl: baseUrl.trim(), apiKey }),
    onSuccess: (result) => {
      setError(null)
      setModels(result.models)
      setBaseUrl(result.baseUrl)
      const ids = result.models.map((m) => m.id)
      setModel((prev) => (prev && ids.includes(prev) ? prev : ids[0] ?? ''))
      setAiHint(`已识别 ${result.models.length} 个模型，选择后一键保存即可`)
    },
    onError: (err) => {
      setModels([])
      setAiHint(null)
      setError(err)
    },
  })

  const configureMut = useMutation({
    mutationFn: () =>
      aiChatApi.configure({
        baseUrl: baseUrl.trim(),
        apiKey,
        model: model.trim(),
      }),
    onSuccess: () => {
      setError(null)
      setAiHint('已保存并切换为 openai-compatible')
      void qc.invalidateQueries({ queryKey: ['config'] })
      void qc.invalidateQueries({ queryKey: ['ai-chat-status'] })
    },
    onError: (err) => setError(err),
  })

  const entries = Object.entries(query.data ?? {})

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMut.mutate()
  }

  function onConfigure(e: FormEvent) {
    e.preventDefault()
    if (!model.trim()) {
      setError(new Error('请先识别并选择模型'))
      return
    }
    configureMut.mutate()
  }

  return (
    <div>
      <PageHeader
        title="配置"
        description="命名空间配置键值；密钥由服务端脱敏显示"
      />
      <ErrorBanner error={query.error ?? error} />

      <form className="card card-pad" onSubmit={onConfigure} style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.85rem' }}>
          <strong>AI 服务商一键配置</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            填写 Base URL 与 API Key，自动拉取可用模型，无需逐个添加配置键
          </p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="aiBaseUrl">Base URL</label>
            <input
              id="aiBaseUrl"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                setModels([])
                setAiHint(null)
              }}
              required
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="field">
            <label htmlFor="aiApiKey">API Key</label>
            <input
              id="aiApiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-...（本地服务可留空）"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="aiModel">模型</label>
          {models.length > 0 ? (
            <select
              id="aiModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.ownedBy ? ` (${m.ownedBy})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="aiModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="先点「识别模型」，或手动填写模型名"
            />
          )}
        </div>
        <div className="btn-row" style={{ marginTop: '0.85rem' }}>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={probeMut.isPending || !baseUrl.trim()}
            onClick={() => probeMut.mutate()}
          >
            {probeMut.isPending ? '识别中…' : '识别模型'}
          </button>
          <button
            className="btn"
            type="submit"
            disabled={configureMut.isPending || !baseUrl.trim() || !model.trim()}
          >
            {configureMut.isPending ? '保存中…' : '一键保存'}
          </button>
        </div>
        {aiHint ? (
          <p className="muted" style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
            {aiHint}
          </p>
        ) : null}
      </form>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="prefix">前缀</label>
          <input
            id="prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="ai-chat."
          />
        </div>
      </div>

      <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.65rem' }}>
          <strong>高级：单键编辑</strong>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="cfgKey">键</label>
            <input
              id="cfgKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="platform.name"
            />
          </div>
          <div className="field">
            <label htmlFor="cfgValue">值</label>
            <input
              id="cfgValue"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='"AI Nest 平台" 或 123 / true'
              required
            />
          </div>
        </div>
        <button className="btn" type="submit" disabled={setMut.isPending}>
          保存配置
        </button>
      </form>

      {query.isLoading ? (
        <LoadingBlock />
      ) : entries.length === 0 ? (
        <EmptyState>暂无配置</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>键</th>
                  <th>类型</th>
                  <th>值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map(([k, v]) => {
                  const schema = schemaMap.get(k)
                  const isSecret = schema?.secret || v === '***'
                  return (
                    <tr key={k}>
                      <td className="mono">{k}</td>
                      <td className="mono muted">{schema?.type ?? '—'}</td>
                      <td
                        className="mono"
                        style={{ maxWidth: 420, wordBreak: 'break-all' }}
                      >
                        {isSecret && v === '***' ? (
                          <span className="muted">***</span>
                        ) : (
                          JSON.stringify(v)
                        )}
                        {schema?.secret ? (
                          <span
                            className="badge badge-warn"
                            style={{ marginLeft: '0.4rem' }}
                          >
                            密钥
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={delMut.isPending}
                          onClick={() => delMut.mutate(k)}
                        >
                          删除
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
