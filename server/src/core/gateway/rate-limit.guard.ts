import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { CacheService } from '../cache/cache.service';
import { QuotaService } from '../tenant/quota.service';

/**
 * Distributed-friendly rate limiter (Redis cache when REDIS_URL set).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly max = Number(process.env.RATE_LIMIT_MAX ?? 120);

  constructor(
    private readonly features: FeatureFlagService,
    private readonly cache: CacheService,
    private readonly quotas: QuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.features.isEnabled('platform.rateLimit.enabled', true)) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      tenantId?: string;
      user?: { tenantId?: string };
      headers?: Record<string, string | undefined>;
    }>();
    const tenantId =
      req.tenantId ??
      req.user?.tenantId ??
      req.headers?.['x-tenant-id'];
    const ip = req.ip ?? 'unknown';
    const key = `ratelimit:${tenantId ?? 'global'}:${ip}`;

    let max = this.max;
    if (tenantId) {
      const q = this.quotas.get(tenantId);
      if (q.apiRpm && q.apiRpm > 0) max = q.apiRpm;
    }

    const bucket = (await this.cache.getAsync<{
      count: number;
      resetAt: number;
    }>(key)) ?? { count: 0, resetAt: Date.now() + this.windowMs };

    const now = Date.now();
    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + this.windowMs;
    }
    bucket.count += 1;
    const ttl = Math.max(1000, bucket.resetAt - now);
    await this.cache.setAsync(key, bucket, ttl);

    if (bucket.count > max) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
