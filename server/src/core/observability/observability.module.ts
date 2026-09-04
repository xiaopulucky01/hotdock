import { Global, Module, forwardRef } from '@nestjs/common';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';

@Global()
@Module({
  imports: [forwardRef(() => ModuleRegistryModule)],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
