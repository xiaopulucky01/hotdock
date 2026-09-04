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
    return { ok: true, message: 'Process-local cache; use clear to invalidate' };
  }

  @Delete()
  @RequirePermissions('platform.config.manage')
  clear(@Query('prefix') prefix?: string) {
    this.cache.clear(prefix);
    return { ok: true };
  }
}
