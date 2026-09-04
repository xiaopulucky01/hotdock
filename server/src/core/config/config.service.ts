import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigKeySchema } from '../contracts/module-manifest';
import { PersistenceService } from '../persistence/persistence.service';

/**
 * Namespaced config store with schema + secret masking + env overlay.
 * Keys should be "module.key", e.g. "ecommerce.currency".
 */
@Injectable()
export class PlatformConfigService implements OnModuleInit {
  private readonly store = new Map<string, unknown>();
  private readonly schemas = new Map<string, ConfigKeySchema>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
    this.applyEnvOverlay();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<{
      store: Record<string, unknown>;
      schemas: ConfigKeySchema[];
    }>('config');
    if (data?.store) {
      for (const [k, v] of Object.entries(data.store)) this.store.set(k, v);
    } else {
      this.setMany({
        'platform.name': 'AI Nest Platform',
        'platform.apiPrefix': 'api',
        'platform.defaultLocale': 'zh-CN',
      });
    }
    for (const s of data?.schemas ?? []) this.schemas.set(s.key, s);
  }

  private applyEnvOverlay() {
    // PLATFORM_CONFIG_JSON='{"platform.name":"..."}'
    const raw = process.env.PLATFORM_CONFIG_JSON;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        this.setMany(parsed);
      } catch {
        // ignore invalid env overlay
      }
    }
    if (process.env.PLATFORM_NAME) {
      this.store.set('platform.name', process.env.PLATFORM_NAME);
    }
  }

  private async persist() {
    await this.persistence.save('config', {
      store: Object.fromEntries(this.store.entries()),
      schemas: [...this.schemas.values()],
    });
  }

  registerSchema(schemas: ConfigKeySchema[]) {
    for (const s of schemas) this.schemas.set(s.key, s);
    void this.persist();
  }

  getSchema(key: string) {
    return this.schemas.get(key);
  }

  listSchemas() {
    return [...this.schemas.values()];
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (this.store.has(key)) {
      return this.store.get(key) as T;
    }
    const schemaDefault = this.schemas.get(key)?.default;
    return (schemaDefault as T | undefined) ?? defaultValue;
  }

  set(key: string, value: unknown) {
    const schema = this.schemas.get(key);
    if (schema) {
      this.assertType(key, value, schema.type);
    }
    this.store.set(key, value);
    void this.persist();
  }

  setMany(entries: Record<string, unknown>) {
    for (const [k, v] of Object.entries(entries)) {
      this.store.set(k, v);
    }
    void this.persist();
  }

  delete(key: string) {
    this.store.delete(key);
    void this.persist();
  }

  list(prefix?: string, opts?: { maskSecrets?: boolean }): Record<string, unknown> {
    const mask = opts?.maskSecrets ?? true;
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.store.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        const schema = this.schemas.get(k);
        out[k] =
          mask && schema?.secret && typeof v === 'string' && v
            ? '***'
            : v;
      }
    }
    return out;
  }

  private assertType(
    key: string,
    value: unknown,
    type: ConfigKeySchema['type'],
  ) {
    if (value === null || value === undefined) return;
    const ok =
      (type === 'string' && typeof value === 'string') ||
      (type === 'number' && typeof value === 'number') ||
      (type === 'boolean' && typeof value === 'boolean') ||
      type === 'json';
    if (!ok) {
      throw new Error(`Config "${key}" expects type ${type}`);
    }
  }
}
