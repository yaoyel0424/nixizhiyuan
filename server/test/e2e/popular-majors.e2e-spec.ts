import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('PopularMajorsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/popular-majors (GET)', () => {
    it('应该返回热门专业列表', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('items');
          expect(res.body.data).toHaveProperty('meta');
          expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });

    it('应该支持分页查询', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.meta.page).toBe(1);
          expect(res.body.data.meta.limit).toBe(5);
          expect(res.body.data.items.length).toBeLessThanOrEqual(5);
        });
    });

    it('应该支持按 level1 筛选', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors?level1=ben')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          if (res.body.data.items.length > 0) {
            expect(res.body.data.items[0].level1).toBe('ben');
          }
        });
    });


    it('应该支持排序', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors?sortBy=name&sortOrder=ASC')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
        });
    });

    it('应该验证分页参数', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors?page=0')
        .expect(400);
    });

    it('应该验证 limit 参数', () => {
      return request(app.getHttpServer())
        .get('/api/v1/popular-majors?limit=101')
        .expect(400);
    });
  });

});

