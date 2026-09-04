import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PluginLifecycle } from '../../core/contracts';
import { ModuleRegistryService } from '../../core/module-registry/module-registry.service';
import { ExtensionService } from '../../core/extension/extension.service';
import { PlatformConfigService } from '../../core/config/config.service';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { AI_CHAT_MANIFEST } from './ai-chat.manifest';
import { AiChatService } from './ai-chat.service';

@Injectable()
export class AiChatPluginService implements OnModuleInit, PluginLifecycle {
  private readonly logger = new Logger(AiChatPluginService.name);

  constructor(
    private readonly registry: ModuleRegistryService,
    private readonly extensions: ExtensionService,
    private readonly config: PlatformConfigService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly chat: AiChatService,
  ) {}

  async onModuleInit() {
    this.registry.register(AI_CHAT_MANIFEST, this);
    if (this.registry.shouldAutoEnable(AI_CHAT_MANIFEST.name)) {
      await this.registry.enable(AI_CHAT_MANIFEST.name);
    }
  }

  async onInstall() {
    const envKey = process.env.OPENAI_API_KEY ?? process.env.AI_CHAT_API_KEY;
    const envBase = process.env.AI_CHAT_BASE_URL;
    const envModel = process.env.AI_CHAT_MODEL;
    const envProvider = process.env.AI_CHAT_PROVIDER;

    this.config.registerSchema([
      { key: 'ai-chat.provider', type: 'string', default: 'mock' },
      { key: 'ai-chat.apiKey', type: 'string', secret: true },
      { key: 'ai-chat.baseUrl', type: 'string' },
      { key: 'ai-chat.model', type: 'string' },
      { key: 'ai-chat.systemPrompt', type: 'string' },
      { key: 'ai-chat.temperature', type: 'number', default: 0.7 },
      { key: 'ai-chat.maxTokens', type: 'number', default: 1024 },
    ]);

    this.config.setMany({
      'ai-chat.provider':
        envProvider ?? (envKey ? 'openai-compatible' : 'mock'),
      'ai-chat.apiKey': envKey ?? '',
      'ai-chat.baseUrl': envBase ?? 'https://api.openai.com/v1',
      'ai-chat.model': envModel ?? 'gpt-4o-mini',
      'ai-chat.systemPrompt':
        '你是 AI Nest Platform 的助手，回答简洁、准确、友好。',
      'ai-chat.temperature': 0.7,
      'ai-chat.maxTokens': 1024,
    });

    const userRole = this.rbac.getRole('role.user');
    if (userRole) {
      const codes = new Set([
        ...userRole.permissionCodes,
        'ai-chat.read',
        'ai-chat.write',
      ]);
      this.rbac.upsertRole({
        ...userRole,
        permissionCodes: [...codes],
      });
    }

    this.audit.record({
      module: AI_CHAT_MANIFEST.name,
      action: 'module.install',
      detail: { version: AI_CHAT_MANIFEST.version },
    });
  }

  async onEnable() {
    this.extensions.contribute('platform.nav.items', {
      id: 'ai-chat.nav',
      module: AI_CHAT_MANIFEST.name,
      priority: 20,
      feature: 'ai-chat.enabled',
      data: { label: 'AI 对话', path: '/ai-chat' },
    });

    this.logger.log(
      `AI Chat enabled (provider=${this.config.get('ai-chat.provider')})`,
    );
  }

  async onDisable() {
    this.extensions.removeModule(AI_CHAT_MANIFEST.name);
    this.logger.log('AI Chat module disabled');
  }

  async onUninstall() {
    this.chat.clearAll();
    for (const key of AI_CHAT_MANIFEST.configKeys ?? []) {
      this.config.delete(key);
    }
    this.audit.record({
      module: AI_CHAT_MANIFEST.name,
      action: 'module.uninstall',
    });
  }
}
