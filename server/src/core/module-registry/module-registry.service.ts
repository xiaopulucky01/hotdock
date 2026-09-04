import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModuleManifest,
  PluginLifecycle,
  PLATFORM_EVENTS,
  RegisteredModule,
} from '../contracts';
import { EventBusService } from '../event-bus/event-bus.service';
import { RbacService } from '../rbac/rbac.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Injectable()
export class ModuleRegistryService {
  private readonly modules = new Map<string, RegisteredModule>();
  private readonly lifecycles = new Map<string, PluginLifecycle>();

  constructor(
    private readonly events: EventBusService,
    private readonly rbac: RbacService,
    private readonly features: FeatureFlagService,
  ) {}

  register(manifest: ModuleManifest, lifecycle?: PluginLifecycle): RegisteredModule {
    this.validateManifest(manifest);
    if (this.modules.has(manifest.name)) {
      throw new BadRequestException(
        `Module "${manifest.name}" is already registered`,
      );
    }

    const record: RegisteredModule = {
      manifest,
      status: 'registered',
      registeredAt: new Date(),
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

    return record;
  }

  async install(name: string): Promise<RegisteredModule> {
    const mod = this.require(name);
    this.assertDependencies(mod.manifest);
    await this.lifecycles.get(name)?.onInstall?.();
    mod.status = 'installed';
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_INSTALLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    return mod;
  }

  async enable(name: string): Promise<RegisteredModule> {
    const mod = this.require(name);
    this.assertDependencies(mod.manifest);
    if (mod.status === 'registered') {
      await this.install(name);
    }
    await this.lifecycles.get(name)?.onEnable?.();
    mod.status = 'enabled';
    mod.enabledAt = new Date();
    mod.error = undefined;
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_ENABLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    return mod;
  }

  async disable(name: string): Promise<RegisteredModule> {
    const mod = this.require(name);
    this.assertNoDependents(name);
    await this.lifecycles.get(name)?.onDisable?.();
    mod.status = 'disabled';
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_DISABLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
    return mod;
  }

  async uninstall(name: string): Promise<void> {
    const mod = this.require(name);
    this.assertNoDependents(name);
    if (mod.status === 'enabled') {
      await this.disable(name);
    }
    await this.lifecycles.get(name)?.onUninstall?.();
    this.modules.delete(name);
    this.lifecycles.delete(name);
    void this.events.emit({
      name: PLATFORM_EVENTS.MODULE_UNINSTALLED,
      source: 'platform.module-registry',
      payload: { name },
      occurredAt: new Date(),
    });
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
