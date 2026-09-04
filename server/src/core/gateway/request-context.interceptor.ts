import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly obs: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | undefined>;
      correlationId?: string;
    }>();
    const res = context.switchToHttp().getResponse<{
      setHeader: (k: string, v: string) => void;
    }>();

    const correlationId =
      req.headers['x-correlation-id'] ?? randomUUID();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-api-version', '1');

    const started = Date.now();
    this.obs.incr('http.requests');

    return next.handle().pipe(
      tap({
        next: () => {
          this.obs.incr('http.success');
          this.obs.log(
            'log',
            `${req.method} ${req.url} ${Date.now() - started}ms [${correlationId}]`,
          );
        },
        error: () => {
          this.obs.incr('http.errors');
        },
      }),
    );
  }
}
