import { Controller, Get, Query } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

@Controller('api/platform/events')
export class EventBusController {
  constructor(private readonly events: EventBusService) {}

  @Get('recent')
  recent(
    @Query('limit') limit?: string,
    @Query('name') name?: string,
  ) {
    return this.events.recent(limit ? Number(limit) : 50, name);
  }
}
