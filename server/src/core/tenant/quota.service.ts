import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface TenantQuota {
  tenantId: string;
  /** Max API requests per minute (0 = unlimited) */
  apiRpm?: number;
  /** Max stored blobs bytes */
  storageBytes?: number;
  /** Max concurrent jobs */
  jobs?: number;
  /** Max LLM tokens / day (plugin-interpreted) */
  llmTokensPerDay?: number;
  /** Soft usage counters */
  usage?: {
    storageBytes?: number;
    llmTokensToday?: number;
    llmTokensDay?: string;
  };
}

const DEFAULTS: Omit<TenantQuota, 'tenantId'> = {
  apiRpm: 600,
  storageBytes: 1024 * 1024 * 512,
  jobs: 50,
  llmTokensPerDay: 200_000,
  usage: {},
};

@Injectable()
export class QuotaService implements OnModuleInit {
  private quotas = new Map<string, TenantQuota>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<TenantQuota[]>('quotas');
    for (const q of data ?? []) this.quotas.set(q.tenantId, q);
  }

  private async persist() {
    await this.persistence.save('quotas', [...this.quotas.values()]);
  }

  get(tenantId: string): TenantQuota {
    return (
      this.quotas.get(tenantId) ?? {
        tenantId,
        ...DEFAULTS,
        usage: { ...DEFAULTS.usage },
      }
    );
  }

  set(tenantId: string, patch: Partial<Omit<TenantQuota, 'tenantId'>>) {
    const cur = this.get(tenantId);
    const next: TenantQuota = {
      ...cur,
      ...patch,
      tenantId,
      usage: { ...cur.usage, ...patch.usage },
    };
    this.quotas.set(tenantId, next);
    void this.persist();
    return next;
  }

  list() {
    return [...this.quotas.values()];
  }

  assertWithin(
    tenantId: string,
    dimension: 'storageBytes' | 'jobs' | 'llmTokensPerDay',
    delta = 0,
  ) {
    const q = this.get(tenantId);
    if (dimension === 'storageBytes') {
      const limit = q.storageBytes ?? 0;
      if (limit > 0 && (q.usage?.storageBytes ?? 0) + delta > limit) {
        throw new ForbiddenException('Storage quota exceeded');
      }
    }
    if (dimension === 'llmTokensPerDay') {
      const today = new Date().toISOString().slice(0, 10);
      const used =
        q.usage?.llmTokensDay === today ? (q.usage.llmTokensToday ?? 0) : 0;
      const limit = q.llmTokensPerDay ?? 0;
      if (limit > 0 && used + delta > limit) {
        throw new ForbiddenException('LLM token quota exceeded');
      }
    }
    if (dimension === 'jobs') {
      const limit = q.jobs ?? 0;
      if (limit > 0 && delta > limit) {
        throw new ForbiddenException('Job quota exceeded');
      }
    }
  }

  recordUsage(
    tenantId: string,
    patch: { storageBytes?: number; llmTokens?: number },
  ) {
    const q = this.get(tenantId);
    const today = new Date().toISOString().slice(0, 10);
    const usage = { ...q.usage };
    if (typeof patch.storageBytes === 'number') {
      usage.storageBytes = (usage.storageBytes ?? 0) + patch.storageBytes;
    }
    if (typeof patch.llmTokens === 'number') {
      if (usage.llmTokensDay !== today) {
        usage.llmTokensDay = today;
        usage.llmTokensToday = 0;
      }
      usage.llmTokensToday = (usage.llmTokensToday ?? 0) + patch.llmTokens;
    }
    return this.set(tenantId, { usage });
  }
}
