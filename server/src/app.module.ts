import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PlatformModule } from './core/platform.module';
import {
  AuthGuard,
  PlatformExceptionFilter,
  RateLimitGuard,
  RequestContextInterceptor,
  TenantGuard,
} from './core/gateway';
import { IdempotencyInterceptor } from './core/distributed/idempotency.interceptor';

/**
 * Host application — Platform Core only.
 * Business modules (demo, ai-chat, …) are hot-plugged by PluginRuntime
 * from dist/modules/{name}/plugin.js or HOTDOCK_PLUGINS_DIR.
 */
@Module({
  imports: [PlatformModule],
  providers: [
    { provide: APP_FILTER, useClass: PlatformExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: false,
      }),
    },
  ],
})
export class AppModule {}
