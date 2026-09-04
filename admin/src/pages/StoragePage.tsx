import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../api'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDate,
} from '../components/ui'

export function StoragePage() {
  const [module, setModule] = useState('')
  const query = useQuery({
    queryKey: ['storage', module],
    queryFn: () => platformApi.listStorage(module || undefined),
  })

  return (
    <div>
      <PageHeader title="对象存储" description="对象存储元数据（不含内容体）" />
      <div className="toolbar">
        <div className="field">
          <label htmlFor="module">模块</label>
          <input id="module" value={module} onChange={(e) => setModule(e.target.value)} />
        </div>
      </div>
      <ErrorBanner error={query.error} />
      {query.isLoading ? (
        <LoadingBlock />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState>暂无对象</EmptyState>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>键</th>
                  <th>模块</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {query.data!.map((o) => (
                  <tr key={o.key}>
                    <td className="mono">{o.key}</td>
                    <td className="mono">{o.module}</td>
                    <td>{o.contentType}</td>
                    <td>{o.size} 字节</td>
                    <td>{formatDate(o.createdAt)}</td>
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
