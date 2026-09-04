import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { ObservabilityModule } from '../observability/observability.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { TenantGuard } from './tenant.guard';
import { ModuleEnabledGuard } from './module-enabled.guard';
import { RequestContextInterceptor } from './request-context.interceptor';

@Global()
@Module({
  imports: [
    IdentityModule,
    RbacModule,
    FeatureFlagModule,
    ObservabilityModule,
    TenantModule,
  ],
  providers: [
    AuthGuard,
    PermissionsGuard,
    RateLimitGuard,
    TenantGuard,
    ModuleEnabledGuard,
    RequestContextInterceptor,
  ],
  exports: [
    AuthGuard,
    PermissionsGuard,
    RateLimitGuard,
    TenantGuard,
    ModuleEnabledGuard,
    RequestContextInterceptor,
    IdentityModule,
    RbacModule,
    TenantModule,
  ],
})
export class GatewayModule {}
