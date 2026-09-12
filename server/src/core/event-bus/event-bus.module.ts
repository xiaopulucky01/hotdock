import { Global, Module, forwardRef } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { EventBusController } from './event-bus.controller';
import { EventBusService } from './event-bus.service';
import { OutboxService } from './outbox.service';
import { OutboxController } from './outbox.controller';

@Global()
@Module({
  imports: [forwardRef(() => NotificationModule)],
  controllers: [EventBusController, OutboxController],
  providers: [EventBusService, OutboxService],
  exports: [EventBusService, OutboxService],
})
export class EventBusModule {}
