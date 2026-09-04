import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import { streamChatMessage, type ChatStreamHandlers } from './stream'
import type {
  AiChatStatus,
  AiModelsProbeResult,
  AuditEntry,
  AuthenticatedUser,
  AuthTokens,
  Conversation,
  ConversationWithMessages,
  ExtensionContribution,
  HealthCheck,
  JobInfo,
  PermissionRecord,
  PlatformEvent,
  RegisteredModule,
  RoleRecord,
  StorageObjectMeta,
  TenantRecord,
  UserRecord,
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
  listConfig: (prefix?: string) => {
    const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''
    return apiGet<Record<string, unknown>>(`/api/platform/config${q}`)
  },
  setConfig: (key: string, value: unknown) =>
    apiPut(`/api/platform/config/${encodeURIComponent(key)}`, { value }),
  deleteConfig: (key: string) =>
    apiDelete(`/api/platform/config/${encodeURIComponent(key)}`),
  listFeatures: () => apiGet<Record<string, boolean>>('/api/platform/features'),
  setFeature: (flag: string, enabled: boolean) =>
    apiPut(`/api/platform/features/${encodeURIComponent(flag)}`, { enabled }),
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
  listJobs: (module?: string) => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    return apiGet<JobInfo[]>(`/api/platform/jobs${q}`)
  },
  listStorage: (module?: string) => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    return apiGet<StorageObjectMeta[]>(`/api/platform/storage${q}`)
  },
  listExtensionSlots: () => apiGet<string[]>('/api/platform/extensions'),
  listExtensions: (slot: string) =>
    apiGet<ExtensionContribution[]>(
      `/api/platform/extensions/${encodeURIComponent(slot)}`,
    ),
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
