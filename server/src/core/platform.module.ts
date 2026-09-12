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
import { PluginRuntimeModule } from './plugin-runtime/plugin-runtime.module';
import { SecretsModule } from './secrets/secrets.module';
import { DistributedModule } from './distributed/distributed.module';
import { CommandModule } from './command/command.module';
import { WorkflowModule } from './workflow/workflow.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PluginPackModule } from './plugin-pack/plugin-pack.module';

/**
 * Platform Core — import this once in AppModule.
 * Business modules are discovered/loaded by PluginRuntime — not statically imported here.
 */
@Module({
  imports: [
    PersistenceModule,
    SecretsModule,
    CacheModule,
    DistributedModule,
    NotificationModule,
    EventBusModule,
    JobModule,
    StorageModule,
    ExtensionModule,
    CommandModule,
    WorkflowModule,
    ConfigModule,
    FeatureFlagModule,
    TenantModule,
    UserModule,
    RbacModule,
    IdentityModule,
    ModuleRegistryModule,
    PluginRuntimeModule,
    PluginPackModule,
    AuditModule,
    ObservabilityModule,
    RealtimeModule,
    GatewayModule,
  ],
  exports: [
    PersistenceModule,
    SecretsModule,
    CacheModule,
    DistributedModule,
    NotificationModule,
    EventBusModule,
    JobModule,
    StorageModule,
    ExtensionModule,
    CommandModule,
    WorkflowModule,
    ConfigModule,
    FeatureFlagModule,
    TenantModule,
    UserModule,
    RbacModule,
    IdentityModule,
    ModuleRegistryModule,
    PluginRuntimeModule,
    PluginPackModule,
    AuditModule,
    ObservabilityModule,
    RealtimeModule,
    GatewayModule,
  ],
})
export class PlatformModule {}
