const TOKEN_KEY = 'platform.accessToken'
const REFRESH_TOKEN_KEY = 'platform.refreshToken'
const TENANT_KEY = 'platform.tenantId'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setStoredRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY)
}

export function setStoredTenantId(tenantId: string | null) {
  if (tenantId) {
    localStorage.setItem(TENANT_KEY, tenantId)
  } else {
    localStorage.removeItem(TENANT_KEY)
  }
}

export function clearStoredSession() {
  setStoredToken(null)
  setStoredRefreshToken(null)
  setStoredTenantId(null)
}

export class ApiError extends Error {
  statusCode: number
  correlationId?: string

  constructor(message: string, statusCode: number, correlationId?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.correlationId = correlationId
  }
}

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

export function notifyUnauthorized() {
  onUnauthorized?.()
}

function formatMessage(message: unknown): string {
  if (Array.isArray(message)) {
    return message.join(', ')
  }
  if (typeof message === 'string' && message) {
    return message
  }
  return '请求失败'
}

function applyAuthHeaders(headers: Headers) {
  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const tenantId = getStoredTenantId()
  if (tenantId) {
    headers.set('x-tenant-id', tenantId)
  }
}

let refreshInFlight: Promise<boolean> | null = null

/** Attempt token refresh once; concurrent callers share the same promise. */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken()
    if (!refreshToken) return false

    try {
      const res = await fetch('/api/platform/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return false

      const data = (await res.json()) as {
        accessToken?: string
        refreshToken?: string
      }
      if (!data.accessToken) return false

      setStoredToken(data.accessToken)
      if (data.refreshToken) {
        setStoredRefreshToken(data.refreshToken)
      }
      return true
    } catch {
      return false
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined

  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function throwApiError(res: Response, data: unknown): never {
  const errBody = data as {
    message?: string | string[]
    statusCode?: number
    correlationId?: string
  } | null
  throw new ApiError(
    formatMessage(errBody?.message ?? res.statusText),
    errBody?.statusCode ?? res.status,
    errBody?.correlationId,
  )
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  applyAuthHeaders(headers)

  const res = await fetch(path, { ...options, headers })
  const data = await parseBody(res)

  if (res.ok) {
    return data as T
  }

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefreshAccessToken()
    if (refreshed) {
      return apiRequest<T>(path, options, true)
    }
    onUnauthorized?.()
  } else if (res.status === 401) {
    onUnauthorized?.()
  }

  throwApiError(res, data)
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path)
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPut<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' })
}
