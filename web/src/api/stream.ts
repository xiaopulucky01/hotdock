import {
  ApiError,
  getStoredTenantId,
  getStoredToken,
  notifyUnauthorized,
  tryRefreshAccessToken,
} from './client'
import type { ChatMessage } from './types'

export type ChatStreamHandlers = {
  onMeta?: (data: {
    userMessage: ChatMessage
    assistantMessageId: string
  }) => void
  onReasoning?: (delta: string) => void
  onContent?: (delta: string) => void
  onDone?: (data: {
    assistantMessage: ChatMessage
    usage?: Record<string, number>
  }) => void
  onError?: (message: string) => void
}

function formatMessage(message: unknown): string {
  if (Array.isArray(message)) return message.join(', ')
  if (typeof message === 'string' && message) return message
  return '请求失败'
}

/** Consume Nest SSE from POST /messages/stream. */
export async function streamChatMessage(
  conversationId: string,
  content: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const buildHeaders = () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    })
    const token = getStoredToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const tenantId = getStoredTenantId()
    if (tenantId) headers.set('x-tenant-id', tenantId)
    return headers
  }

  const url = `/api/ai-chat/conversations/${encodeURIComponent(conversationId)}/messages/stream`
  const body = JSON.stringify({ content })

  let res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body,
    signal,
  })

  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken()
    if (refreshed) {
      res = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(),
        body,
        signal,
      })
    } else {
      notifyUnauthorized()
    }
  }

  if (!res.ok) {
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    const errBody = data as {
      message?: string | string[]
      statusCode?: number
      correlationId?: string
    } | null
    if (res.status === 401) notifyUnauthorized()
    throw new ApiError(
      formatMessage(errBody?.message ?? res.statusText),
      errBody?.statusCode ?? res.status,
      errBody?.correlationId,
    )
  }

  if (!res.body) {
    throw new ApiError('浏览器不支持流式响应', 500)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'
  let pendingData: string[] = []

  const flushEvent = () => {
    if (!pendingData.length) return
    const raw = pendingData.join('\n')
    pendingData = []
    const event = currentEvent
    currentEvent = 'message'

    let parsed: unknown = raw
    try {
      parsed = JSON.parse(raw)
    } catch {
      // keep string
    }
    const payload = parsed as Record<string, unknown>
    switch (event) {
      case 'meta':
        handlers.onMeta?.(payload as never)
        break
      case 'reasoning':
        handlers.onReasoning?.(
          String((payload as { delta?: string }).delta ?? ''),
        )
        break
      case 'content':
        handlers.onContent?.(
          String((payload as { delta?: string }).delta ?? ''),
        )
        break
      case 'done':
        handlers.onDone?.(payload as never)
        break
      case 'error':
        handlers.onError?.(
          String((payload as { message?: string }).message ?? '流式输出失败'),
        )
        break
      default:
        break
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() ?? ''

    for (const line of parts) {
      if (line === '') {
        flushEvent()
        continue
      }
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
        continue
      }
      if (line.startsWith('data:')) {
        pendingData.push(line.slice(5).trimStart())
      }
    }
  }

  flushEvent()
}
