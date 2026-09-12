import { Global, Module } from '@nestjs/common';
import { LOCK_ADAPTER } from './lock.types';
import { MemoryLockAdapter } from './memory-lock.adapter';
import { FileLockAdapter } from './file-lock.adapter';
import { RedisLockAdapter } from './redis-lock.adapter';
import { LockService } from './lock.service';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const lockAdapterProvider = {
  provide: LOCK_ADAPTER,
  useFactory: (
    redis: RedisLockAdapter,
    file: FileLockAdapter,
    memory: MemoryLockAdapter,
  ) => {
    if (process.env.REDIS_URL) return redis;
    if (process.env.LOCK_BACKEND === 'memory') return memory;
    return file;
  },
  inject: [RedisLockAdapter, FileLockAdapter, MemoryLockAdapter],
};

@Global()
@Module({
  providers: [
    MemoryLockAdapter,
    FileLockAdapter,
    RedisLockAdapter,
    lockAdapterProvider,
    LockService,
    IdempotencyService,
    IdempotencyInterceptor,
  ],
  exports: [LockService, IdempotencyService, IdempotencyInterceptor, LOCK_ADAPTER],
})
export class DistributedModule {}
