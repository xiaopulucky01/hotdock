import { Injectable, Logger } from '@nestjs/common';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { PersistenceService } from '../persistence/persistence.service';
import { CacheService } from '../cache/cache.service';

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  checks: Record<string, { status: 'ok' | 'down' | 'degraded'; detail?: string }>;
  uptimeSec: number;
  modules: Array<{ name: string; status: string }>;
  coreApi: string;
}

export interface TraceSpan {
  correlationId: string;
  name: string;
  startedAt: number;
  durationMs?: number;
  status: 'ok' | 'error';
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('Platform');
  private readonly startedAt = Date.now();
  private readonly metrics = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();
  private readonly traces: TraceSpan[] = [];
  private readonly maxTraces = 500;

  constructor(
    private readonly registry: ModuleRegistryService,
    private readonly persistence: PersistenceService,
    private readonly cache: CacheService,
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
      cache: {
        status: 'ok',
        detail: this.cache.backend(),
      },
    };

    const down = Object.values(checks).some((c) => c.status === 'down');
    return {
      status: down ? 'down' : errored.length ? 'degraded' : 'ok',
      checks,
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      modules,
      coreApi: '1.0.0',
    };
  }

  incr(metric: string, by = 1) {
    this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + by);
  }

  observe(metric: string, valueMs: number) {
    const list = this.histograms.get(metric) ?? [];
    list.push(valueMs);
    if (list.length > 200) list.shift();
    this.histograms.set(metric, list);
  }

  startSpan(correlationId: string, name: string) {
    const span: TraceSpan = {
      correlationId,
      name,
      startedAt: Date.now(),
      status: 'ok',
    };
    this.traces.push(span);
    if (this.traces.length > this.maxTraces) this.traces.shift();
    return span;
  }

  endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok') {
    span.durationMs = Date.now() - span.startedAt;
    span.status = status;
    this.observe(`trace.${span.name}`, span.durationMs);
  }

  recentTraces(limit = 50) {
    return this.traces.slice(-limit);
  }

  getMetrics(): Record<string, number> {
    const out = Object.fromEntries(this.metrics.entries());
    out['process.uptime_sec'] = Math.floor(
      (Date.now() - this.startedAt) / 1000,
    );
    for (const [k, samples] of this.histograms.entries()) {
      if (!samples.length) continue;
      const sum = samples.reduce((a, b) => a + b, 0);
      out[`${k}.count`] = samples.length;
      out[`${k}.avg_ms`] = Math.round(sum / samples.length);
      out[`${k}.p95_ms`] = this.percentile(samples, 0.95);
    }
    return out;
  }

  /** Prometheus text exposition format */
  prometheus(): string {
    const lines: string[] = [
      '# HELP hotdock_info Hotdock platform info',
      '# TYPE hotdock_info gauge',
      'hotdock_info{core_api="1.0.0"} 1',
    ];
    for (const [k, v] of Object.entries(this.getMetrics())) {
      const name = `hotdock_${k.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${v}`);
    }
    return lines.join('\n') + '\n';
  }

  log(level: 'log' | 'warn' | 'error', message: string, context?: string) {
    this.logger[level](message, context);
  }

  private percentile(samples: number[], p: number) {
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * p),
    );
    return sorted[idx] ?? 0;
  }
}
