import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  forwardRef,
} from '@nestjs/common';
import type { INestApplication, Type } from '@nestjs/common';
import { LazyModuleLoader, ModulesContainer, ModuleRef } from '@nestjs/core';
import type { Module as NestModule } from '@nestjs/core/injector/module';
import { createRequire } from 'module';
import * as path from 'path';
import type { HotdockPlugin, PluginLifecycle } from '../contracts';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import {
  DiscoveredPlugin,
  PluginDiscoveryService,
} from './plugin-discovery.service';
import { PluginRouteManager } from './plugin-route-manager';

interface LoadedPlugin {
  name: string;
  entryPath: string;
  rootDir: string;
  plugin: HotdockPlugin;
  moduleRef: ModuleRef;
  nestModule: NestModule;
}

@Injectable()
export class PluginRuntimeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginRuntimeService.name);
  private readonly discovered = new Map<string, DiscoveredPlugin>();
  private readonly loaded = new Map<string, LoadedPlugin>();
  private app?: INestApplication;
  private bootstrapped = false;

  constructor(
    private readonly discovery: PluginDiscoveryService,
    private readonly routes: PluginRouteManager,
    private readonly lazyModuleLoader: LazyModuleLoader,
    private readonly modulesContainer: ModulesContainer,
    @Inject(forwardRef(() => ModuleRegistryService))
    private readonly registry: ModuleRegistryService,
  ) {}

  /** Must be called from main/e2e after NestFactory.create / createNestApplication. */
  bindApplication(app: INestApplication) {
    this.app = app;
    this.routes.bindApplication(app);
  }

  async onApplicationBootstrap() {
    if (!this.app || !this.routes.isBound()) {
      this.logger.warn(
        'PluginRuntime not bound to NestApplication — call bindApplication(app) before listen/init',
      );
      return;
    }
    await this.bootstrap();
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    await this.discoverAndRegister();
    for (const mod of this.registry.getModules()) {
      const name = mod.manifest.name;
      if (!this.registry.shouldAutoEnable(name)) continue;
      try {
        await this.registry.enable(name);
      } catch (err) {
        this.logger.error(
          `Auto-enable failed for "${name}": ${(err as Error).message}`,
        );
        const record = this.registry.getModule(name);
        if (record) {
          record.status = 'error';
          record.error = (err as Error).message;
        }
      }
    }
  }

  async discoverAndRegister() {
    const found = await this.discovery.discoverAll();
    this.discovered.clear();
    for (const item of found) {
      this.discovered.set(item.plugin.manifest.name, item);
      if (!this.registry.getModule(item.plugin.manifest.name)) {
        this.registry.register(item.plugin.manifest);
      }
    }
  }

  /** Re-list a plugin after uninstall so it remains available on disk. */
  async reregisterDiscovered(name: string) {
    let item = this.discovered.get(name);
    if (!item) {
      item = await this.discovery.discoverOne(name);
      if (item) this.discovered.set(name, item);
    }
    if (item && !this.registry.getModule(name)) {
      this.registry.register(item.plugin.manifest);
    }
  }

  isLoaded(name: string) {
    return this.loaded.has(name);
  }

  async ensureLoaded(name: string): Promise<LoadedPlugin> {
    const existing = this.loaded.get(name);
    if (existing) return existing;

    const item = this.discovered.get(name);
    if (!item) {
      throw new Error(
        `Plugin "${name}" not discovered. Place it under modules/ or HOTDOCK_PLUGINS_DIR.`,
      );
    }

    // Re-import entry so lifecycle class tokens match the Nest module class identity
    const plugin = await this.discovery.loadEntry(item.entryPath);
    const moduleRef = await this.lazyModuleLoader.load(() => plugin.module);
    const nestModule = this.findNestModule(plugin.module);
    if (!nestModule) {
      throw new Error(`Nest module for plugin "${name}" not found in container`);
    }

    const lifecycle = moduleRef.get(plugin.lifecycle as Type<PluginLifecycle>, {
      strict: false,
    });
    if (lifecycle) {
      this.registry.attachLifecycle(name, lifecycle);
    } else {
      this.logger.warn(
        `Plugin "${name}" loaded but lifecycle provider was not found`,
      );
    }

    const loaded: LoadedPlugin = {
      name,
      entryPath: item.entryPath,
      rootDir: item.rootDir,
      plugin,
      moduleRef,
      nestModule,
    };
    this.loaded.set(name, loaded);
    this.logger.log(`Loaded plugin "${name}" into process`);
    return loaded;
  }

  async mount(name: string) {
    const loaded = await this.ensureLoaded(name);
    this.routes.mount(name, loaded.nestModule);
  }

  async unmount(name: string) {
    this.routes.unmount(name);
  }

  /**
   * Remove Nest module from container and clear require cache so a later
   * enable can load a fresh copy (true hot unload).
   */
  async unload(name: string) {
    await this.unmount(name);
    const loaded = this.loaded.get(name);
    if (!loaded) {
      this.registry.detachLifecycle(name);
      return;
    }

    // Best-effort destroy hooks
    for (const wrapper of loaded.nestModule.providers.values()) {
      const instance = wrapper.instance as { onModuleDestroy?: () => unknown };
      if (instance && typeof instance.onModuleDestroy === 'function') {
        try {
          await instance.onModuleDestroy();
        } catch (err) {
          this.logger.warn(
            `onModuleDestroy failed in "${name}": ${(err as Error).message}`,
          );
        }
      }
    }

    this.modulesContainer.delete(loaded.nestModule.token);
    this.clearRequireCache(loaded.rootDir);
    this.loaded.delete(name);
    this.registry.detachLifecycle(name);
    this.logger.log(`Unloaded plugin "${name}" from process`);
  }

  private findNestModule(metatype: Type<unknown>): NestModule | undefined {
    for (const mod of this.modulesContainer.values()) {
      if (mod.metatype === metatype) return mod;
    }
    return undefined;
  }

  private clearRequireCache(rootDir: string) {
    const normalized = path.normalize(rootDir);
    try {
      const req = createRequire(__filename);
      for (const key of Object.keys(req.cache)) {
        if (path.normalize(key).startsWith(normalized)) {
          delete req.cache[key];
        }
      }
    } catch {
      // ignore — ESM-only environments may not expose require.cache the same way
    }
  }
}
