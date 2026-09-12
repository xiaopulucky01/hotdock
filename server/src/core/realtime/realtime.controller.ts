import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RealtimeService, RealtimeMessage } from './realtime.service';
import {
  AuthGuard,
  PermissionsGuard,
  Public,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get('stats')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('platform.audit.read')
  stats() {
    return this.realtime.stats();
  }

  /**
   * SSE stream. Pass Authorization header or ?token=.
   * Marked public so AuthGuard does not block; auth optional for subscribe.
   */
  @Public()
  @Get('sse')
  sse(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (msg: RealtimeMessage) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    };
    send({
      type: 'realtime.welcome',
      payload: { transport: 'sse' },
      at: new Date().toISOString(),
    });
    const unsub = this.realtime.subscribeSse(send);
    req.on('close', () => unsub());
  }
}
