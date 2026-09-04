import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthGuard,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '../../core/gateway';
import type { AuthenticatedUser } from '../../core/contracts';
import { ModuleRegistryService } from '../../core/module-registry/module-registry.service';
import { AI_CHAT_MANIFEST } from './ai-chat.manifest';
import { AiChatService } from './ai-chat.service';

@Controller('api/ai-chat')
@UseGuards(AuthGuard, PermissionsGuard)
export class AiChatController {
  constructor(
    private readonly chat: AiChatService,
    private readonly registry: ModuleRegistryService,
  ) {}

  @Get('status')
  @RequirePermissions('ai-chat.read')
  status() {
    this.assertEnabled();
    return { enabled: true, ...this.chat.providerStatus() };
  }

  @Post('models/probe')
  @RequirePermissions('ai-chat.write')
  probeModels(
    @Body() body: { baseUrl?: string; apiKey?: string },
  ) {
    this.assertEnabled();
    return this.chat.probeModels(body?.baseUrl ?? '', body?.apiKey);
  }

  @Post('configure')
  @RequirePermissions('ai-chat.write')
  configure(
    @Body()
    body: { baseUrl?: string; apiKey?: string; model?: string },
  ) {
    this.assertEnabled();
    return this.chat.configureProvider({
      baseUrl: body?.baseUrl ?? '',
      apiKey: body?.apiKey ?? '',
      model: body?.model ?? '',
    });
  }

  @Get('conversations')
  @RequirePermissions('ai-chat.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.chat.listConversations(user.id);
  }

  @Post('conversations')
  @RequirePermissions('ai-chat.write')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title?: string },
  ) {
    this.assertEnabled();
    return this.chat.createConversation(user.id, body?.title);
  }

  @Get('conversations/:id')
  @RequirePermissions('ai-chat.read')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    this.assertEnabled();
    return this.chat.getConversation(id, user.id);
  }

  @Patch('conversations/:id')
  @RequirePermissions('ai-chat.write')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { title?: string },
  ) {
    this.assertEnabled();
    return this.chat.updateConversation(id, user.id, body ?? {});
  }

  @Delete('conversations/:id')
  @RequirePermissions('ai-chat.write')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    this.assertEnabled();
    return this.chat.deleteConversation(id, user.id);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('ai-chat.write')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    this.assertEnabled();
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
    this.assertEnabled();

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

  private assertEnabled() {
    if (!this.registry.isEnabled(AI_CHAT_MANIFEST.name)) {
      throw new ServiceUnavailableException('AI Chat module is disabled');
    }
  }
}
