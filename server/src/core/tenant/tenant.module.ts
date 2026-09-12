import { Global, Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { QuotaService } from './quota.service';
import { TenantModulesService } from './tenant-modules.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantPolicyController } from './tenant-policy.controller';

@Global()
@Module({
  controllers: [TenantController, TenantPolicyController],
  providers: [
    TenantService,
    QuotaService,
    TenantModulesService,
    TenantConfigService,
  ],
  exports: [
    TenantService,
    QuotaService,
    TenantModulesService,
    TenantConfigService,
  ],
})
export class TenantModule {}
