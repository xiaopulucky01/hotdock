import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import type { OutboxStatus } from './outbox.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/outbox')
@UseGuards(AuthGuard, PermissionsGuard)
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Get()
  @RequirePermissions('platform.audit.read')
  list(@Query('status') status?: OutboxStatus) {
    return this.outbox.list(status);
  }

  @Post('flush')
  @RequirePermissions('platform.config.manage')
  flush() {
    return this.outbox.flush().then(() => ({ ok: true }));
  }
}
