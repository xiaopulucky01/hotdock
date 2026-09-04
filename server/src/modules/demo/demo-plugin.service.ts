import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PluginLifecycle } from '../../core/contracts';
import { ModuleRegistryService } from '../../core/module-registry/module-registry.service';
import { ExtensionService } from '../../core/extension/extension.service';
import { JobSchedulerService } from '../../core/job/job-scheduler.service';
import { PlatformConfigService } from '../../core/config/config.service';
import { EventBusService } from '../../core/event-bus/event-bus.service';
import { AuditService } from '../../core/audit/audit.service';
import { DEMO_MANIFEST } from './demo.manifest';

@Injectable()
export class DemoPluginService implements OnModuleInit, PluginLifecycle {
  private readonly logger = new Logger(DemoPluginService.name);

  constructor(
    private readonly registry: ModuleRegistryService,
    private readonly extensions: ExtensionService,
    private readonly jobs: JobSchedulerService,
    private readonly config: PlatformConfigService,
    private readonly events: EventBusService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    this.registry.register(DEMO_MANIFEST, this);
    await this.registry.enable(DEMO_MANIFEST.name);
  }

  async onInstall() {
    this.config.set('demo.greeting', 'Hello from Demo module');
    this.audit.record({
      module: DEMO_MANIFEST.name,
      action: 'module.install',
      detail: { version: DEMO_MANIFEST.version },
    });
  }

  async onEnable() {
    this.extensions.contribute('platform.nav.items', {
      id: 'demo.nav',
      module: DEMO_MANIFEST.name,
      priority: 10,
      feature: 'demo.enabled',
      data: { label: 'Demo', path: '/demo' },
    });

    this.jobs.register({
      name: 'heartbeat',
      module: DEMO_MANIFEST.name,
      intervalMs: 60_000,
      handler: async () => {
        await this.events.emit({
          name: 'demo.ping',
          source: DEMO_MANIFEST.name,
          payload: { message: 'heartbeat' },
        });
      },
    });

    this.logger.log('Demo module enabled');
  }

  async onDisable() {
    this.jobs.unregisterModule(DEMO_MANIFEST.name);
    this.extensions.removeModule(DEMO_MANIFEST.name);
    this.logger.log('Demo module disabled');
  }

  async onUninstall() {
    this.config.delete('demo.greeting');
    this.audit.record({
      module: DEMO_MANIFEST.name,
      action: 'module.uninstall',
    });
  }

  greeting() {
    return this.config.get<string>('demo.greeting', 'Hello');
  }
}
