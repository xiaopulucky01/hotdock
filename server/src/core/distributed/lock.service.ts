import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LOCK_ADAPTER } from './lock.types';
import type { DistributedLock, LockAdapter } from './lock.types';

@Injectable()
export class LockService implements OnModuleInit {
  private readonly logger = new Logger(LockService.name);

  constructor(
    @Inject(LOCK_ADAPTER) private readonly adapter: LockAdapter,
  ) {}

  async onModuleInit() {
    const maybeInit = this.adapter as LockAdapter & { init?: () => Promise<void> };
    if (maybeInit.init) await maybeInit.init();
  }

  async acquire(
    key: string,
    ttlMs = 30_000,
    opts?: { waitMs?: number; retryMs?: number },
  ): Promise<DistributedLock | null> {
    const token = randomUUID();
    const waitMs = opts?.waitMs ?? 0;
    const retryMs = opts?.retryMs ?? 100;
    const deadline = Date.now() + waitMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ok = await this.adapter.acquire(key, ttlMs, token);
      if (ok) {
        return {
          key,
          token,
          release: async () => {
            await this.adapter.release(key, token);
          },
          extend: async (ms: number) => this.adapter.extend(key, token, ms),
        };
      }
      if (Date.now() >= deadline) {
        // Expected when waitMs=0 and another holder exists — keep quiet
        if (waitMs > 0) {
          this.logger.debug(`Failed to acquire lock ${key}`);
        }
        return null;
      }
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
    opts?: { waitMs?: number },
  ): Promise<T | undefined> {
    const lock = await this.acquire(key, ttlMs, opts);
    if (!lock) return undefined;
    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }
}
