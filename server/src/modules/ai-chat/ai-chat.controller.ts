import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthGuard,
  CurrentUser,
  ModuleEnabledGuard,
  PermissionsGuard,
  RequireModule,
  RequirePermissions,
} from '../../core/gateway';
import type { AuthenticatedUser } from '../../core/contracts';
import { AI_CHAT_MANIFEST } from './ai-chat.manifest';
import { AiChatService } from './ai-chat.service';

@Controller('api/ai-chat')
@RequireModule(AI_CHAT_MANIFEST.name)
@UseGuards(AuthGuard, PermissionsGuard, ModuleEnabledGuard)
export class AiChatController {
  constructor(private readonly chat: AiChatService) {}

  @Get('status')
  @RequirePermissions('ai-chat.read')
  status() {
    return { enabled: true, ...this.chat.providerStatus() };
  }

  @Post('models/probe')
  @RequirePermissions('ai-chat.write')
  probeModels(
    @Body() body: { baseUrl?: string; apiKey?: string },
  ) {
    return this.chat.probeModels(body?.baseUrl ?? '', body?.apiKey);
  }

  @Post('configure')
  @RequirePermissions('ai-chat.write')
  configure(
    @Body()
    body: { baseUrl?: string; apiKey?: string; model?: string },
  ) {
    return this.chat.configureProvider({
      baseUrl: body?.baseUrl ?? '',
      apiKey: body?.apiKey ?? '',
      model: body?.model ?? '',
    });
  }

  @Get('conversations')
  @RequirePermissions('ai-chat.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user.id);
  }

  @Post('conversations')
  @RequirePermissions('ai-chat.write')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title?: string },
  ) {
    return this.chat.createConversation(user.id, body?.title);
  }

  @Get('conversations/:id')
  @RequirePermissions('ai-chat.read')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.chat.getConversation(id, user.id);
  }

  @Patch('conversations/:id')
  @RequirePermissions('ai-chat.write')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { title?: string },
  ) {
    return this.chat.updateConversation(id, user.id, body ?? {});
  }

  @Delete('conversations/:id')
  @RequirePermissions('ai-chat.write')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.chat.deleteConversation(id, user.id);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('ai-chat.write')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.chat.sendMessage(id, user.id, body?.content ?? '');
  }

  @Post('conversations/:id/messages/stream')
  @RequirePermissions('ai-chat.write')
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { content: string },
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const event of this.chat.sendMessageStream(
        id,
        user.id,
        body?.content ?? '',
      )) {
        write(event.type, event.data);
        if (event.type === 'error' || event.type === 'done') {
          break;
        }
      }
    } catch (err) {
      write('error', {
        message: (err as Error)?.message ?? 'Stream failed',
      });
    } finally {
      res.end();
    }
  }
}
