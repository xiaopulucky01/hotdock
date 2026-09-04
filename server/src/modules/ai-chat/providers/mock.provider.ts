import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider';
import {
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatStreamChunk,
} from '../ai-chat.types';

/**
 * Offline fallback when no API key is configured.
 * Echoes the last user message with a short platform-style reply.
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const { prompt, content, reasoning } = this.build(request);
    return {
      content,
      reasoning,
      model: request.model ?? 'mock-echo',
      provider: this.name,
      usage: {
        promptTokens: prompt.length,
        completionTokens: content.length,
        totalTokens: prompt.length + content.length,
      },
    };
  }

  async *stream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const { prompt, content, reasoning } = this.build(request);
    for (const delta of this.chunkText(reasoning, 18)) {
      yield { type: 'reasoning', delta };
      await this.delay(25);
    }
    for (const delta of this.chunkText(content, 12)) {
      yield { type: 'content', delta };
      await this.delay(20);
    }
    yield {
      type: 'done',
      model: request.model ?? 'mock-echo',
      usage: {
        promptTokens: prompt.length,
        completionTokens: content.length,
        totalTokens: prompt.length + content.length,
      },
    };
  }

  private build(request: ChatCompletionRequest) {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const prompt = lastUser?.content?.trim() || '(empty)';
    const content = [
      '[Mock AI] 当前未配置真实模型，返回模拟回复。',
      '',
      `你说：${prompt}`,
      '',
      '可在配置中设置 ai-chat.provider=openai-compatible 与 ai-chat.apiKey 接入 OpenAI 兼容接口。',
    ].join('\n');
    const reasoning = [
      '这是 Mock 提供商的模拟思考过程。',
      `识别到用户输入：「${prompt}」`,
      '因未配置真实模型，生成固定说明性回复。',
    ].join('\n');
    return { prompt, content, reasoning };
  }

  private chunkText(text: string, size: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      out.push(text.slice(i, i + size));
    }
    return out;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
