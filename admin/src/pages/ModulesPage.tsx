import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import type { ModuleStatus, RegisteredModule } from '../api/types'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
} from '../components/ui'

function canInstall(status: ModuleStatus) {
  return status === 'registered' || status === 'disabled'
}

function canEnable(status: ModuleStatus) {
  return status === 'registered' || status === 'installed' || status === 'disabled'
}

function canDisable(status: ModuleStatus) {
  return status === 'enabled'
}

function canUninstall(status: ModuleStatus) {
  return status === 'installed' || status === 'disabled' || status === 'enabled'
}

export function ModulesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['modules'],
    queryFn: platformApi.listModules,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['modules'] })
    void qc.invalidateQueries({ queryKey: ['health'] })
  }

  const run = useMutation({
    mutationFn: async ({
      name,
      action,
    }: {
      name: string
      action: 'install' | 'enable' | 'disable' | 'uninstall'
    }) => {
      if (action === 'install') return platformApi.installModule(name)
      if (action === 'enable') return platformApi.enableModule(name)
      if (action === 'disable') return platformApi.disableModule(name)
      return platformApi.uninstallModule(name)
    },
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (err) => setActionError(err),
  })

  const modules = query.data ?? []
  const detail = modules.find((m) => m.manifest.name === selected) ?? null

  return (
    <div>
      <PageHeader
        title="模块管理"
        description="真热插拔：磁盘发现 → 进程加载 → 路由挂载；禁用卸路由，卸载可清出进程"
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => query.refetch()}>
            刷新
          </button>
        }
      />
      <ErrorBanner error={query.error ?? actionError} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : modules.length === 0 ? (
        <EmptyState>暂无已注册模块</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>版本</th>
                  <th>状态</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => (
                  <ModuleRow
                    key={mod.manifest.name}
                    mod={mod}
                    busy={run.isPending}
                    selected={selected === mod.manifest.name}
                    onSelect={() => setSelected(mod.manifest.name)}
                    onAction={(action) =>
                      run.mutate({ name: mod.manifest.name, action })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail ? (
        <div className="detail-panel">
          <h3 style={{ marginTop: 0 }}>{detail.manifest.displayName}</h3>
          <p className="muted">{detail.manifest.description ?? '无描述'}</p>
          <pre className="pre-json">{JSON.stringify(detail, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  )
}

function ModuleRow({
  mod,
  busy,
  selected,
  onSelect,
  onAction,
}: {
  mod: RegisteredModule
  busy: boolean
  selected: boolean
  onSelect: () => void
  onAction: (action: 'install' | 'enable' | 'disable' | 'uninstall') => void
}) {
  const { status } = mod
  return (
    <tr style={selected ? { background: 'var(--accent-soft)' } : undefined}>
      <td>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSelect}>
          <strong>{mod.manifest.displayName}</strong>
        </button>
        <div className="mono muted" style={{ fontSize: '0.78rem' }}>
          {mod.manifest.name}
        </div>
      </td>
      <td className="mono">{mod.manifest.version}</td>
      <td>
        <StatusBadge status={status} />
        {mod.error ? <div className="muted">{mod.error}</div> : null}
      </td>
      <td>{formatDate(mod.registeredAt)}</td>
      <td>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy || !canInstall(status)}
            onClick={() => onAction('install')}
          >
            安装
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || !canEnable(status)}
            onClick={() => onAction('enable')}
          >
            启用
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy || !canDisable(status)}
            onClick={() => onAction('disable')}
          >
            禁用
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={busy || !canUninstall(status)}
            onClick={() => onAction('uninstall')}
          >
            卸载
          </button>
        </div>
      </td>
    </tr>
  )
}
