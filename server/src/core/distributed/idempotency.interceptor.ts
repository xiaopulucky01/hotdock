import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

export const IDEMPOTENT_KEY = 'hotdock:idempotent';
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

/**
 * Honors Idempotency-Key header on decorated handlers.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      body?: unknown;
      tenantId?: string;
      user?: { tenantId?: string };
    }>();
    const key =
      req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
    if (!key) return next.handle();

    const tenantId = req.tenantId ?? req.user?.tenantId;
    return from(this.idempotency.begin(key, req.body, tenantId)).pipe(
      switchMap((result) => {
        if (result.hit) return of(result.response);
        return next.handle().pipe(
          tap({
            next: (response) => {
              void this.idempotency.complete(key, response, tenantId);
            },
          }),
        );
      }),
    );
  }
}
