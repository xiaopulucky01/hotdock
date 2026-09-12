import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aiChatApi } from '../api'
import type { ChatMessage } from '../api/types'

export type ConversationStatus = 'idle' | 'streaming' | 'queued'

export type StreamState = {
  conversationId: string
  userMessage: ChatMessage
  assistant: ChatMessage
  error?: string
}

type QueuedItem = {
  id: string
  content: string
}

type RuntimeSnapshot = {
  streams: Record<string, StreamState>
  queueLengths: Record<string, number>
  pendingUsers: Record<string, ChatMessage[]>
  errors: Record<string, string>
}

type ChatRuntimeValue = {
  streams: Record<string, StreamState>
  queueLengths: Record<string, number>
  pendingUsers: Record<string, ChatMessage[]>
  errors: Record<string, string>
  getStatus: (conversationId: string) => ConversationStatus
  send: (conversationId: string, content: string) => void
  abort: (conversationId: string) => void
  clearError: (conversationId: string) => void
}

const ChatRuntimeContext = createContext<ChatRuntimeValue | null>(null)

function makeTempId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>({
    streams: {},
    queueLengths: {},
    pendingUsers: {},
    errors: {},
  })

  const abortsRef = useRef<Map<string, AbortController>>(new Map())
  const tailsRef = useRef<Map<string, Promise<void>>>(new Map())
  const queuesRef = useRef<Map<string, QueuedItem[]>>(new Map())
  const streamingRef = useRef<Set<string>>(new Set())

  const publishQueueLength = useCallback((conversationId: string) => {
    const len = queuesRef.current.get(conversationId)?.length ?? 0
    setSnapshot((prev) => ({
      ...prev,
      queueLengths: {
        ...prev.queueLengths,
        [conversationId]: len,
      },
    }))
  }, [])

  const setStream = useCallback(
    (conversationId: string, state: StreamState | null) => {
      setSnapshot((prev) => {
        const streams = { ...prev.streams }
        if (state) streams[conversationId] = state
        else delete streams[conversationId]
        return { ...prev, streams }
      })
    },
    [],
  )

  const patchStream = useCallback(
    (conversationId: string, updater: (prev: StreamState) => StreamState) => {
      setSnapshot((prev) => {
        const current = prev.streams[conversationId]
        if (!current) return prev
        return {
          ...prev,
          streams: {
            ...prev.streams,
            [conversationId]: updater(current),
          },
        }
      })
    },
    [],
  )

  const addPendingUser = useCallback(
    (conversationId: string, message: ChatMessage) => {
      setSnapshot((prev) => ({
        ...prev,
        pendingUsers: {
          ...prev.pendingUsers,
          [conversationId]: [
            ...(prev.pendingUsers[conversationId] ?? []),
            message,
          ],
        },
      }))
    },
    [],
  )

  const removePendingUser = useCallback(
    (conversationId: string, messageId: string) => {
      setSnapshot((prev) => {
        const list = (prev.pendingUsers[conversationId] ?? []).filter(
          (m) => m.id !== messageId,
        )
        const pendingUsers = { ...prev.pendingUsers }
        if (list.length) pendingUsers[conversationId] = list
        else delete pendingUsers[conversationId]
        return { ...prev, pendingUsers }
      })
    },
    [],
  )

  const runOne = useCallback(
    async (conversationId: string, content: string, pendingId: string) => {
      streamingRef.current.add(conversationId)
      const controller = new AbortController()
      abortsRef.current.set(conversationId, controller)

      const tempUserId = pendingId
      const tempAssistantId = makeTempId('tmp_asst')
      const userMessage: ChatMessage = {
        id: tempUserId,
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }
      const assistant: ChatMessage = {
        id: tempAssistantId,
        conversationId,
        role: 'assistant',
        content: '',
        reasoning: '',
        createdAt: new Date().toISOString(),
      }

      removePendingUser(conversationId, pendingId)
      setStream(conversationId, { conversationId, userMessage, assistant })

      let streamError: string | undefined
      try {
        await aiChatApi.streamMessage(
          conversationId,
          content,
          {
            onMeta: ({ userMessage: metaUser, assistantMessageId }) => {
              patchStream(conversationId, (prev) => ({
                ...prev,
                userMessage: metaUser,
                assistant: {
                  ...prev.assistant,
                  id: assistantMessageId,
                  conversationId: metaUser.conversationId,
                },
              }))
            },
            onReasoning: (delta) => {
              patchStream(conversationId, (prev) => ({
                ...prev,
                assistant: {
                  ...prev.assistant,
                  reasoning: `${prev.assistant.reasoning ?? ''}${delta}`,
                },
              }))
            },
            onContent: (delta) => {
              patchStream(conversationId, (prev) => ({
                ...prev,
                assistant: {
                  ...prev.assistant,
                  content: `${prev.assistant.content}${delta}`,
                },
              }))
            },
            onDone: ({ assistantMessage }) => {
              patchStream(conversationId, (prev) => ({
                ...prev,
                assistant: assistantMessage,
              }))
            },
            onError: (message) => {
              streamError = message
              patchStream(conversationId, (prev) => ({
                ...prev,
                error: message,
              }))
            },
          },
          controller.signal,
        )
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          streamError =
            err instanceof Error ? err.message : '发送失败，请重试'
          patchStream(conversationId, (prev) => ({
            ...prev,
            error: streamError,
          }))
        }
      } finally {
        streamingRef.current.delete(conversationId)
        abortsRef.current.delete(conversationId)
        setSnapshot((prev) => {
          const streams = { ...prev.streams }
          delete streams[conversationId]
          const errors = { ...prev.errors }
          if (streamError) errors[conversationId] = streamError
          return { ...prev, streams, errors }
        })
        await Promise.all([
          qc.invalidateQueries({
            queryKey: ['ai-chat-conversation', conversationId],
          }),
          qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] }),
        ])
      }
    },
    [patchStream, qc, removePendingUser, setStream],
  )

  const drain = useCallback(
    (conversationId: string) => {
      const existing = tailsRef.current.get(conversationId) ?? Promise.resolve()
      const next = existing
        .catch(() => undefined)
        .then(async () => {
          while (true) {
            const queue = queuesRef.current.get(conversationId)
            const item = queue?.shift()
            publishQueueLength(conversationId)
            if (!item) break
            await runOne(conversationId, item.content, item.id)
          }
        })
        .finally(() => {
          if (tailsRef.current.get(conversationId) === next) {
            tailsRef.current.delete(conversationId)
          }
        })
      tailsRef.current.set(conversationId, next)
    },
    [publishQueueLength, runOne],
  )

  const send = useCallback(
    (conversationId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const id = makeTempId('tmp_user')
      const pending: ChatMessage = {
        id,
        conversationId,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      addPendingUser(conversationId, pending)
      setSnapshot((prev) => {
        if (!prev.errors[conversationId]) return prev
        const errors = { ...prev.errors }
        delete errors[conversationId]
        return { ...prev, errors }
      })

      const queue = queuesRef.current.get(conversationId) ?? []
      queue.push({ id, content: trimmed })
      queuesRef.current.set(conversationId, queue)
      publishQueueLength(conversationId)
      drain(conversationId)
    },
    [addPendingUser, drain, publishQueueLength],
  )

  const abort = useCallback((conversationId: string) => {
    abortsRef.current.get(conversationId)?.abort()
  }, [])

  const clearError = useCallback((conversationId: string) => {
    setSnapshot((prev) => {
      if (!prev.errors[conversationId] && !prev.streams[conversationId]?.error) {
        return prev
      }
      const errors = { ...prev.errors }
      delete errors[conversationId]
      const streams = { ...prev.streams }
      if (streams[conversationId]?.error) {
        streams[conversationId] = {
          ...streams[conversationId],
          error: undefined,
        }
      }
      return { ...prev, errors, streams }
    })
  }, [])

  const getStatus = useCallback(
    (conversationId: string): ConversationStatus => {
      if (snapshot.streams[conversationId]) return 'streaming'
      if ((snapshot.queueLengths[conversationId] ?? 0) > 0) return 'queued'
      return 'idle'
    },
    [snapshot.queueLengths, snapshot.streams],
  )

  const value = useMemo<ChatRuntimeValue>(
    () => ({
      streams: snapshot.streams,
      queueLengths: snapshot.queueLengths,
      pendingUsers: snapshot.pendingUsers,
      errors: snapshot.errors,
      getStatus,
      send,
      abort,
      clearError,
    }),
    [snapshot, getStatus, send, abort, clearError],
  )

  return (
    <ChatRuntimeContext.Provider value={value}>
      {children}
    </ChatRuntimeContext.Provider>
  )
}

export function useChatRuntime() {
  const ctx = useContext(ChatRuntimeContext)
  if (!ctx) throw new Error('useChatRuntime must be used within ChatRuntimeProvider')
  return ctx
}
