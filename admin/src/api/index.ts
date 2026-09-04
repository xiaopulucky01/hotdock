import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import { streamChatMessage, type ChatStreamHandlers } from './stream'
import type {
  AiChatStatus,
  AiModelsProbeResult,
  AuditEntry,
  AuthenticatedUser,
  AuthTokens,
  CacheStats,
  ConfigKeySchema,
  Conversation,
  ConversationWithMessages,
  DeadLetterEntry,
  ExtensionContribution,
  FeatureFlagRecord,
  HealthCheck,
  JobInfo,
  NotificationRecord,
  PermissionRecord,
  PlatformEvent,
  RegisteredModule,
  RoleRecord,
  StorageObjectMeta,
  TenantRecord,
  UserRecord,
  WebhookEndpoint,
} from './types'

export const authApi = {
  login: (body: { username: string; password: string; tenantId?: string }) =>
    apiPost<AuthTokens>('/api/platform/auth/login', body),
  register: (body: {
    username: string
    password: string
    email?: string
    tenantId?: string
  }) =>
    apiPost<{ id: string; username: string; email?: string; tenantId?: string }>(
      '/api/platform/auth/register',
      body,
    ),
  refresh: (refreshToken: string) =>
    apiPost<AuthTokens>('/api/platform/auth/refresh', { refreshToken }),
  logout: () => apiPost<{ ok: boolean }>('/api/platform/auth/logout'),
  me: () => apiGet<AuthenticatedUser>('/api/platform/auth/me'),
}

export const platformApi = {
  health: () => apiGet<HealthCheck>('/api/platform/health'),
  metrics: () => apiGet<Record<string, number>>('/api/platform/metrics'),
  listModules: () => apiGet<RegisteredModule[]>('/api/platform/modules'),
  getModule: (name: string) =>
    apiGet<RegisteredModule | null>(`/api/platform/modules/${encodeURIComponent(name)}`),
  installModule: (name: string) =>
    apiPost<RegisteredModule>(`/api/platform/modules/${encodeURIComponent(name)}/install`),
  enableModule: (name: string) =>
    apiPost<RegisteredModule>(`/api/platform/modules/${encodeURIComponent(name)}/enable`),
  disableModule: (name: string) =>
    apiPost<RegisteredModule>(`/api/platform/modules/${encodeURIComponent(name)}/disable`),
  uninstallModule: (name: string) =>
    apiPost<RegisteredModule>(`/api/platform/modules/${encodeURIComponent(name)}/uninstall`),
  listUsers: (tenantId?: string) => {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return apiGet<UserRecord[]>(`/api/platform/users${q}`)
  },
  listTenants: () => apiGet<TenantRecord[]>('/api/platform/tenants'),
  createTenant: (body: { code: string; name: string }) =>
    apiPost<TenantRecord>('/api/platform/tenants', body),
  listPermissions: (module?: string) => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    return apiGet<PermissionRecord[]>(`/api/platform/rbac/permissions${q}`)
  },
  listRoles: () => apiGet<RoleRecord[]>('/api/platform/rbac/roles'),
  createRole: (body: {
    code: string
    name: string
    permissionCodes?: string[]
  }) => apiPost<RoleRecord>('/api/platform/rbac/roles', body),
  updateRole: (
    id: string,
    body: { name?: string; permissionCodes?: string[] },
  ) =>
    apiPatch<RoleRecord>(
      `/api/platform/rbac/roles/${encodeURIComponent(id)}`,
      body,
    ),
  deleteRole: (id: string) =>
    apiDelete<{ ok: boolean }>(
      `/api/platform/rbac/roles/${encodeURIComponent(id)}`,
    ),
  listConfig: (prefix?: string) => {
    const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''
    return apiGet<Record<string, unknown>>(`/api/platform/config${q}`)
  },
  listConfigSchemas: () =>
    apiGet<ConfigKeySchema[]>('/api/platform/config/schemas'),
  setConfig: (key: string, value: unknown) =>
    apiPut(`/api/platform/config/${encodeURIComponent(key)}`, { value }),
  deleteConfig: (key: string) =>
    apiDelete(`/api/platform/config/${encodeURIComponent(key)}`),
  listFeatures: () => apiGet<Record<string, boolean>>('/api/platform/features'),
  listFeaturesDetailed: () =>
    apiGet<Record<string, FeatureFlagRecord>>('/api/platform/features/detailed'),
  setFeature: (
    flag: string,
    body: { enabled: boolean; tenants?: string[]; percentage?: number },
  ) => apiPut(`/api/platform/features/${encodeURIComponent(flag)}`, body),
  listAudit: (opts?: { module?: string; actorId?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (opts?.module) params.set('module', opts.module)
    if (opts?.actorId) params.set('actorId', opts.actorId)
    if (opts?.limit) params.set('limit', String(opts.limit))
    const q = params.toString()
    return apiGet<AuditEntry[]>(`/api/platform/audit${q ? `?${q}` : ''}`)
  },
  recentEvents: (opts?: { limit?: number; name?: string }) => {
    const params = new URLSearchParams()
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.name) params.set('name', opts.name)
    const q = params.toString()
    return apiGet<PlatformEvent[]>(`/api/platform/events/recent${q ? `?${q}` : ''}`)
  },
  listDeadLetters: (limit?: number) => {
    const q = limit != null ? `?limit=${limit}` : ''
    return apiGet<DeadLetterEntry[]>(`/api/platform/events/dead-letters${q}`)
  },
  listJobs: (module?: string) => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    return apiGet<JobInfo[]>(`/api/platform/jobs${q}`)
  },
  updateJob: (
    module: string,
    name: string,
    body: {
      enabled?: boolean
      intervalMs?: number
      cron?: string | null
    },
  ) =>
    apiPatch<JobInfo>(
      `/api/platform/jobs/${encodeURIComponent(module)}/${encodeURIComponent(name)}`,
      body,
    ),
  runJob: (module: string, name: string) =>
    apiPost<JobInfo>(
      `/api/platform/jobs/${encodeURIComponent(module)}/${encodeURIComponent(name)}/run`,
    ),
  listStorage: (module?: string) => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    return apiGet<StorageObjectMeta[]>(`/api/platform/storage${q}`)
  },
  listExtensionSlots: () => apiGet<string[]>('/api/platform/extensions'),
  listExtensions: (slot: string) =>
    apiGet<ExtensionContribution[]>(
      `/api/platform/extensions/${encodeURIComponent(slot)}`,
    ),
  listWebhooks: () =>
    apiGet<WebhookEndpoint[]>('/api/platform/notifications/webhooks'),
  registerWebhook: (body: { url: string; events: string[]; secret?: string }) =>
    apiPost<WebhookEndpoint>('/api/platform/notifications/webhooks', body),
  removeWebhook: (id: string) =>
    apiDelete<{ ok: boolean }>(
      `/api/platform/notifications/webhooks/${encodeURIComponent(id)}`,
    ),
  recentNotifications: (limit?: number) => {
    const q = limit != null ? `?limit=${limit}` : ''
    return apiGet<NotificationRecord[]>(
      `/api/platform/notifications/recent${q}`,
    )
  },
  cacheStats: () => apiGet<CacheStats>('/api/platform/cache/stats'),
  clearCache: (prefix?: string) => {
    const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''
    return apiDelete<{ ok: boolean }>(`/api/platform/cache${q}`)
  },
}

