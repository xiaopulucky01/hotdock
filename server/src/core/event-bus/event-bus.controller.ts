import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/events')
@UseGuards(AuthGuard, PermissionsGuard)
export class EventBusController {
  constructor(private readonly events: EventBusService) {}

  @Get('recent')
  @RequirePermissions('platform.audit.read')
  recent(
    @Query('limit') limit?: string,
    @Query('name') name?: string,
  ) {
    return this.events.recent(limit ? Number(limit) : 50, name);
  }

  @Get('dead-letters')
  @RequirePermissions('platform.audit.read')
  deadLetters(@Query('limit') limit?: string) {
    return this.events.listDeadLetters(limit ? Number(limit) : 50);
  }
}
