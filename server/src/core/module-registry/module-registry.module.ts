import { Global, Module, forwardRef } from '@nestjs/common';
import { EventBusModule } from '../event-bus/event-bus.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { ModuleRegistryController } from './module-registry.controller';
import { ModuleRegistryService } from './module-registry.service';

@Global()
@Module({
  imports: [forwardRef(() => EventBusModule), RbacModule, FeatureFlagModule],
  controllers: [ModuleRegistryController],
  providers: [ModuleRegistryService],
  exports: [ModuleRegistryService],
})
export class ModuleRegistryModule {}
