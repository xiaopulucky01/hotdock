import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

/**
 * Simple in-memory rate limiter per IP.
 * Swap for Redis token-bucket in production.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly windowMs = 60_000;
  private readonly max = 120;

  constructor(private readonly features: FeatureFlagService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.features.isEnabled('platform.rateLimit.enabled', true)) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ ip?: string }>();
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    let bucket = this.hits.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > this.max) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
