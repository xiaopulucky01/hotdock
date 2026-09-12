import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { LockAdapter } from './lock.types';

/**
 * Redis SET NX PX based lock. Activated when REDIS_URL is set.
 */
@Injectable()
export class RedisLockAdapter implements LockAdapter, OnModuleDestroy {
  private readonly logger = new Logger(RedisLockAdapter.name);
  private client?: Redis;
  private ready = false;

  async init() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      });
      await this.client.connect();
      this.ready = true;
      this.logger.log('Redis lock adapter connected');
    } catch (err) {
      this.logger.warn(
        `Redis lock unavailable: ${(err as Error).message}; falling back`,
      );
      this.ready = false;
      this.client = undefined;
    }
  }

  isReady() {
    return this.ready && !!this.client;
  }

  async acquire(key: string, ttlMs: number, token: string): Promise<boolean> {
    if (!this.client) return false;
    const res = await this.client.set(
      `lock:${key}`,
      token,
      'PX',
      ttlMs,
      'NX',
    );
    return res === 'OK';
  }

  async release(key: string, token: string): Promise<boolean> {
    if (!this.client) return false;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    const res = await this.client.eval(script, 1, `lock:${key}`, token);
    return Number(res) === 1;
  }

  async extend(key: string, token: string, ttlMs: number): Promise<boolean> {
    if (!this.client) return false;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end`;
    const res = await this.client.eval(
      script,
      1,
      `lock:${key}`,
      token,
      String(ttlMs),
    );
    return Number(res) === 1;
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}
