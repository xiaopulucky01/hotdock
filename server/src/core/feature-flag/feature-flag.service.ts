import { Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface FeatureFlagRecord {
  enabled: boolean;
  /** Optional tenant allow-list; empty = all tenants */
  tenants?: string[];
  /** 0-100 rollout percentage */
  percentage?: number;
}

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly flags = new Map<string, FeatureFlagRecord>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<Record<string, FeatureFlagRecord | boolean>>(
      'features',
    );
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        this.flags.set(
          k,
          typeof v === 'boolean' ? { enabled: v } : v,
        );
      }
    } else {
      this.set('platform.audit.enabled', true);
      this.set('platform.rateLimit.enabled', true);
    }
  }

  private async persist() {
    await this.persistence.save(
      'features',
      Object.fromEntries(this.flags.entries()),
    );
  }

  isEnabled(
    flag: string,
    defaultValue = false,
    ctx?: { tenantId?: string; userId?: string },
  ): boolean {
    const record = this.flags.get(flag);
    if (!record) return defaultValue;
    if (!record.enabled) return false;
    if (record.tenants?.length && ctx?.tenantId) {
      if (!record.tenants.includes(ctx.tenantId)) return false;
    }
    if (typeof record.percentage === 'number') {
      const seed = `${flag}:${ctx?.userId ?? ctx?.tenantId ?? 'anon'}`;
      const bucket = this.hashPercent(seed);
      if (bucket >= record.percentage) return false;
    }
    return true;
  }

  set(
    flag: string,
    enabled: boolean,
    opts?: { tenants?: string[]; percentage?: number },
  ) {
    this.flags.set(flag, {
      enabled,
      tenants: opts?.tenants,
      percentage: opts?.percentage,
    });
    void this.persist();
  }

  list(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [k, v] of this.flags.entries()) {
      out[k] = v.enabled;
    }
    return out;
  }

  listDetailed(): Record<string, FeatureFlagRecord> {
    return Object.fromEntries(this.flags.entries());
  }

  private hashPercent(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return h % 100;
  }
}
