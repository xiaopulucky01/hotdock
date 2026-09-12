/**
 * @hotdock/sdk — stable surface for plugin authors.
 * Import from this module instead of deep core paths.
 */
export const HOTDOCK_SDK_VERSION = '1.0.0';
export { HOTDOCK_CORE_API } from '../core/plugin-pack/plugin-package.service';

export type {
  HotdockPlugin,
  ModuleManifest,
  ModuleDependency,
  ModulePermissionDef,
  ModuleRouteDef,
  ModuleEventDef,
  ModuleHookDef,
  PluginLifecycle,
  PlatformEvent,
  EventHandler,
  ExtensionContribution,
  ExtensionHandler,
  ExtensionHandlerContribution,
  AuthenticatedUser,
  AuthTokens,
  ConfigKeySchema,
} from '../core/contracts';

export { PLATFORM_EVENTS } from '../core/contracts';

export { PlatformConfigService } from '../core/config/config.service';
export { EventBusService } from '../core/event-bus/event-bus.service';
export { OutboxService } from '../core/event-bus/outbox.service';
export { JobSchedulerService } from '../core/job/job-scheduler.service';
export { StorageService } from '../core/storage/storage.service';
export { ExtensionService } from '../core/extension/extension.service';
export { DocumentRepository } from '../core/persistence/document.repository';
export { MigrationService } from '../core/persistence/migration.service';
export { PersistenceService } from '../core/persistence/persistence.service';
export { CacheService } from '../core/cache/cache.service';
export { LockService } from '../core/distributed/lock.service';
export { IdempotencyService } from '../core/distributed/idempotency.service';
export { Idempotent } from '../core/distributed/idempotency.interceptor';
export { CommandBusService } from '../core/command/command-bus.service';
export { WorkflowService } from '../core/workflow/workflow.service';
export { SecretsService } from '../core/secrets/secrets.service';
export { QuotaService } from '../core/tenant/quota.service';
export { TenantConfigService } from '../core/tenant/tenant-config.service';
export { ResourceAclService } from '../core/rbac/resource-acl.service';
export { RealtimeService } from '../core/realtime/realtime.service';
export { AuditService } from '../core/audit/audit.service';
export { FeatureFlagService } from '../core/feature-flag/feature-flag.service';

export {
  Public,
  RequirePermissions,
  RequireModule,
  CurrentUser,
  CurrentTenant,
  AuthGuard,
  PermissionsGuard,
  ModuleEnabledGuard,
} from '../core/gateway';

import type { HotdockPlugin } from '../core/contracts';

/** Helper to define a typed plugin entry (identity + autocomplete). */
export function definePlugin(plugin: HotdockPlugin): HotdockPlugin {
  return plugin;
}

export interface CreatePluginOptions extends HotdockPlugin {
  /** Optional package meta for hotdock-plugin.json generation */
  coreApi?: string;
  capabilities?: string[];
}

export function createPlugin(options: CreatePluginOptions): HotdockPlugin {
  const manifest = {
    ...options.manifest,
    coreApi: options.manifest.coreApi ?? options.coreApi ?? '^1.0.0',
    capabilities:
      options.manifest.capabilities ?? options.capabilities ?? [],
  };
  return {
    manifest,
    module: options.module,
    lifecycle: options.lifecycle,
  };
}
