import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { RequestContextInterceptor } from './request-context.interceptor';

@Global()
@Module({
  imports: [
    IdentityModule,
    RbacModule,
    FeatureFlagModule,
    ObservabilityModule,
  ],
  providers: [
    AuthGuard,
    PermissionsGuard,
    RateLimitGuard,
    RequestContextInterceptor,
  ],
  exports: [
    AuthGuard,
    PermissionsGuard,
    RateLimitGuard,
    RequestContextInterceptor,
    IdentityModule,
    RbacModule,
  ],
})
export class GatewayModule {}
