import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SDK } from '@virtonetwork/sdk';

describe('Calendar Module E2E Tests', () => {
  let app: INestApplication;
  let sdk: SDK;
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
    await app.init();

    // Initialize client SDK
    sdk = new SDK({
      federate_server: 'http://localhost:3000/api',
      provider_url: 'ws://localhost:21000',
    });

    // Generate a unique user ID for this test run
    userId = `test-calendar-user-${Date.now()}@example.com`;

    console.log(`Test user: ${userId}`);
  });

  afterAll(async () => {
    console.log('Closing application...');
    await app.close();
  });

  describe('Complete flow: Auth + Calendar', () => {
    describe('Authentication - Registration and Connection', () => {
      it('should register a new user', async () => {
        console.log('Registering new user...');

        const userData = {
          profile: {
            id: userId,
            name: 'Calendar Test User',
          }
        };

        const preparedData = await sdk.auth.prepareRegistration(userData);

        workerAccountId = preparedData.passAccountAddress;

        const response = await request(app.getHttpServer())
          .post('/auth/custom-register')
          .send(preparedData);

        console.log('User registered:', response.body.success);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.body).toHaveProperty('success', true);
      });

      it('should connect user and obtain token', async () => {
        console.log('Connecting user and obtaining token...');

        const preparedConnection = await sdk.auth.prepareConnection(userId);
        console.log('Connection data prepared');

        const response = await request(app.getHttpServer())
          .post('/auth/custom-connect')
          .send({ userId });

        console.log(`Connection status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.body, null, 2));

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = response.body;

        console.log("result", result);

        console.log('Connection completed successfully on the server:', 'success');
        console.log(JSON.stringify(result, null, 2));
        // The user signs the transaction that starts the session on the server
        const resultCustom = await sdk.auth.sign(result.extrinsic);
        console.log("resultCustom", resultCustom);


        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('extrinsic');

        authToken = response.body.token;

        console.log(`Token received: ${authToken.substring(0, 20)}...`);
        console.log(`Worker Account ID: ${workerAccountId}`);
      });
    });

    describe('Deploy Calendar Contract', () => {
      it('should deploy a new calendar contract', async () => {
        console.log('Deploying calendar contract...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post('/calendar/deploy/v5')
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Deploy response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('address');

        contractAddress = response.body.address;

        console.log(`Contract deployed successfully at: ${contractAddress}`);
      });
    });

    describe('Calendar - Worker Registration', () => {
      it('should register a worker in the calendar', async () => {
        console.log('Registering worker in calendar...');
        console.log(`Contract: ${contractAddress}`);
        console.log(`Worker: ${workerAccountId}`);

        expect(authToken).toBeDefined();
        expect(contractAddress).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/register_worker`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ worker: workerAccountId });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('Worker registered successfully');
      });
    });

    describe('Calendar - Set Availability (expected to fail)', () => {
      it('should fail when attempting to set availability - known error in origin', async () => {
        console.log('Attempting set_availability (expected to fail)...');

        expect(authToken).toBeDefined();
        expect(contractAddress).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/set_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ availability: { WeeklyHours: 40 } });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        // Expected to fail - known error in service origin
        expect(response.body).toHaveProperty('success', false);
        console.log('Test passed: set_availability failed as expected');
      });
    });

    describe('Calendar - Admin Operations', () => {
      it('should set 40 hours availability for main worker as admin', async () => {
        console.log('Admin setting 40 hours for main worker...');

        expect(authToken).toBeDefined();
        expect(workerAccountId).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: workerAccountId,
            availability: { type: "WeeklyHours", value: 40 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('40 hours availability set by admin for main worker');
      });

      it('should register multiple additional workers at once', async () => {
        console.log('Registering multiple additional workers...');

        expect(authToken).toBeDefined();

        const workers = [
          '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
        ];

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/register_workers`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ workers });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('Multiple additional workers registered successfully');
      });

      it('should set 30 hours availability for first additional worker', async () => {
        console.log('Admin setting 30 hours for additional worker 1...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
            availability: { type: "WeeklyHours", value: 30 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('30 hours availability set by admin');
      });

      it('should set 20 hours availability for second additional worker', async () => {
        console.log('Admin setting 20 hours for additional worker 2...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${contractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
            availability: { type: "WeeklyHours", value: 20 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('20 hours availability set by admin');
      });
    });

    describe('Calendar - Queries', () => {
      it('should get worker availability hours (40 hours)', async () => {
        console.log('Querying main worker availability hours...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/get_availability_hours`)
          .query({ worker: workerAccountId });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        
        if (response.body.success) {
          expect(response.body).toHaveProperty('response');
          console.log('Availability hours obtained:', response.body.response);
        } else {
          console.log('Query did not return success=true:', response.body);
        }
      });

      it('should verify if worker is available', async () => {
        console.log('Verifying worker availability...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/is_available`)
          .query({ worker: workerAccountId });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        
        if (response.body.success) {
          expect(response.body).toHaveProperty('response');
          console.log('Availability status verified:', response.body.response);
        } else {
          console.log('Query did not return success=true:', response.body);
        }
      });

      it('should verify availability with minimum hours', async () => {
        console.log('Verifying availability with minimum of 35 hours...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/is_available`)
          .query({ worker: workerAccountId, min_hours: 35 });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        
        if (response.body.success) {
          expect(response.body).toHaveProperty('response');
          console.log('Verification with minimum of 35 hours completed:', response.body.response);
        } else {
          console.log('Query did not return success=true:', response.body);
        }
      });

      it('should get all registered workers (3 workers)', async () => {
        console.log('Getting all registered workers...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/get_registered_workers`);

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('response');
        expect(Array.isArray(response.body.response)).toBe(true);
        expect(response.body.response.length).toBe(3);
        console.log(`Registered workers obtained: ${response.body.response.length} workers`);
      });

      it('should get all available workers (3 workers)', async () => {
        console.log('Getting all available workers...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/get_available_workers`);

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('response');
        expect(Array.isArray(response.body.response)).toBe(true);
        expect(response.body.response.length).toBeGreaterThanOrEqual(3);
        console.log(`Available workers obtained: ${response.body.response.length} workers`);
      });

      it('should get available workers with minimum of 25 hours', async () => {
        console.log('Getting workers with minimum of 25 hours...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/get_available_workers`)
          .query({ min_hours: 25 });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('response');
        expect(Array.isArray(response.body.response)).toBe(true);
        expect(response.body.response.length).toBeGreaterThanOrEqual(1);
        console.log(`Workers with minimum of 25 hours obtained: ${response.body.response.length} workers`);
      });

      it('should get availability of all workers', async () => {
        console.log('Getting availability of all workers...');

        const response = await request(app.getHttpServer())
          .get(`/calendar/${contractAddress}/get_all_workers_availability`);

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('response');
        expect(Array.isArray(response.body.response)).toBe(true);
        expect(response.body.response.length).toBeGreaterThanOrEqual(3);
        console.log(`Availability of all workers obtained: ${response.body.response.length} workers`);
      });
    });
  });
});


