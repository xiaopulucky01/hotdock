import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Platform listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/api/platform/health`);
}
bootstrap();
