import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigKeySchema } from '../contracts/module-manifest';
import { PersistenceService } from '../persistence/persistence.service';
import { SecretsService } from '../secrets/secrets.service';

/**
 * Namespaced config store with schema + secret masking/encryption + env overlay.
 * Keys should be "module.key", e.g. "ecommerce.currency".
 */
@Injectable()
export class PlatformConfigService implements OnModuleInit {
  private readonly store = new Map<string, unknown>();
  private readonly schemas = new Map<string, ConfigKeySchema>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    @Optional() private readonly secrets?: SecretsService,
  ) {}

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
        'platform.name': 'Hotdock',
        'platform.apiPrefix': 'api',
        'platform.defaultLocale': 'zh-CN',
        'platform.coreApi': '1.0.0',
      });
    }
    for (const s of data?.schemas ?? []) this.schemas.set(s.key, s);
  }

  private applyEnvOverlay() {
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
      const value = this.store.get(key);
      const schema = this.schemas.get(key);
      if (schema?.secret && typeof value === 'string' && this.secrets) {
        return this.secrets.reveal(value) as T;
      }
      return value as T;
    }
    const schemaDefault = this.schemas.get(key)?.default;
    return (schemaDefault as T | undefined) ?? defaultValue;
  }

  set(key: string, value: unknown) {
    const schema = this.schemas.get(key);
    if (schema) {
      this.assertType(key, value, schema.type);
    }
    let stored = value;
    if (schema?.secret && typeof value === 'string' && this.secrets) {
      stored = this.secrets.seal(value);
    }
    this.store.set(key, stored);
    void this.persist();
  }

  setMany(entries: Record<string, unknown>) {
    for (const [k, v] of Object.entries(entries)) {
      const schema = this.schemas.get(k);
      let stored = v;
      if (schema?.secret && typeof v === 'string' && this.secrets) {
        stored = this.secrets.seal(v);
      }
      this.store.set(k, stored);
    }
    void this.persist();
  }

  delete(key: string) {
    this.store.delete(key);
    void this.persist();
  }

  list(
    prefix?: string,
    opts?: { maskSecrets?: boolean },
  ): Record<string, unknown> {
    const mask = opts?.maskSecrets ?? true;
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.store.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        const schema = this.schemas.get(k);
        out[k] =
          mask && schema?.secret && typeof v === 'string' && v ? '***' : v;
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
