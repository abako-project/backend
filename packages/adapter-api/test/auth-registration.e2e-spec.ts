import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MockAuthHelper } from './mock-auth-helper';

describe('Auth Module - Registration Flow E2E', () => {
  let app: INestApplication;
  let auth: MockAuthHelper;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    console.log('Starting NestJS application for E2E tests...');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    auth = new MockAuthHelper(app.getHttpServer());
    userId = `test-user-${Date.now()}@example.com`;

    console.log('Application started successfully');
    console.log(`Test user: ${userId}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Initial registration verification', () => {
    it('should verify that user is NOT registered initially', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/auth/check-registered/${userId}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('isRegistered', false);
    });
  });

  describe('Registration', () => {
    it('should register a new user', async () => {
      const result = await auth.registerUser(userId);
      expect(result.success).toBe(true);
      expect(result.passAccountAddress).toBeDefined();
      expect(result.roles).toEqual([
        { id: 2, name: 'frontend', selectable: true },
      ]);
    });
  });

  describe('Post-registration verification', () => {
    it('should verify that user is NOW registered', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/auth/check-registered/${userId}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('isRegistered', true);
    });
  });

  describe('Connection', () => {
    it('should connect user and obtain token', async () => {
      token = await auth.connectUser(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format
    });

    it('should return the current roles from the mock database', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.roles).toEqual([
        { id: 2, name: 'frontend', selectable: true },
      ]);
    });
  });
});
