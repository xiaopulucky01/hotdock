import { Global, Module } from '@nestjs/common';
import { EventBusController } from './event-bus.controller';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  controllers: [EventBusController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
