import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { demoApi } from '../api'
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from '../components/ui'

export function DemoPage() {
  const helloQuery = useQuery({
    queryKey: ['demo-hello'],
    queryFn: demoApi.hello,
  })

  const secureQuery = useQuery({
    queryKey: ['demo-secure'],
    queryFn: demoApi.secure,
    retry: false,
  })

  return (
    <div>
      <PageHeader
        title="演示模块"
        description="示例业务模块：公开问候接口与需权限的安全接口"
      />
      <ErrorBanner error={helloQuery.error} />

      <div className="grid-2">
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>公开接口 · hello</h3>
          {helloQuery.isLoading ? (
            <LoadingBlock />
          ) : helloQuery.data ? (
            <>
              <p>
                是否启用：{' '}
                <StatusBadge status={helloQuery.data.enabled ? 'enabled' : 'disabled'}>
                  {helloQuery.data.enabled ? '是' : '否'}
                </StatusBadge>
              </p>
              <p>{helloQuery.data.message}</p>
              {!helloQuery.data.enabled ? (
                <p className="muted">
                  模块可能已禁用，请到 <Link to="/app/modules">模块管理</Link> 启用{' '}
                  <code>demo</code>。
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>安全接口 · secure</h3>
          <p className="muted">需要登录且具备 demo.read 权限</p>
          {secureQuery.isLoading ? (
            <LoadingBlock />
          ) : secureQuery.error ? (
            <ErrorBanner error={secureQuery.error} />
          ) : secureQuery.data ? (
            <p>
              <StatusBadge status="ok">成功</StatusBadge> {secureQuery.data.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
