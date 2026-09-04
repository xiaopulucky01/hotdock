import { Global, Module, forwardRef } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { EventBusController } from './event-bus.controller';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  imports: [forwardRef(() => NotificationModule)],
  controllers: [EventBusController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
