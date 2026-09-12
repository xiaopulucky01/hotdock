import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { CACHE_ADAPTER } from './cache.types';
import { MemoryCacheAdapter } from './memory-cache.adapter';
import { RedisCacheAdapter } from './redis-cache.adapter';

const cacheAdapterProvider = {
  provide: CACHE_ADAPTER,
  useFactory: (redis: RedisCacheAdapter, memory: MemoryCacheAdapter) => {
    // Prefer Redis adapter instance; CacheService falls back when not ready
    return process.env.REDIS_URL ? redis : memory;
  },
  inject: [RedisCacheAdapter, MemoryCacheAdapter],
};

@Global()
@Module({
  providers: [
    MemoryCacheAdapter,
    RedisCacheAdapter,
    cacheAdapterProvider,
    CacheService,
  ],
  controllers: [CacheController],
  exports: [CacheService, CACHE_ADAPTER],
})
export class CacheModule {}
