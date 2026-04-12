import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MockAuthHelper } from './mock-auth-helper';

describe('Calendar Module E2E Tests', () => {
  let app: INestApplication;
  let auth: MockAuthHelper;
  let authToken: string;
  let userId: string;
  let workerAccountId: string;
  let contractAddress: string;

  beforeAll(async () => {
    console.log('Starting Calendar E2E tests...');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    auth = new MockAuthHelper(app.getHttpServer());
    userId = `test-calendar-user-${Date.now()}@example.com`;
    console.log(`Test user: ${userId}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete flow: Auth + Calendar', () => {
    describe('Authentication', () => {
      it('should register and connect a user', async () => {
        const result = await auth.registerAndConnect(userId);
        authToken = result.token;
        workerAccountId = result.accountId;

        expect(authToken).toBeDefined();
        expect(workerAccountId).toBeDefined();
        console.log(`Token received, worker: ${workerAccountId}`);
      });
    });

    describe('Deploy Calendar Contract', () => {
      it('should deploy a new calendar contract', async () => {
        // Deploy directly via mock signing service
        const signingServiceUrl = process.env.SIGNING_SERVICE_URL || 'http://localhost:4010';
        const deployResponse = await fetch(`${signingServiceUrl}/calendar/deploy/v5`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const result = await deployResponse.json() as any;
        expect(result.success).toBe(true);
        expect(result.address).toBeDefined();

        contractAddress = result.address;
        console.log(`Calendar contract deployed at: ${contractAddress}`);
      });
    });

    describe('Worker Registration', () => {
      it('should register a worker in the calendar', async () => {
        const response = await request(app.getHttpServer())
          .post(`/v1/calendar/${contractAddress}/register_worker`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ worker: workerAccountId });

        expect(response.body).toHaveProperty('success', true);
        console.log('Worker registered successfully');
      });
    });

    describe('Set Availability', () => {
      it('should set availability', async () => {
        const response = await request(app.getHttpServer())
          .post(`/v1/calendar/${contractAddress}/set_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ availability: { WeeklyHours: 40 } });

        expect(response.body).toHaveProperty('success', true);
        console.log('Availability set successfully');
      });
    });
  });
});
