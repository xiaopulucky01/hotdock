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
      traceparent?: string;
    }>();
    const res = context.switchToHttp().getResponse<{
      setHeader: (k: string, v: string) => void;
    }>();

    const correlationId =
      req.headers['x-correlation-id'] ??
      req.headers['x-request-id'] ??
      randomUUID();
    req.correlationId = correlationId;
    const traceparent =
      req.headers['traceparent'] ??
      `00-${correlationId.replace(/-/g, '').padEnd(32, '0').slice(0, 32)}-${randomUUID().replace(/-/g, '').slice(0, 16)}-01`;
    req.traceparent = traceparent;

    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-api-version', '1');
    res.setHeader('traceparent', traceparent);

    const span = this.obs.startSpan(
      correlationId,
      `${req.method} ${req.url.split('?')[0]}`,
    );
    const started = Date.now();
    this.obs.incr('http.requests');

    return next.handle().pipe(
      tap({
        next: () => {
          this.obs.incr('http.success');
          this.obs.observe('http.duration_ms', Date.now() - started);
          this.obs.endSpan(span, 'ok');
          this.obs.log(
            'log',
            `${req.method} ${req.url} ${Date.now() - started}ms [${correlationId}]`,
          );
        },
        error: () => {
          this.obs.incr('http.errors');
          this.obs.observe('http.duration_ms', Date.now() - started);
          this.obs.endSpan(span, 'error');
        },
      }),
    );
  }
}
