import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  AiChatStatus,
  AuthTokens,
  AuthenticatedUser,
  Conversation,
  ConversationWithMessages,
} from './types'
import {
  streamChatMessage,
  type ChatStreamHandlers,
} from './stream'

export const authApi = {
  login: (body: { username: string; password: string; tenantId?: string }) =>
    apiPost<AuthTokens>('/api/platform/auth/login', body),
  refresh: (refreshToken: string) =>
    apiPost<AuthTokens>('/api/platform/auth/refresh', { refreshToken }),
  logout: () => apiPost<{ ok: boolean }>('/api/platform/auth/logout'),
  me: () => apiGet<AuthenticatedUser>('/api/platform/auth/me'),
}

export const aiChatApi = {
  status: () => apiGet<AiChatStatus>('/api/ai-chat/status'),
  listConversations: () => apiGet<Conversation[]>('/api/ai-chat/conversations'),
  createConversation: (title?: string) =>
    apiPost<Conversation>('/api/ai-chat/conversations', { title }),
  getConversation: (id: string) =>
    apiGet<ConversationWithMessages>(`/api/ai-chat/conversations/${id}`),
  updateConversation: (id: string, title: string) =>
    apiPatch<Conversation>(`/api/ai-chat/conversations/${id}`, { title }),
  deleteConversation: (id: string) =>
    apiDelete<{ deleted: boolean; id: string }>(
      `/api/ai-chat/conversations/${id}`,
    ),
  streamMessage: (
    id: string,
    content: string,
    handlers: ChatStreamHandlers,
    signal?: AbortSignal,
  ) => streamChatMessage(id, content, handlers, signal),
}
