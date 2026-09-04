import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Process-local TTL cache. Swap for Redis via adapter later.
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number) {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear(prefix?: string) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  wrap<T>(key: string, ttlMs: number, factory: () => T | Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return Promise.resolve(hit);
    return Promise.resolve(factory()).then((value) => {
      this.set(key, value, ttlMs);
      return value;
    });
  }
}
