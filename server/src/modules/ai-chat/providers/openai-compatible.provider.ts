import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlatformConfigService } from '../../../core/config/config.service';
import { AiProvider } from './ai-provider';
import {
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatStreamChunk,
} from '../ai-chat.types';
import { splitReasoningContent } from './reasoning.util';

/**
 * Calls any OpenAI-compatible Chat Completions API via fetch
 * (OpenAI, Azure OpenAI proxy, DeepSeek, Ollama openai shim, etc.).
 */
@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible';
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  constructor(private readonly config: PlatformConfigService) {}

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const { apiKey, baseUrl, model, temperature, maxTokens } =
      this.resolveOptions(request);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
    } catch (err) {
      this.logger.error(`Provider request failed: ${(err as Error).message}`);
      throw new BadGatewayException('Failed to reach AI provider');
    }

    const raw = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning_content?: string | null;
          reasoning?: string | null;
        };
      }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    if (!response.ok) {
      const detail = raw.error?.message ?? response.statusText;
      this.logger.warn(`Provider error ${response.status}: ${detail}`);
      throw new BadGatewayException(`AI provider error: ${detail}`);
    }

    const message = raw.choices?.[0]?.message;
    const split = splitReasoningContent(
      message?.content,
      message?.reasoning_content ?? message?.reasoning,
    );

    if (!split.content && !split.reasoning) {
      throw new BadGatewayException('AI provider returned empty content');
    }

    return {
      content: split.content || '（模型仅返回了思考过程，没有最终回答）',
      reasoning: split.reasoning,
      model: raw.model ?? model,
      provider: this.name,
      usage: {
        promptTokens: raw.usage?.prompt_tokens,
        completionTokens: raw.usage?.completion_tokens,
        totalTokens: raw.usage?.total_tokens,
      },
    };
  }

  async *stream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const { apiKey, baseUrl, model, temperature, maxTokens } =
      this.resolveOptions(request);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });
    } catch (err) {
      this.logger.error(`Provider stream failed: ${(err as Error).message}`);
      throw new BadGatewayException('Failed to reach AI provider');
    }

    if (!response.ok) {
      const raw = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const detail = raw.error?.message ?? response.statusText;
      this.logger.warn(`Provider stream error ${response.status}: ${detail}`);
      throw new BadGatewayException(`AI provider error: ${detail}`);
    }

    if (!response.body) {
      throw new BadGatewayException('AI provider returned empty stream body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resolvedModel = model;
    let usage: ChatCompletionResult['usage'] | undefined;
    let sawAny = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          yield {
            type: 'done',
            model: resolvedModel,
            usage,
          };
          return;
        }

        let json: {
          model?: string;
          choices?: Array<{
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
              reasoning?: string | null;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }

        if (json.model) resolvedModel = json.model;
        if (json.usage) {
          usage = {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          };
        }

        const delta = json.choices?.[0]?.delta;
        const reasoningDelta =
          delta?.reasoning_content ?? delta?.reasoning ?? '';
        const contentDelta = delta?.content ?? '';

        if (reasoningDelta) {
          sawAny = true;
          yield { type: 'reasoning', delta: reasoningDelta };
        }
        if (contentDelta) {
          sawAny = true;
          yield { type: 'content', delta: contentDelta };
        }
      }
    }

    if (!sawAny) {
      throw new BadGatewayException('AI provider returned empty stream');
    }

    yield {
      type: 'done',
      model: resolvedModel,
      usage,
    };
  }

  /**
   * Probe an OpenAI-compatible `/models` endpoint with the given credentials
   * (does not read from saved platform config — used for one-click setup).
   */
  async listModels(
    baseUrl: string,
    apiKey?: string,
  ): Promise<{ id: string; ownedBy?: string }[]> {
    const root = baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    let response: Response;
    try {
      response = await fetch(`${root}/models`, { method: 'GET', headers });
    } catch (err) {
      this.logger.error(`List models failed: ${(err as Error).message}`);
      throw new BadGatewayException('无法连接 AI 服务商，请检查 Base URL');
    }

    const raw = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      data?: Array<{ id?: string; owned_by?: string }>;
    };

    if (!response.ok) {
      const detail = raw.error?.message ?? response.statusText;
      this.logger.warn(`List models error ${response.status}: ${detail}`);
      throw new BadGatewayException(`拉取模型列表失败: ${detail}`);
    }

    const models = (raw.data ?? [])
      .map((m) => ({
        id: m.id?.trim() ?? '',
        ownedBy: m.owned_by,
      }))
      .filter((m) => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) {
      throw new BadGatewayException('服务商未返回可用模型');
    }

    return models;
  }

  private resolveOptions(request: ChatCompletionRequest) {
    const apiKey = this.config.get<string>('ai-chat.apiKey', '');
    const baseUrl = (
      this.config.get<string>(
        'ai-chat.baseUrl',
        'https://api.openai.com/v1',
      ) ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model =
      request.model ??
      this.config.get<string>('ai-chat.model', 'gpt-4o-mini') ??
      'gpt-4o-mini';

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ai-chat.apiKey is not configured for openai-compatible provider',
      );
    }

    const temperature =
      request.temperature ??
      this.config.get<number>('ai-chat.temperature', 0.7) ??
      0.7;
    const maxTokens =
      request.maxTokens ??
      this.config.get<number>('ai-chat.maxTokens', 1024) ??
      1024;

    return { apiKey, baseUrl, model, temperature, maxTokens };
  }
}
