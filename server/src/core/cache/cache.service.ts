import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CACHE_ADAPTER } from './cache.types';
import type { CacheAdapter } from './cache.types';
import { MemoryCacheAdapter } from './memory-cache.adapter';

/**
 * Cache facade with memory + optional Redis (REDIS_URL).
 */
@Injectable()
export class CacheService implements OnModuleInit {
  private readonly memory = new MemoryCacheAdapter();

  constructor(
    @Inject(CACHE_ADAPTER) private readonly adapter: CacheAdapter,
  ) {}

  async onModuleInit() {
    const maybe = this.adapter as CacheAdapter & { init?: () => Promise<void> };
    if (maybe.init) await maybe.init();
  }

  private remoteReady() {
    const remote = this.adapter as CacheAdapter & { isReady?: () => boolean };
    return remote.isReady?.() === true;
  }

  get<T>(key: string): T | undefined {
    return this.memory.getSync<T>(key);
  }

  set<T>(key: string, value: T, ttlMs?: number) {
    this.memory.setSync(key, value, ttlMs);
    if (this.remoteReady()) {
      void this.adapter.set(key, value, ttlMs);
    }
  }

  delete(key: string) {
    void this.deleteAsync(key);
  }

  clear(prefix?: string) {
    void this.clearAsync(prefix);
  }

  async getAsync<T>(key: string): Promise<T | undefined> {
    if (this.remoteReady()) {
      const remote = await this.adapter.get<T>(key);
      if (remote !== undefined) {
        this.memory.setSync(key, remote);
        return remote;
      }
    }
    return this.memory.getSync<T>(key);
  }

  async setAsync<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.memory.setSync(key, value, ttlMs);
    if (this.remoteReady()) {
      await this.adapter.set(key, value, ttlMs);
    }
  }

  async deleteAsync(key: string): Promise<void> {
    await this.memory.delete(key);
    if (this.remoteReady()) {
      await this.adapter.delete(key);
    }
  }

  async clearAsync(prefix?: string): Promise<void> {
    await this.memory.clear(prefix);
    if (this.remoteReady()) {
      await this.adapter.clear(prefix);
    }
  }

  async wrap<T>(
    key: string,
    ttlMs: number,
    factory: () => T | Promise<T>,
  ): Promise<T> {
    const hit = await this.getAsync<T>(key);
    if (hit !== undefined) return hit;
    const value = await Promise.resolve(factory());
    await this.setAsync(key, value, ttlMs);
    return value;
  }

  backend(): 'redis' | 'memory' {
    return this.remoteReady() ? 'redis' : 'memory';
  }
}
