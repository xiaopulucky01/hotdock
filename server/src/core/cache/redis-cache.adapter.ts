import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { CacheAdapter } from './cache.types';

@Injectable()
export class RedisCacheAdapter implements CacheAdapter, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private client?: Redis;
  private ready = false;

  async init() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        keyPrefix: 'hotdock:cache:',
      });
      await this.client.connect();
      this.ready = true;
      this.logger.log('Redis cache adapter connected');
    } catch (err) {
      this.logger.warn(`Redis cache unavailable: ${(err as Error).message}`);
      this.ready = false;
      this.client = undefined;
    }
  }

  isReady() {
    return this.ready && !!this.client;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.client) return undefined;
    const raw = await this.client.get(key);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.client) return;
    const raw = JSON.stringify(value);
    if (ttlMs) {
      await this.client.set(key, raw, 'PX', ttlMs);
    } else {
      await this.client.set(key, raw);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (!this.client) return;
    const pattern = prefix ? `${prefix}*` : '*';
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (batch: string[]) => keys.push(...batch));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    if (keys.length) {
      const pipeline = this.client.pipeline();
      for (const k of keys) {
        const bare = k.replace(/^hotdock:cache:/, '');
        pipeline.del(bare);
      }
      await pipeline.exec();
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}
