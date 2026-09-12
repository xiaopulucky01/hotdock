import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PluginRuntimeService } from './core/plugin-runtime/plugin-runtime.service';
import { RealtimeService } from './core/realtime/realtime.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.get(PluginRuntimeService).bindApplication(app);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  const httpServer = app.getHttpServer();
  app.get(RealtimeService).bindHttpServer(httpServer);
  console.log(`Hotdock listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/api/platform/health`);
  console.log(`Metrics: http://localhost:${port}/api/platform/metrics/prometheus`);
  console.log(`WebSocket: ws://localhost:${port}/api/platform/ws`);
}
bootstrap();
