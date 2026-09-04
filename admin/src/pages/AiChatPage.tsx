import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { aiChatApi } from '../api'
import { ApiError } from '../api/client'
import { streamChatMessage } from '../api/stream'
import type { ChatMessage } from '../api/types'
import {
  ThinkingBlock,
  splitEmbeddedReasoning,
} from '../components/ThinkingBlock'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  formatDate,
} from '../components/ui'

function AssistantMessage({
  message,
  streaming = false,
}: {
  message: ChatMessage
  streaming?: boolean
}) {
  const split = splitEmbeddedReasoning(message.content, message.reasoning)
  const showThinking = Boolean(split.reasoning) || (streaming && !split.content)
  return (
    <div className="assistant-turn">
      {showThinking ? (
        <ThinkingBlock
          reasoning={split.reasoning}
          pending={streaming && !split.content}
          defaultOpen={streaming}
        />
      ) : null}
      {split.content || streaming ? (
        <div className={`bubble assistant${streaming ? ' streaming' : ''}`}>
          {split.content}
          {streaming ? <span className="stream-caret" aria-hidden /> : null}
        </div>
      ) : null}
    </div>
  )
}

type StreamState = {
  conversationId: string
  userMessage: ChatMessage
  assistant: ChatMessage
}

export function AiChatPage() {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamState, setStreamState] = useState<StreamState | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const statusQuery = useQuery({
    queryKey: ['ai-chat-status'],
    queryFn: aiChatApi.status,
    retry: false,
  })

  const listQuery = useQuery({
    queryKey: ['ai-chat-conversations'],
    queryFn: aiChatApi.listConversations,
    enabled: statusQuery.isSuccess,
  })

  const detailQuery = useQuery({
    queryKey: ['ai-chat-conversation', activeId],
    queryFn: () => aiChatApi.getConversation(activeId!),
    enabled: !!activeId,
  })

  const createMut = useMutation({
    mutationFn: () => aiChatApi.createConversation(),
    onSuccess: (conv) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] })
      setActiveId(conv.id)
    },
    onError: (err) => setError(err),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiChatApi.deleteConversation(id),
    onSuccess: (_data, id) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] })
      if (activeId === id) {
        setActiveId(null)
      }
    },
    onError: (err) => setError(err),
  })

  useEffect(() => {
    if (!activeId && listQuery.data && listQuery.data.length > 0) {
      setActiveId(listQuery.data[0].id)
    }
  }, [activeId, listQuery.data])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [
    detailQuery.data?.messages,
    streamState?.assistant.content,
    streamState?.assistant.reasoning,
    streaming,
  ])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const moduleDisabled =
    statusQuery.error instanceof ApiError && statusQuery.error.statusCode === 503

  const baseMessages = detailQuery.data?.messages ?? []
  const displayMessages =
    streaming && streamState && streamState.conversationId === activeId
      ? [
          ...baseMessages.filter(
            (m) =>
              m.id !== streamState.userMessage.id &&
              m.id !== streamState.assistant.id,
          ),
          streamState.userMessage,
          streamState.assistant,
        ]
      : baseMessages

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !draft.trim() || streaming) return

    const content = draft.trim()
    setDraft('')
    setError(null)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const tempUserId = `tmp_user_${Date.now()}`
    const tempAssistantId = `tmp_asst_${Date.now()}`
    setStreamState({
      conversationId: activeId,
      userMessage: {
        id: tempUserId,
        conversationId: activeId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      },
      assistant: {
        id: tempAssistantId,
        conversationId: activeId,
        role: 'assistant',
        content: '',
        reasoning: '',
        createdAt: new Date().toISOString(),
      },
    })

    try {
      await streamChatMessage(
        activeId,
        content,
        {
          onMeta: ({ userMessage, assistantMessageId }) => {
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    userMessage,
                    assistant: {
                      ...prev.assistant,
                      id: assistantMessageId,
                      conversationId: userMessage.conversationId,
                    },
                  }
                : prev,
            )
          },
          onReasoning: (delta) => {
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    assistant: {
                      ...prev.assistant,
                      reasoning: `${prev.assistant.reasoning ?? ''}${delta}`,
                    },
                  }
                : prev,
            )
          },
          onContent: (delta) => {
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    assistant: {
                      ...prev.assistant,
                      content: `${prev.assistant.content}${delta}`,
                    },
                  }
                : prev,
            )
          },
          onDone: ({ assistantMessage }) => {
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    assistant: assistantMessage,
                  }
                : prev,
            )
          },
          onError: (message) => {
            setError(new Error(message))
          },
        },
        controller.signal,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ai-chat-conversation', activeId] }),
        qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] }),
      ])
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err)
      }
    } finally {
      setStreaming(false)
      setStreamState(null)
      abortRef.current = null
    }
  }

  return (
    <div className="ai-chat-page">
      {moduleDisabled ? (
        <div className="error-banner">
          AI 对话模块当前不可用（可能已禁用）。请到{' '}
          <Link to="/app/modules">模块管理</Link> 启用 <code>ai-chat</code>。
        </div>
      ) : (
        <ErrorBanner error={statusQuery.error ?? listQuery.error ?? error} />
      )}

      {statusQuery.isLoading || listQuery.isLoading ? (
        <LoadingBlock />
      ) : moduleDisabled ? null : (
        <div className="chat-layout">
          <aside className="chat-sidebar">
            <div className="chat-sidebar-head">
              <button
                type="button"
                className="btn"
                style={{ width: '100%' }}
                disabled={createMut.isPending || streaming}
                onClick={() => createMut.mutate()}
              >
                新建对话
              </button>
            </div>
            <div className="chat-list">
              {(listQuery.data ?? []).length === 0 ? (
                <EmptyState>还没有会话</EmptyState>
              ) : (
                (listQuery.data ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chat-item${activeId === c.id ? ' active' : ''}`}
                    disabled={streaming}
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="title">{c.title}</div>
                    <div className="meta">{formatDate(c.updatedAt)}</div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="chat-main">
            {!activeId ? (
              <EmptyState>选择或创建一个会话</EmptyState>
            ) : detailQuery.isLoading ? (
              <LoadingBlock />
            ) : (
              <>
                <div
                  className="card-pad"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <strong>{detailQuery.data?.title}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {detailQuery.data?.model ?? '—'}
                      {streaming ? ' · 生成中' : ''}
                    </div>
                  </div>
                  <div className="btn-row">
                    {streaming ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => abortRef.current?.abort()}
                      >
                        停止
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={deleteMut.isPending || streaming}
                      onClick={() => {
                        if (activeId && confirm('删除该会话？')) {
                          deleteMut.mutate(activeId)
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="chat-messages">
                  {displayMessages.length === 0 ? (
                    <div className="bubble system">发送第一条消息开始对话</div>
                  ) : (
                    displayMessages.map((m) =>
                      m.role === 'assistant' ? (
                        <AssistantMessage
                          key={m.id}
                          message={m}
                          streaming={
                            streaming && streamState?.assistant.id === m.id
                          }
                        />
                      ) : (
                        <div key={m.id} className={`bubble ${m.role}`}>
                          {m.content}
                        </div>
                      ),
                    )
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form className="chat-composer" onSubmit={onSend}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
                    disabled={streaming}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void onSend(e)
                      }
                    }}
                  />
                  <button
                    className="btn"
                    type="submit"
                    disabled={streaming || !draft.trim()}
                  >
                    {streaming ? '生成中' : '发送'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
