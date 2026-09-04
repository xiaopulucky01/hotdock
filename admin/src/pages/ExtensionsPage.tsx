import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

export function ExtensionsPage() {
  const [slot, setSlot] = useState('platform.nav.items')

  const slotsQuery = useQuery({
    queryKey: ['extension-slots'],
    queryFn: platformApi.listExtensionSlots,
  })

  const listQuery = useQuery({
    queryKey: ['extensions', slot],
    queryFn: () => platformApi.listExtensions(slot),
    enabled: !!slot,
  })

  return (
    <div>
      <PageHeader
        title="扩展点"
        description="扩展点贡献列表（如 platform.nav.items）"
      />
      <ErrorBanner error={slotsQuery.error ?? listQuery.error} />

      <div className="toolbar">
        <div className="field">
          <label htmlFor="slot">插槽</label>
          <input
            id="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            list="slot-options"
          />
          <datalist id="slot-options">
            {(slotsQuery.data ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      {slotsQuery.data && slotsQuery.data.length > 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>
          已知插槽：{slotsQuery.data.join(', ')}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <LoadingBlock />
      ) : (listQuery.data?.length ?? 0) === 0 ? (
        <EmptyState>该插槽暂无贡献</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>模块</th>
                  <th>优先级</th>
                  <th>特性</th>
                  <th>数据</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data!.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td className="mono">{c.module}</td>
                    <td>{c.priority ?? 0}</td>
                    <td className="mono">{c.feature ?? '—'}</td>
                    <td>
                      <pre className="pre-json" style={{ maxHeight: 160 }}>
                        {JSON.stringify(c.data, null, 2)}
                      </pre>
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
