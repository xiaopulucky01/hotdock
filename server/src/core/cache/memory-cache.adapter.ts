import { Injectable } from '@nestjs/common';
import { CacheAdapter } from './cache.types';

interface CacheEntry {
  value: unknown;
  expiresAt?: number;
}

/** In-process TTL cache with sync helpers for hot paths. */
@Injectable()
export class MemoryCacheAdapter implements CacheAdapter {
  private readonly store = new Map<string, CacheEntry>();

  getSync<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  setSync<T>(key: string, value: T, ttlMs?: number) {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.getSync<T>(key);
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.setSync(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
