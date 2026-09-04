export type ModuleStatus =
  | 'registered'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'error'

export interface ModuleManifest {
  name: string
  version: string
  displayName: string
  description?: string
  author?: string
  dependencies?: Array<{ name: string; version?: string; optional?: boolean }>
  permissions?: Array<{ code: string; name: string; description?: string }>
  routes?: Array<{ prefix: string; version?: string }>
  events?: Array<{
    name: string
    description?: string
    payloadHint?: Record<string, unknown>
  }>
  hooks?: Array<{ slot: string; description?: string }>
  features?: string[]
  configKeys?: string[]
}

export interface RegisteredModule {
  manifest: ModuleManifest
  status: ModuleStatus
  registeredAt: string
  enabledAt?: string
  error?: string
}

export interface AuthenticatedUser {
  id: string
  username: string
  email?: string
  tenantId?: string
  roles: string[]
  permissions: string[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface FeatureFlagRecord {
  enabled: boolean
  /** Optional tenant allow-list; empty = all tenants */
  tenants?: string[]
  /** 0-100 rollout percentage */
  percentage?: number
}

export interface ConfigKeySchema {
  key: string
  type: 'string' | 'number' | 'boolean' | 'json'
  secret?: boolean
  description?: string
  default?: unknown
}

export interface DeadLetterEntry {
  event: PlatformEvent
  error: string
  attempts: number
  at: string
}

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  active: boolean
  secret?: string
  createdAt: string
}

export interface NotificationRecord {
  id: string
  channel: 'webhook' | 'log'
  target: string
  event: string
  status: 'sent' | 'failed'
  error?: string
  at: string
}

export interface CacheStats {
  ok: boolean
  message?: string
}

export interface UserRecord {
  id: string
  username: string
  email?: string
  tenantId?: string
  roleIds: string[]
  active: boolean
  createdAt: string
}

export interface TenantRecord {
  id: string
  code: string
  name: string
  active: boolean
  createdAt: string
}

export interface PermissionRecord {
  code: string
  name: string
  description?: string
  module?: string
}

export interface RoleRecord {
  id: string
  code: string
  name: string
  permissionCodes: string[]
  system?: boolean
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down'
  checks: Record<string, { status: 'ok' | 'down'; detail?: string }>
  uptimeSec: number
  modules: Array<{ name: string; status: string }>
}

export interface AuditEntry {
  id: string
  action: string
  module: string
  actorId?: string
  tenantId?: string
  resource?: string
  detail?: Record<string, unknown>
  at: string
}

export interface PlatformEvent {
  name: string
  payload: unknown
  source: string
  tenantId?: string
  userId?: string
  correlationId?: string
  occurredAt: string
}

export interface JobInfo {
  name: string
  module: string
  intervalMs?: number
  cron?: string
  retries?: number
  enabled?: boolean
  lastRunAt?: string
  lastError?: string
  runCount?: number
  failCount?: number
}

export interface StorageObjectMeta {
  key: string
  module: string
  contentType: string
  size: number
  createdAt: string
  blobPath?: string
  metadata?: Record<string, string>
}

export interface ExtensionContribution {
  id: string
  module: string
  priority?: number
  feature?: string
  data: unknown
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  /** 模型思考 / 推理过程（如 DeepSeek reasoning_content） */
  reasoning?: string
  createdAt: string
}

export interface Conversation {
  id: string
  userId: string
  title: string
  model?: string
  createdAt: string
  updatedAt: string
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[]
}

export interface AiChatStatus {
  enabled: boolean
  provider: string
  model?: string
  baseUrl?: string
  configured: boolean
  availableProviders: string[]
}

export interface AiModelInfo {
  id: string
  ownedBy?: string
}

export interface AiModelsProbeResult {
  baseUrl: string
  models: AiModelInfo[]
}
