import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, PermissionsGuard, RequirePermissions } from '../gateway';
import { CacheService } from './cache.service';

@Controller('api/platform/cache')
@UseGuards(AuthGuard, PermissionsGuard)
export class CacheController {
  constructor(private readonly cache: CacheService) {}

  @Get('stats')
  @RequirePermissions('platform.config.manage')
  stats() {
    return {
      ok: true,
      backend: this.cache.backend(),
      message:
        this.cache.backend() === 'redis'
          ? 'Redis-backed distributed cache'
          : 'Process-local memory cache (set REDIS_URL for Redis)',
    };
  }

  @Delete()
  @RequirePermissions('platform.config.manage')
  async clear(@Query('prefix') prefix?: string) {
    await this.cache.clearAsync(prefix);
    return { ok: true };
  }
}
