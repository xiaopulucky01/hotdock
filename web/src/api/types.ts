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

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
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
