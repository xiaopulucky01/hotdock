import { Global, Module, forwardRef } from '@nestjs/common';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Global()
@Module({
  imports: [forwardRef(() => ModuleRegistryModule)],
  controllers: [ObservabilityController, BackupController],
  providers: [ObservabilityService, BackupService],
  exports: [ObservabilityService, BackupService],
})
export class ObservabilityModule {}
