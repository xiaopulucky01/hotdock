import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PluginRuntimeService } from './../src/core/plugin-runtime/plugin-runtime.service';

describe('Platform (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.DATA_DIR = `${process.cwd()}/.data-test-${process.pid}`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.get(PluginRuntimeService).bindApplication(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: false,
      }),
    );
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

  it('auth login returns jwt tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.tokenType).toBe('Bearer');

    await request(app.getHttpServer())
      .get('/api/platform/users')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('can disable and re-enable demo without restart', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);
    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/platform/modules/demo/disable')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer()).get('/api/demo/hello').expect(404);

    await request(app.getHttpServer())
      .post('/api/platform/modules/demo/enable')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
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