export const aiChatApi = {
  status: () => apiGet<AiChatStatus>('/api/ai-chat/status'),
  probeModels: (body: { baseUrl: string; apiKey?: string }) =>
    apiPost<AiModelsProbeResult>('/api/ai-chat/models/probe', body),
  configure: (body: { baseUrl: string; apiKey: string; model: string }) =>
    apiPost<AiChatStatus>('/api/ai-chat/configure', body),
  listConversations: () => apiGet<Conversation[]>('/api/ai-chat/conversations'),
  createConversation: (title?: string) =>
    apiPost<Conversation>('/api/ai-chat/conversations', { title }),
  getConversation: (id: string) =>
    apiGet<ConversationWithMessages>(`/api/ai-chat/conversations/${id}`),
  updateConversation: (id: string, title: string) =>
    apiPatch<Conversation>(`/api/ai-chat/conversations/${id}`, { title }),
  deleteConversation: (id: string) =>
    apiDelete<{ deleted: boolean; id: string }>(`/api/ai-chat/conversations/${id}`),
  sendMessage: (id: string, content: string) =>
    apiPost<{
      userMessage: import('./types').ChatMessage
      assistantMessage: import('./types').ChatMessage
      usage?: Record<string, number>
    }>(`/api/ai-chat/conversations/${id}/messages`, { content }),
  streamMessage: (
    id: string,
    content: string,
    handlers: ChatStreamHandlers,
    signal?: AbortSignal,
  ) => streamChatMessage(id, content, handlers, signal),
}

export const demoApi = {
  hello: () => apiGet<{ enabled: boolean; message: string }>('/api/demo/hello'),
  secure: () => apiGet<{ ok: boolean; message: string }>('/api/demo/secure'),
}
