import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { JobModule } from './job/job.module';
import { StorageModule } from './storage/storage.module';
import { ExtensionModule } from './extension/extension.module';
import { UserModule } from './user/user.module';
import { RbacModule } from './rbac/rbac.module';
import { IdentityModule } from './identity/identity.module';
import { TenantModule } from './tenant/tenant.module';
import { ConfigModule } from './config/config.module';
import { FeatureFlagModule } from './feature-flag/feature-flag.module';
import { ModuleRegistryModule } from './module-registry/module-registry.module';
import { AuditModule } from './audit/audit.module';
import { ObservabilityModule } from './observability/observability.module';
import { GatewayModule } from './gateway/gateway.module';
import { CacheModule } from './cache/cache.module';
import { NotificationModule } from './notification/notification.module';

/**
 * Platform Core — import this once in AppModule.
 * Business feature modules import contracts/services they need, not each other.
 */
@Module({
  imports: [
    PersistenceModule,
    CacheModule,
    NotificationModule,
    EventBusModule,
    JobModule,
    StorageModule,
    ExtensionModule,
    ConfigModule,
    FeatureFlagModule,
    TenantModule,
    UserModule,
    RbacModule,
    IdentityModule,
    ModuleRegistryModule,
    AuditModule,
    ObservabilityModule,
    GatewayModule,
  ],
  exports: [
    PersistenceModule,
    CacheModule,
    NotificationModule,
    EventBusModule,
    JobModule,
    StorageModule,
    ExtensionModule,
    ConfigModule,
    FeatureFlagModule,
    TenantModule,
    UserModule,
    RbacModule,
    IdentityModule,
    ModuleRegistryModule,
    AuditModule,
    ObservabilityModule,
    GatewayModule,
  ],
})
export class PlatformModule {}
