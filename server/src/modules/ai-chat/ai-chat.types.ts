export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  /** Model chain-of-thought / reasoning, when the provider returns it */
  reasoning?: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  model?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[];
}

export interface ChatCompletionRequest {
  messages: Array<{ role: ChatRole; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  /** Separated thinking / reasoning text when available */
  reasoning?: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** Incremental chunks from a streaming provider */
export type ChatStreamChunk =
  | { type: 'reasoning'; delta: string }
  | { type: 'content'; delta: string }
  | {
      type: 'done';
      model: string;
      usage?: ChatCompletionResult['usage'];
    };
