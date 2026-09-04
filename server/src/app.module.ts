import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PlatformModule } from './core/platform.module';
import { DemoModule } from './modules/demo/demo.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import {
  PlatformExceptionFilter,
  RateLimitGuard,
  RequestContextInterceptor,
} from './core/gateway';

@Module({
  imports: [PlatformModule, DemoModule, AiChatModule],
  providers: [
    { provide: APP_FILTER, useClass: PlatformExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
