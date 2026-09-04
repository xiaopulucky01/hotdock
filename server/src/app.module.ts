import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PlatformModule } from './core/platform.module';
import { DemoModule } from './modules/demo/demo.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import {
  AuthGuard,
  PlatformExceptionFilter,
  RateLimitGuard,
  RequestContextInterceptor,
  TenantGuard,
} from './core/gateway';

@Module({
  imports: [PlatformModule, DemoModule, AiChatModule],
  providers: [
    { provide: APP_FILTER, useClass: PlatformExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
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
