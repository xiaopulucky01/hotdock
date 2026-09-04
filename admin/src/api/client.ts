const TOKEN_KEY = 'platform.accessToken'

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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, { ...options, headers })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const errBody = data as {
      message?: string | string[]
      statusCode?: number
      correlationId?: string
    } | null
    const message = formatMessage(errBody?.message ?? res.statusText)
    if (res.status === 401) {
      onUnauthorized?.()
    }
    throw new ApiError(message, errBody?.statusCode ?? res.status, errBody?.correlationId)
  }

  return data as T
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
