import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import * as semver from 'semver';
import {
  ModuleManifest,
  PluginLifecycle,
  PLATFORM_EVENTS,
  RegisteredModule,
} from '../contracts';
import { EventBusService } from '../event-bus/event-bus.service';
import { RbacService } from '../rbac/rbac.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ExtensionService } from '../extension/extension.service';
import { JobSchedulerService } from '../job/job-scheduler.service';
import { AuditService } from '../audit/audit.service';
import { PluginRuntimeService } from '../plugin-runtime/plugin-runtime.service';

interface PersistedModuleState {
  status: RegisteredModule['status'];
  enabledAt?: string;
  error?: string;
}

@Injectable()
export class ModuleRegistryService implements OnModuleInit {
  private readonly modules = new Map<string, RegisteredModule>();
  private readonly lifecycles = new Map<string, PluginLifecycle>();
  private persisted = new Map<string, PersistedModuleState>();
  private loaded = false;

  constructor(
    private readonly events: EventBusService,
    private readonly rbac: RbacService,
    private readonly features: FeatureFlagService,
    private readonly persistence: PersistenceService,
    private readonly extensions: ExtensionService,
    private readonly jobs: JobSchedulerService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => PluginRuntimeService))
    private readonly runtime: PluginRuntimeService,
  ) {}

  async onModuleInit() {
    const data = await this.persistence.load<
      Record<string, PersistedModuleState>
    >('modules');
    if (data) {
      this.persisted = new Map(Object.entries(data));
    }
    this.loaded = true;
  }

  private async persistStates() {
    const out: Record<string, PersistedModuleState> = {};
    for (const [name, mod] of this.modules.entries()) {
      out[name] = {
        status: mod.status,
        enabledAt: mod.enabledAt
          ? new Date(mod.enabledAt).toISOString()
          : undefined,
        error: mod.error,
      };
    }
    for (const [name, state] of this.persisted.entries()) {
      if (!out[name]) out[name] = state;
    }
    this.persisted = new Map(Object.entries(out));
    await this.persistence.save('modules', out);
  }

  /** Register a discovered plugin (manifest only; code may not be loaded yet). */
  register(
    manifest: ModuleManifest,
    lifecycle?: PluginLifecycle,
  ): RegisteredModule {
    this.validateManifest(manifest);
    if (this.modules.has(manifest.name)) {
      throw new BadRequestException(
        `Module "${manifest.name}" is already registered`,
      );
    }

    const saved = this.persisted.get(manifest.name);
    let status: RegisteredModule['status'] = 'registered';
    if (saved?.status === 'disabled') status = 'disabled';
    else if (saved?.status === 'enabled' || saved?.status === 'installed') {
      status = 'installed';
    }
    const record: RegisteredModule = {
      manifest,
      status,
      registeredAt: new Date(),
      enabledAt: saved?.enabledAt ? new Date(saved.enabledAt) : undefined,
      error: saved?.error,
    };
    this.modules.set(manifest.name, record);
    if (lifecycle) {
      this.lifecycles.set(manifest.name, lifecycle);
    }

    if (manifest.permissions?.length) {
      this.rbac.registerPermissions(manifest.name, manifest.permissions);
    }
    for (const flag of manifest.features ?? []) {
      if (!this.features.isEnabled(flag, false) && !this.features.list()[flag]) {
        this.features.set(flag, true);
      }
    }

    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_REGISTERED,
      source: 'platform.module-registry',
      payload: { name: manifest.name, version: manifest.version },
      occurredAt: new Date(),
    });
    void this.persistStates();

    return record;
  }

  attachLifecycle(name: string, lifecycle: PluginLifecycle) {
    this.lifecycles.set(name, lifecycle);
  }

  detachLifecycle(name: string) {
    this.lifecycles.delete(name);
  }

  async install(name: string): Promise<RegisteredModule> {
    await this.runtime.ensureLoaded(name);
    const mod = this.require(name);
    this.assertDependencies(mod.manifest);
    await this.lifecycles.get(name)?.onInstall?.();
    mod.status = 'installed';
    await this.persistStates();
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_INSTALLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    this.audit.record({
      module: 'platform.module-registry',
      action: 'module.install',
      resource: name,
    });
    return mod;
  }

  async enable(name: string): Promise<RegisteredModule> {
    await this.runtime.ensureLoaded(name);
    const mod = this.require(name);
    if (mod.status === 'enabled') {
      await this.runtime.mount(name);
      return mod;
    }
    this.assertDependencies(mod.manifest);
    if (mod.status === 'registered') {
      await this.install(name);
    }
    await this.lifecycles.get(name)?.onEnable?.();
    await this.runtime.mount(name);
    mod.status = 'enabled';
    mod.enabledAt = new Date();
    mod.error = undefined;
    await this.persistStates();
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_ENABLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    this.audit.record({
      module: 'platform.module-registry',
      action: 'module.enable',
      resource: name,
    });
    return mod;
  }

  async disable(name: string): Promise<RegisteredModule> {
    const mod = this.require(name);
    this.assertNoDependents(name);
    await this.lifecycles.get(name)?.onDisable?.();
    await this.runtime.unmount(name);
    this.jobs.unregisterModule(name);
    this.extensions.removeModule(name);
    mod.status = 'disabled';
    await this.persistStates();
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_DISABLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    this.audit.record({
      module: 'platform.module-registry',
      action: 'module.disable',
      resource: name,
    });
    return mod;
  }

  async uninstall(name: string): Promise<RegisteredModule | void> {
    const mod = this.require(name);
    this.assertNoDependents(name);
    if (mod.status === 'enabled') {
      await this.disable(name);
    }
    await this.lifecycles.get(name)?.onUninstall?.();
    await this.runtime.unload(name);
    this.modules.delete(name);
    this.lifecycles.delete(name);
    this.persisted.delete(name);
    await this.persistStates();
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_UNINSTALLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    this.audit.record({
      module: 'platform.module-registry',
      action: 'module.uninstall',
      resource: name,
    });
    // Keep plugin available for re-install without restart
    await this.runtime.reregisterDiscovered(name);
    return this.modules.get(name);
  }

  getModules(): RegisteredModule[] {
    return [...this.modules.values()];
  }

  getModule(name: string): RegisteredModule | undefined {
    return this.modules.get(name);
  }

  isEnabled(name: string): boolean {
    return this.modules.get(name)?.status === 'enabled';
  }

  /** Whether a previously persisted module should auto-enable on boot */
  shouldAutoEnable(name: string): boolean {
    const saved = this.persisted.get(name);
    return saved?.status !== 'disabled' && saved?.status !== 'error';
  }

  private require(name: string): RegisteredModule {
    const mod = this.modules.get(name);
    if (!mod) {
      throw new NotFoundException(`Module "${name}" not found`);
    }
    return mod;
  }

  private validateManifest(manifest: ModuleManifest) {
    if (!manifest.name || !manifest.version || !manifest.displayName) {
      throw new BadRequestException(
        'Manifest requires name, version, displayName',
      );
    }
    if (!semver.valid(manifest.version)) {
      throw new BadRequestException(
        `Invalid semver version "${manifest.version}" for module "${manifest.name}"`,
      );
    }
    if (manifest.coreApi && !semver.validRange(manifest.coreApi)) {
      throw new BadRequestException(
        `Invalid coreApi range "${manifest.coreApi}" for module "${manifest.name}"`,
      );
    }
    if (
      manifest.coreApi &&
      !semver.satisfies('1.0.0', manifest.coreApi)
    ) {
      throw new BadRequestException(
        `Module "${manifest.name}" coreApi ${manifest.coreApi} incompatible with host 1.0.0`,
      );
    }
  }

  private assertDependencies(manifest: ModuleManifest) {
    for (const dep of manifest.dependencies ?? []) {
      if (dep.optional) continue;
      const target = this.modules.get(dep.name);
      if (!target || target.status !== 'enabled') {
        throw new BadRequestException(
          `Dependency "${dep.name}" is missing or not enabled for module "${manifest.name}"`,
        );
      }
      if (
        dep.version &&
        !semver.satisfies(target.manifest.version, dep.version)
      ) {
        throw new BadRequestException(
          `Dependency "${dep.name}@${target.manifest.version}" does not satisfy "${dep.version}" for module "${manifest.name}"`,
        );
      }
    }
  }

  private assertNoDependents(name: string) {
    const dependents = this.getModules().filter(
      (m) =>
        m.status === 'enabled' &&
        (m.manifest.dependencies ?? []).some(
          (d) => d.name === name && !d.optional,
        ),
    );
    if (dependents.length) {
      throw new BadRequestException(
        `Cannot change module "${name}"; required by: ${dependents
          .map((d) => d.manifest.name)
          .join(', ')}`,
      );
    }
  }
}
