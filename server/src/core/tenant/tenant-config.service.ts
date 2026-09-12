import { Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { PlatformConfigService } from '../config/config.service';

/**
 * Tenant-level config overrides layered on global PlatformConfigService.
 */
@Injectable()
export class TenantConfigService implements OnModuleInit {
  private overrides = new Map<string, Record<string, unknown>>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly config: PlatformConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<
      Record<string, Record<string, unknown>>
    >('tenant-config');
    if (data) {
      for (const [tenantId, store] of Object.entries(data)) {
        this.overrides.set(tenantId, store);
      }
    }
  }

  private async persist() {
    await this.persistence.save(
      'tenant-config',
      Object.fromEntries(this.overrides.entries()),
    );
  }

  get<T = unknown>(
    tenantId: string | undefined,
    key: string,
    defaultValue?: T,
  ): T | undefined {
    if (tenantId) {
      const store = this.overrides.get(tenantId);
      if (store && key in store) return store[key] as T;
    }
    return this.config.get<T>(key, defaultValue);
  }

  set(tenantId: string, key: string, value: unknown) {
    const store = { ...(this.overrides.get(tenantId) ?? {}) };
    store[key] = value;
    this.overrides.set(tenantId, store);
    void this.persist();
  }

  delete(tenantId: string, key: string) {
    const store = { ...(this.overrides.get(tenantId) ?? {}) };
    delete store[key];
    this.overrides.set(tenantId, store);
    void this.persist();
  }

  list(tenantId: string, prefix?: string) {
    const store = this.overrides.get(tenantId) ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(store)) {
      if (!prefix || k.startsWith(prefix)) out[k] = v;
    }
    return out;
  }

  /** Merged view: global + tenant overrides. */
  resolved(tenantId: string | undefined, prefix?: string) {
    const base = this.config.list(prefix, { maskSecrets: true });
    if (!tenantId) return base;
    return { ...base, ...this.list(tenantId, prefix) };
  }
}
