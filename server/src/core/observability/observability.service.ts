import { Injectable, Logger } from '@nestjs/common';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { PersistenceService } from '../persistence/persistence.service';

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  checks: Record<string, { status: 'ok' | 'down'; detail?: string }>;
  uptimeSec: number;
  modules: Array<{ name: string; status: string }>;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('Platform');
  private readonly startedAt = Date.now();
  private readonly metrics = new Map<string, number>();

  constructor(
    private readonly registry: ModuleRegistryService,
    private readonly persistence: PersistenceService,
  ) {}

  async health(): Promise<HealthCheck> {
    const modules = this.registry.getModules().map((m) => ({
      name: m.manifest.name,
      status: m.status,
    }));
    const errored = modules.filter((m) => m.status === 'error');

    let persistenceOk = true;
    let persistenceDetail: string | undefined;
    try {
      const cols = await this.persistence.listCollections();
      persistenceDetail = `${cols.length} collections`;
    } catch (err) {
      persistenceOk = false;
      persistenceDetail = (err as Error).message;
    }

    const checks: HealthCheck['checks'] = {
      core: { status: 'ok' },
      eventBus: { status: 'ok' },
      registry: { status: 'ok', detail: `${modules.length} modules` },
      persistence: {
        status: persistenceOk ? 'ok' : 'down',
        detail: persistenceDetail,
      },
    };

    const down = Object.values(checks).some((c) => c.status === 'down');
    return {
      status: down ? 'down' : errored.length ? 'degraded' : 'ok',
      checks,
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      modules,
    };
  }

  incr(metric: string, by = 1) {
    this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + by);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics.entries());
  }

  log(level: 'log' | 'warn' | 'error', message: string, context?: string) {
    this.logger[level](message, context);
  }
}
