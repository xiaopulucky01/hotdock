import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Platform (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/platform/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/platform/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBeDefined();
      });
  });

  it('/api/demo/hello (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/demo/hello')
      .expect(200)
      .expect((res) => {
        expect(res.body.enabled).toBe(true);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
