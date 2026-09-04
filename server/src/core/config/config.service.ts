import { Injectable } from '@nestjs/common';

/**
 * Namespaced config store.
 * Keys should be "module.key", e.g. "ecommerce.currency".
 * Named PlatformConfigService to avoid clashing with @nestjs/config.
 */
@Injectable()
export class PlatformConfigService {
  private readonly store = new Map<string, unknown>();

  constructor() {
    this.setMany({
      'platform.name': 'AI Nest Platform',
      'platform.apiPrefix': 'api',
      'platform.defaultLocale': 'zh-CN',
    });
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (this.store.has(key)) {
      return this.store.get(key) as T;
    }
    return defaultValue;
  }

  set(key: string, value: unknown) {
    this.store.set(key, value);
  }

  setMany(entries: Record<string, unknown>) {
    for (const [k, v] of Object.entries(entries)) {
      this.store.set(k, v);
    }
  }

  delete(key: string) {
    this.store.delete(key);
  }

  list(prefix?: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.store.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        out[k] = v;
      }
    }
    return out;
  }
}
