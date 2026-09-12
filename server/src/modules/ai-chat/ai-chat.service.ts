import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlatformConfigService } from '../../core/config/config.service';
import { EventBusService } from '../../core/event-bus/event-bus.service';
import { DocumentRepository } from '../../core/persistence/document.repository';
import { QuotaService } from '../../core/tenant/quota.service';
import { AI_CHAT_MANIFEST } from './ai-chat.manifest';
import {
  ChatMessage,
  Conversation,
  ConversationWithMessages,
} from './ai-chat.types';
import { AiProvider } from './providers/ai-provider';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { splitReasoningContent } from './providers/reasoning.util';

type StoredConversation = {
  userId: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredMessage = {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  createdAt: string;
};

export type ChatSseEvent =
  | {
      type: 'meta';
      data: { userMessage: ChatMessage; assistantMessageId: string };
    }
  | { type: 'reasoning'; data: { delta: string } }
  | { type: 'content'; data: { delta: string } }
  | {
      type: 'done';
      data: {
        assistantMessage: ChatMessage;
        usage?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        };
      };
    }
  | { type: 'error'; data: { message: string } };

@Injectable()
export class AiChatService implements OnModuleInit {
  private readonly conversations = new Map<string, Conversation>();
  private readonly messages = new Map<string, ChatMessage[]>();
  private hydrated = false;

  constructor(
    private readonly config: PlatformConfigService,
    private readonly events: EventBusService,
    private readonly docs: DocumentRepository,
    private readonly quotas: QuotaService,
    private readonly mockProvider: MockAiProvider,
    private readonly openaiProvider: OpenAiCompatibleProvider,
  ) {}

  async onModuleInit() {
    await this.hydrate();
  }

  private async hydrate() {
    if (this.hydrated) return;
    const convPage = await this.docs.query<StoredConversation>(
      'ai-chat',
      'conversations',
      { limit: 10_000 },
    );
    for (const doc of convPage.items) {
      this.conversations.set(doc.id, {
        id: doc.id,
        userId: doc.userId,
        title: doc.title,
        model: doc.model,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
      });
    }
    const msgPage = await this.docs.query<StoredMessage>(
      'ai-chat',
      'messages',
      { limit: 50_000, orderBy: 'createdAt', orderDir: 'asc' },
    );
    for (const doc of msgPage.items) {
      const list = this.messages.get(doc.conversationId) ?? [];
      list.push({
        id: doc.id,
        conversationId: doc.conversationId,
        role: doc.role,
        content: doc.content,
        reasoning: doc.reasoning,
        createdAt: new Date(doc.createdAt),
      });
      this.messages.set(doc.conversationId, list);
    }
    this.hydrated = true;
  }

