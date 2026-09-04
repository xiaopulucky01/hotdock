import type { ReactNode } from 'react'
import type { ModuleStatus } from '../api/types'

const STATUS_CLASS: Record<string, string> = {
  ok: 'badge-ok',
  enabled: 'badge-enabled',
  success: 'badge-success',
  sent: 'badge-success',
  installed: 'badge-installed',
  registered: 'badge-registered',
  degraded: 'badge-degraded',
  disabled: 'badge-disabled',
  error: 'badge-error',
  failed: 'badge-error',
  down: 'badge-down',
  warn: 'badge-warn',
  info: 'badge-info',
  active: 'badge-enabled',
  inactive: 'badge-disabled',
}

const STATUS_LABEL: Record<string, string> = {
  ok: '正常',
  enabled: '已启用',
  success: '成功',
  sent: '已发送',
  installed: '已安装',
  registered: '已注册',
  degraded: '降级',
  disabled: '已禁用',
  error: '错误',
  failed: '失败',
  down: '不可用',
  warn: '警告',
  info: '信息',
  active: '启用',
  inactive: '停用',
}

export function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status
}

export function StatusBadge({
  status,
  children,
}: {
  status: ModuleStatus | string
  children?: ReactNode
}) {
  const cls = STATUS_CLASS[status] ?? 'badge-info'
  return (
    <span className={`badge ${cls}`}>{children ?? statusLabel(status)}</span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="btn-row">{actions}</div> : null}
    </div>
  )
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '出错了'
  return <div className="error-banner">{message}</div>
}

export function LoadingBlock({ label = '加载中…' }: { label?: string }) {
  return <div className="empty">{label}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-CN')
}

export function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} 小时 ${m} 分 ${s} 秒`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}
