import { Injectable, Logger } from '@nestjs/common';
import { ModuleRegistryService } from '../module-registry/module-registry.service';

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

  constructor(private readonly registry: ModuleRegistryService) {}

  health(): HealthCheck {
    const modules = this.registry.getModules().map((m) => ({
      name: m.manifest.name,
      status: m.status,
    }));
    const errored = modules.filter((m) => m.status === 'error');
    return {
      status: errored.length ? 'degraded' : 'ok',
      checks: {
        core: { status: 'ok' },
        eventBus: { status: 'ok' },
        registry: { status: 'ok', detail: `${modules.length} modules` },
      },
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