  private async persistConversation(c: Conversation) {
    const existing = await this.docs.findById<StoredConversation>(
      'ai-chat',
      'conversations',
      c.id,
    );
    const payload: StoredConversation = {
      userId: c.userId,
      title: c.title,
      model: c.model,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
    if (existing) {
      await this.docs.update('ai-chat', 'conversations', c.id, payload);
    } else {
      await this.docs.insert('ai-chat', 'conversations', payload, { id: c.id });
    }
  }

  private async persistMessage(m: ChatMessage) {
    await this.docs.insert<StoredMessage>(
      'ai-chat',
      'messages',
      {
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        reasoning: m.reasoning,
        createdAt: m.createdAt.toISOString(),
      },
      { id: m.id },
    );
  }

  createConversation(userId: string, title?: string): Conversation {
    const now = new Date();
    const conversation: Conversation = {
      id: randomUUID(),
      userId,
      title: title?.trim() || '新对话',
      model: this.config.get<string>('ai-chat.model', 'gpt-4o-mini'),
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    void this.persistConversation(conversation);

    void this.events.emit({
      name: 'ai-chat.conversation.created',
      source: AI_CHAT_MANIFEST.name,
      payload: { conversationId: conversation.id, userId },
    });

    return conversation;
  }

  listConversations(userId: string): Conversation[] {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getConversation(
    conversationId: string,
    userId: string,
  ): ConversationWithMessages {
    const conversation = this.requireOwned(conversationId, userId);
    return {
      ...conversation,
      messages: [...(this.messages.get(conversationId) ?? [])],
    };
  }

  updateConversation(
    conversationId: string,
    userId: string,
    patch: { title?: string },
  ): Conversation {
    const conversation = this.requireOwned(conversationId, userId);
    if (patch.title?.trim()) {
      conversation.title = patch.title.trim();
    }
    conversation.updatedAt = new Date();
    void this.persistConversation(conversation);
    return conversation;
  }

  deleteConversation(conversationId: string, userId: string) {
    this.requireOwned(conversationId, userId);
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
    void this.docs.delete('ai-chat', 'conversations', conversationId);
    return { deleted: true, id: conversationId };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }> {
    let final:
      | {
          userMessage: ChatMessage;
          assistantMessage: ChatMessage;
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          };
        }
      | undefined;

    for await (const event of this.sendMessageStream(
      conversationId,
      userId,
      content,
    )) {
      if (event.type === 'error') {
        throw new BadRequestException(event.data.message);
      }
      if (event.type === 'done') {
        const history = this.messages.get(conversationId) ?? [];
        const assistantMessage = event.data.assistantMessage;
        const userMessage = [...history]
          .reverse()
          .find((m) => m.role === 'user');
        if (!userMessage) {
          throw new BadRequestException('Stream completed without user message');
        }
        final = {
          userMessage,
          assistantMessage,
          usage: event.data.usage,
        };
      }
    }

    if (!final) {
      throw new BadRequestException('Stream produced no result');
    }
    return final;
  }

  async *sendMessageStream(
    conversationId: string,
    userId: string,
    content: string,
  ): AsyncGenerator<ChatSseEvent, void, unknown> {
    const text = content?.trim();
    if (!text) {
      yield { type: 'error', data: { message: 'Message content is required' } };
      return;
    }

    const conversation = this.requireOwned(conversationId, userId);
    const history = this.messages.get(conversationId) ?? [];

    const userMessage: ChatMessage = {
      id: randomUUID(),
      conversationId,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };
    history.push(userMessage);
    void this.persistMessage(userMessage);

    if (conversation.title === '新对话') {
      conversation.title =
        text.length > 32 ? `${text.slice(0, 32)}…` : text;
    }

    const assistantMessageId = randomUUID();
    yield {
      type: 'meta',
      data: { userMessage, assistantMessageId },
    };

    const systemPrompt =
      this.config.get<string>(
        'ai-chat.systemPrompt',
        '你是 Hotdock 的助手，回答简洁、准确、友好。',
      ) ?? '你是 Hotdock 的助手，回答简洁、准确、友好。';

    const provider = this.resolveProvider();
    const request = {
      model: conversation.model,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    let contentAcc = '';
    let reasoningAcc = '';
    let model = conversation.model ?? 'unknown';
    let usage:
      | {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        }
      | undefined;

    try {
      const stream =
        provider.stream?.(request) ??
        this.fallbackStreamFromComplete(provider, request);

      for await (const chunk of stream) {
        if (chunk.type === 'reasoning') {
          reasoningAcc += chunk.delta;
          yield { type: 'reasoning', data: { delta: chunk.delta } };
        } else if (chunk.type === 'content') {
          contentAcc += chunk.delta;
          yield { type: 'content', data: { delta: chunk.delta } };
        } else if (chunk.type === 'done') {
          model = chunk.model;
          usage = chunk.usage;
        }
      }
    } catch (err) {
      const idx = history.findIndex((m) => m.id === userMessage.id);
      if (idx >= 0) history.splice(idx, 1);
      this.messages.set(conversationId, history);
      yield {
        type: 'error',
        data: {
          message: (err as Error)?.message ?? 'AI stream failed',
        },
      };
      return;
    }

    const split = splitReasoningContent(contentAcc, reasoningAcc);
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: split.content || '（模型仅返回了思考过程，没有最终回答）',
      reasoning: split.reasoning,
      createdAt: new Date(),
    };
    history.push(assistantMessage);
    this.messages.set(conversationId, history);
    void this.persistMessage(assistantMessage);

    conversation.updatedAt = new Date();
    conversation.model = model;
    void this.persistConversation(conversation);

    const tokens = usage?.totalTokens ?? 0;
    if (tokens > 0) {
      try {
        this.quotas.recordUsage('tenant_default', { llmTokens: tokens });
      } catch {
        /* soft quota */
      }
    }

    void this.events.emit({
      name: 'ai-chat.message.created',
      source: AI_CHAT_MANIFEST.name,
      payload: {
        conversationId,
        userId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        provider: provider.name,
        model,
      },
    });

    yield {
      type: 'done',
      data: { assistantMessage, usage },
    };
  }

  providerStatus() {
    const name =
      this.config.get<string>('ai-chat.provider', 'mock') ?? 'mock';
    const hasKey = !!this.config.get<string>('ai-chat.apiKey', '');
    return {
      provider: name,
      model: this.config.get<string>('ai-chat.model', 'gpt-4o-mini'),
      baseUrl: this.config.get<string>(
        'ai-chat.baseUrl',
        'https://api.openai.com/v1',
      ),
      configured: name === 'mock' || hasKey,
      availableProviders: ['mock', 'openai-compatible'] as const,
    };
  }

  async probeModels(baseUrl: string, apiKey?: string) {
    const url = baseUrl?.trim();
    if (!url) {
      throw new BadRequestException('baseUrl is required');
    }
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('baseUrl 不是合法 URL');
    }
    const models = await this.openaiProvider.listModels(url, apiKey);
    return { baseUrl: url.replace(/\/$/, ''), models };
  }

  configureProvider(opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
  }) {
    const baseUrl = opts.baseUrl?.trim();
    const model = opts.model?.trim();
    const apiKey = opts.apiKey ?? '';

    if (!baseUrl) {
      throw new BadRequestException('baseUrl is required');
    }
    if (!model) {
      throw new BadRequestException('model is required');
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new BadRequestException('baseUrl 不是合法 URL');
    }

    this.config.setMany({
      'ai-chat.provider': 'openai-compatible',
      'ai-chat.baseUrl': baseUrl.replace(/\/$/, ''),
      'ai-chat.apiKey': apiKey,
      'ai-chat.model': model,
    });

    if (this.config.get('ai-chat.systemPrompt') === undefined) {
      this.config.set(
        'ai-chat.systemPrompt',
        '你是 AI Nest Platform 的助手，回答简洁、准确、友好。',
      );
    }
    if (this.config.get('ai-chat.temperature') === undefined) {
      this.config.set('ai-chat.temperature', 0.7);
    }
    if (this.config.get('ai-chat.maxTokens') === undefined) {
      this.config.set('ai-chat.maxTokens', 1024);
    }

    return this.providerStatus();
  }

  clearAll() {
    this.conversations.clear();
    this.messages.clear();
  }

  private async *fallbackStreamFromComplete(
    provider: AiProvider,
    request: Parameters<AiProvider['complete']>[0],
  ) {
    const result = await provider.complete(request);
    if (result.reasoning) {
      yield { type: 'reasoning' as const, delta: result.reasoning };
    }
    if (result.content) {
      yield { type: 'content' as const, delta: result.content };
    }
    yield {
      type: 'done' as const,
      model: result.model,
      usage: result.usage,
    };
  }

  private resolveProvider(): AiProvider {
    const name =
      this.config.get<string>('ai-chat.provider', 'mock') ?? 'mock';
    if (name === 'openai-compatible') {
      return this.openaiProvider;
    }
    return this.mockProvider;
  }

  private requireOwned(conversationId: string, userId: string): Conversation {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not own this conversation');
    }
    return conversation;
  }
}
