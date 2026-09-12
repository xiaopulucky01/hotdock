import type { HotdockPlugin } from '../../core/contracts';
import { AI_CHAT_MANIFEST } from './ai-chat.manifest';
import { AiChatModule } from './ai-chat.module';
import { AiChatPluginService } from './ai-chat-plugin.service';

const plugin: HotdockPlugin = {
  manifest: AI_CHAT_MANIFEST,
  module: AiChatModule,
  lifecycle: AiChatPluginService,
};

export default plugin;
