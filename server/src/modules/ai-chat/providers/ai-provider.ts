import { ChatCompletionRequest, ChatStreamChunk } from '../ai-chat.types';

export interface AiProvider {
  readonly name: string;
  complete(
    request: ChatCompletionRequest,
  ): Promise<import('../ai-chat.types').ChatCompletionResult>;
  /**
   * Optional streaming. Providers that don't override fall back via service.
   */
  stream?(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatStreamChunk, void, unknown>;
}
