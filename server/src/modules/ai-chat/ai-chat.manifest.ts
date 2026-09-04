import { ModuleManifest } from '../../core/contracts';

export const AI_CHAT_MANIFEST: ModuleManifest = {
  name: 'ai-chat',
  version: '1.0.0',
  displayName: 'AI Chat',
  description: 'Hot-pluggable AI conversation module with pluggable providers',
  author: 'platform',
  dependencies: [],
  permissions: [
    { code: 'ai-chat.read', name: '查看 AI 对话' },
    { code: 'ai-chat.write', name: '发送 AI 对话' },
  ],
  routes: [{ prefix: 'ai-chat', version: '1' }],
  events: [
    {
      name: 'ai-chat.conversation.created',
      description: 'A new conversation was created',
      payloadHint: { conversationId: 'string', userId: 'string' },
    },
    {
      name: 'ai-chat.message.created',
      description: 'User and assistant messages were created',
      payloadHint: {
        conversationId: 'string',
        userId: 'string',
        provider: 'string',
        model: 'string',
      },
    },
  ],
  hooks: [{ slot: 'platform.nav.items', description: 'Contribute AI Chat nav' }],
  features: ['ai-chat.enabled'],
  configKeys: [
    'ai-chat.provider',
    'ai-chat.apiKey',
    'ai-chat.baseUrl',
    'ai-chat.model',
    'ai-chat.systemPrompt',
    'ai-chat.temperature',
    'ai-chat.maxTokens',
  ],
};
