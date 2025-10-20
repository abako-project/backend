import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SDK } from '@virtonetwork/sdk';

describe('Auth Module - Registration Flow E2E', () => {
  let app: INestApplication;
  let userId: string;
  let sdk: SDK;
  let preparedRegistrationData: any;

  beforeAll(async () => {
    console.log('Starting NestJS application for E2E tests...');
    
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
    userId = `test-user-${Date.now()}@example.com`;
    
    console.log('Application started successfully');
    console.log('Client SDK initialized');
    console.log(`Test user: ${userId}`);
  });

  afterAll(async () => {
    console.log('Closing application...');
    await app.close();
  });

  describe('Initial registration verification', () => {
    it('should verify that user is NOT registered initially', async () => {
      console.log('Verifying that user is not registered...');
      
      const response = await request(app.getHttpServer())
        .get(`/auth/check-registered/${userId}`)
        .expect(200);

      console.log('Response received:', response.body);

      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('isRegistered', false);
      
      console.log('User is NOT registered (as expected)');
    });
  });

  describe('Registration data preparation with SDK', () => {
    it('should prepare registration data using client SDK', async () => {
      console.log('Preparing registration data with client SDK...');
      console.log(`Preparing registration for user: ${userId}`);
      
      const userData = {
        profile: {
          id: userId,
          name: 'Test User E2E',
        }
      };

      // Prepare registration using SDK (this uses navigator.credentials internally)
      preparedRegistrationData = await sdk.auth.prepareRegistration(userData);

      console.log('Registration data prepared successfully');
      console.log('Prepared data:', JSON.stringify({
        userId: preparedRegistrationData.userId,
        hasAttestation: !!preparedRegistrationData.attestation,
        hasHashedUserId: !!preparedRegistrationData.hashedUserId,
        hasCredentialId: !!preparedRegistrationData.credentialId,
        hasPassAccount: !!preparedRegistrationData.passAccountAddress,
      }, null, 2));

      expect(preparedRegistrationData).toBeDefined();
      expect(preparedRegistrationData.attestation).toBeDefined();
      expect(preparedRegistrationData.hashedUserId).toBeDefined();
      expect(preparedRegistrationData.credentialId).toBeDefined();
      expect(preparedRegistrationData.userId).toBe(userId);
      expect(preparedRegistrationData.passAccountAddress).toBeDefined();
    });
  });

  describe('Complete registration with attestation', () => {
    it('should complete registration on the server', async () => {
      console.log('Sending registration data to server...');
      
      if (!preparedRegistrationData) {
        throw new Error('No prepared data. Run step 2 first.');
      }

      console.log('Sending data to /auth/custom-register endpoint...');
      console.log('- User ID:', preparedRegistrationData.userId);
      console.log('- Credential ID:', preparedRegistrationData.credentialId?.substring(0, 20) + '...');
      console.log('- Pass Account:', preparedRegistrationData.passAccountAddress);

      // Send registration request to the server
      const response = await request(app.getHttpServer())
        .post('/auth/custom-register')
        .send(preparedRegistrationData);

      console.log('Server response (status', response.status + '):');
      console.log(JSON.stringify(response.body, null, 2));

      if (response.status === 200 || response.status === 201) {
        console.log('Registration completed successfully');
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Registration completed successfully');
        expect(response.body).toHaveProperty('data');
      } else {
        console.log('Registration error:', response.body);
        throw new Error(`Registration failed with status ${response.status}: ${JSON.stringify(response.body)}`);
      }
    });
  });

  describe('Successful registration verification', () => {
    it('should verify that user is NOW registered', async () => {
      console.log('Verifying that user is now registered...');
      
      const response = await request(app.getHttpServer())
        .get(`/auth/check-registered/${userId}`)
        .expect(200);

      console.log('Response received:', response.body);

      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('isRegistered', true);
      
      console.log('User is NOW registered correctly');
      console.log('REGISTRATION FLOW COMPLETED SUCCESSFULLY');
    });
  });
});
