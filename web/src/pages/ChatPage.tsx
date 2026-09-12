import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { aiChatApi } from '../api'
import { ApiError } from '../api/client'
import type { ChatMessage } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { useChatRuntime } from '../chat/ChatRuntime'
import {
  ThinkingBlock,
  splitEmbeddedReasoning,
} from '../chat/ThinkingBlock'

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function errorText(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return '出错了'
}

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

export function ChatPage() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const runtime = useChatRuntime()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [localError, setLocalError] = useState<unknown>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      setLocalError(null)
      void qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] })
      setActiveId(conv.id)
      setSidebarOpen(false)
    },
    onError: (err) => setLocalError(err),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiChatApi.deleteConversation(id),
    onSuccess: (_data, id) => {
      setLocalError(null)
      void qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] })
      if (activeId === id) setActiveId(null)
    },
    onError: (err) => setLocalError(err),
  })

  const renameMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      aiChatApi.updateConversation(id, title),
    onSuccess: () => {
      setRenaming(false)
      void qc.invalidateQueries({ queryKey: ['ai-chat-conversations'] })
      if (activeId) {
        void qc.invalidateQueries({
          queryKey: ['ai-chat-conversation', activeId],
        })
      }
    },
    onError: (err) => setLocalError(err),
  })

  useEffect(() => {
    if (!activeId && listQuery.data && listQuery.data.length > 0) {
      setActiveId(listQuery.data[0].id)
    }
  }, [activeId, listQuery.data])

  const activeStream = activeId ? runtime.streams[activeId] : undefined
  const pendingUsers = activeId
    ? (runtime.pendingUsers[activeId] ?? [])
    : []
  const queueLen = activeId ? (runtime.queueLengths[activeId] ?? 0) : 0
  const isStreaming = Boolean(activeStream)

  const displayMessages = useMemo(() => {
    const base = detailQuery.data?.messages ?? []
    if (!activeId) return base

    const stream = runtime.streams[activeId]
    const pending = runtime.pendingUsers[activeId] ?? []
    const exclude = new Set<string>()

    let messages = [...base]
    if (stream) {
      exclude.add(stream.userMessage.id)
      exclude.add(stream.assistant.id)
      messages = messages.filter((m) => !exclude.has(m.id))
      messages.push(stream.userMessage, stream.assistant)
    }

    for (const p of pending) {
      if (!messages.some((m) => m.id === p.id)) {
        messages.push(p)
      }
    }

    return messages
  }, [
    activeId,
    detailQuery.data?.messages,
    runtime.pendingUsers,
    runtime.streams,
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [
    displayMessages,
    activeStream?.assistant.content,
    activeStream?.assistant.reasoning,
    pendingUsers.length,
  ])

  useEffect(() => {
    if (detailQuery.data && !renaming) {
      setTitleDraft(detailQuery.data.title)
    }
  }, [detailQuery.data, renaming])

  const moduleDisabled =
    statusQuery.error instanceof ApiError && statusQuery.error.statusCode === 503

  const bannerError =
    errorText(localError) ??
    errorText(statusQuery.error) ??
    errorText(listQuery.error) ??
    activeStream?.error ??
    (activeId ? runtime.errors[activeId] : undefined) ??
    null

  function onSend(e?: FormEvent) {
    e?.preventDefault()
    if (!activeId || !draft.trim()) return
    const content = draft.trim()
    setDraft('')
    setLocalError(null)
    runtime.send(activeId, content)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  function selectConversation(id: string) {
    setActiveId(id)
    setRenaming(false)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="brand-mark">
          <button
            type="button"
            className="btn btn-ghost btn-sm sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="切换会话列表"
          >
            菜单
          </button>
          <span className="brand-dot" aria-hidden />
          <h1>Hotdock</h1>
        </div>
        <div className="topbar-actions">
          <span className="user-chip">{user?.username ?? '—'}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void logout()}
          >
            退出
          </button>
        </div>
      </header>

      {moduleDisabled ? (
        <div className="error-banner">
          AI 对话模块不可用（可能未启用）。请在管理端启用 <code>ai-chat</code>。
        </div>
      ) : bannerError ? (
        <div className="error-banner">{bannerError}</div>
      ) : null}

      {statusQuery.isLoading || listQuery.isLoading ? (
        <div className="loading-block">加载会话…</div>
      ) : moduleDisabled ? null : (
        <div className="chat-layout">
          {sidebarOpen ? (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="关闭侧栏"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}

          <aside className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
            <div className="chat-sidebar-head">
              <button
                type="button"
                className="btn btn-block"
                disabled={createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                新建对话
              </button>
            </div>
            <div className="chat-list">
              {(listQuery.data ?? []).length === 0 ? (
                <div className="empty-state">还没有会话</div>
              ) : (
                (listQuery.data ?? []).map((c) => {
                  const status = runtime.getStatus(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`chat-item${activeId === c.id ? ' active' : ''}`}
                      onClick={() => selectConversation(c.id)}
                    >
                      <div className="title-row">
                        <span
                          className={`status-dot ${status !== 'idle' ? status : ''}`}
                          title={
                            status === 'streaming'
                              ? '生成中'
                              : status === 'queued'
                                ? '排队中'
                                : undefined
                          }
                        />
                        <div className="title">{c.title}</div>
                      </div>
                      <div className="meta">
                        {formatDate(c.updatedAt)}
                        {status === 'streaming'
                          ? ' · 生成中'
                          : status === 'queued'
                            ? ` · 排队 ${runtime.queueLengths[c.id] ?? 0}`
                            : ''}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="chat-main">
            {!activeId ? (
              <div className="empty-state">选择或创建一个会话</div>
            ) : detailQuery.isLoading ? (
              <div className="loading-block">加载消息…</div>
            ) : (
              <>
                <div className="chat-header">
                  <div>
                    {renaming ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (activeId && titleDraft.trim()) {
                            renameMut.mutate({
                              id: activeId,
                              title: titleDraft.trim(),
                            })
                          }
                        }}
                      >
                        <input
                          className="rename-input"
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          autoFocus
                          onBlur={() => {
                            if (activeId && titleDraft.trim() && titleDraft !== detailQuery.data?.title) {
                              renameMut.mutate({
                                id: activeId,
                                title: titleDraft.trim(),
                              })
                            } else {
                              setRenaming(false)
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <h2
                        style={{ cursor: 'text' }}
                        title="点击重命名"
                        onDoubleClick={() => setRenaming(true)}
                      >
                        {detailQuery.data?.title}
                      </h2>
                    )}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {detailQuery.data?.model ?? '—'}
                      {isStreaming ? ' · 生成中' : ''}
                      {queueLen > 0 ? ` · 排队 ${queueLen}` : ''}
                    </div>
                  </div>
                  <div className="btn-row">
                    {isStreaming ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => activeId && runtime.abort(activeId)}
                      >
                        停止
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setRenaming(true)}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={deleteMut.isPending}
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
                    displayMessages.map((m) => {
                      const isPending = pendingUsers.some((p) => p.id === m.id)
                      const streamingThis =
                        isStreaming &&
                        activeStream?.assistant.id === m.id

                      if (m.role === 'assistant') {
                        return (
                          <AssistantMessage
                            key={m.id}
                            message={m}
                            streaming={streamingThis}
                          />
                        )
                      }

                      return (
                        <div key={m.id} className="user-turn">
                          <div
                            className={`bubble user${isPending ? ' pending-user' : ''}`}
                          >
                            {m.content}
                          </div>
                          {isPending ? (
                            <div className="queue-badge">排队等待发送</div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-composer" onSubmit={onSend}>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
                    rows={2}
                  />
                  <button
                    className="btn"
                    type="submit"
                    disabled={!draft.trim()}
                  >
                    发送
                  </button>
                  <div className="composer-meta">
                    <span>
                      {isStreaming
                        ? '当前会话生成中，继续发送将自动排队'
                        : queueLen > 0
                          ? `已排队 ${queueLen} 条`
                          : '可同时在多个会话中对话'}
                    </span>
                    <span>双击标题可重命名</span>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
