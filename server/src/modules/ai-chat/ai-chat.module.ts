import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatPluginService } from './ai-chat-plugin.service';
import { AiChatService } from './ai-chat.service';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  controllers: [AiChatController],
  providers: [
    AiChatPluginService,
    AiChatService,
    MockAiProvider,
    OpenAiCompatibleProvider,
  ],
  exports: [AiChatService],
})
export class AiChatModule {}
