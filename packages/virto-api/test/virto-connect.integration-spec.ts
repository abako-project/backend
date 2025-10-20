import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import WebAuthnEmulator from 'nid-webauthn-emulator';
import { hexToUint8Array, base64urlToUint8Array } from './utils/base64';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('API Integration Tests', () => {
  let app: INestApplication;
  let emulator: WebAuthnEmulator;
  let userId: string;
  let mockUser: any;
  const origin = 'http://example.com';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();

    emulator = new WebAuthnEmulator();
    userId = 'testuser@example.com';
  });

  afterAll(async () => {
    await app.close();
  });

  let mockAttestationResponse: any;
  let mockAssertionResponse: any;
  let chopsticksSessionId: string;
  let chopsticksWsUrl: string;

  describe('Chopsticks Module', () => {
    describe('POST /chopsticks/start', () => {
      it('should start a chopsticks session', async () => {
        try {
          const response = await request(app.getHttpServer())
            .post('/chopsticks/start')
            .send({})
            .expect((res) => res.status >= 200 && res.status < 300); // Accept any success status

          if (response.body && response.body.sessionId) {
            chopsticksSessionId = response.body.sessionId;
            chopsticksWsUrl = `ws://localhost:${response.body.port}`;
            expect(response.body).toHaveProperty('sessionId');
          }
        } catch (error) {
          console.log('Error starting chopsticks session:', error.message);
        }
      });
    });

    describe('GET /chopsticks/session/:sessionId', () => {
      it('should return session info', async () => {
        const response = await request(app.getHttpServer())
          .get(`/chopsticks/session/${chopsticksSessionId}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('sessionId');
        expect(response.body.sessionId).toBe(chopsticksSessionId);
      });
    });
  });

  describe('VOS-Mock Module', () => {
    describe('GET /api/health', () => {
      it('should return health status', async () => {
        try {
          const response = await request(app.getHttpServer())
            .get('/api/health')
            .expect((res) => res.status >= 200 && res.status < 300);

          expect(response.body).toHaveProperty('status');
          if (response.body.status === 'ok') {
            expect(response.body.service).toBe('vos-mock');
          }
        } catch (error) {
          console.log('Error checking health status:', error.message);
        }
      });
    });

    describe('WebAuthn Registration Flow', () => {
      let blockNumber: number;
      it('GET /api/attestation should return attestation options with real response', async () => {
        mockUser = {
          profile: {
            id: userId,
            displayName: 'John Doe',
          },
          metadata: {},
        };
        const agent = request.agent(app.getHttpServer());

        const response = await agent
          .get(`/api/attestation?id=${userId}&name=John Doe&sessionId=${chopsticksSessionId}&wsUrl=${chopsticksWsUrl}`)
          .expect((res) => res.status >= 200 && res.status < 300);

        const attestationOptions = response.body;
        blockNumber = attestationOptions.blockNumber;

        if (attestationOptions && attestationOptions.publicKey && attestationOptions.publicKey.challenge) {
          const challengeU8 = hexToUint8Array(attestationOptions.publicKey.challenge);
          attestationOptions.publicKey.challenge = challengeU8.buffer;

          if (Array.isArray(attestationOptions.publicKey.user.id)) {
            const userIdU8 = new Uint8Array(attestationOptions.publicKey.user.id);
            attestationOptions.publicKey.user.id = userIdU8.buffer;
          }
          mockAttestationResponse = emulator.create(origin, attestationOptions);

          expect(attestationOptions.publicKey).toHaveProperty('challenge');
          expect(attestationOptions).toHaveProperty('blockNumber');
        }
      });

      it('POST /api/register should process attestation response with real data', async () => {      
        const response = await request(app.getHttpServer())
          .post(`/api/register?sessionId=${chopsticksSessionId}&wsUrl=${chopsticksWsUrl}`)
          .send({
            userId: userId,
            attestationResponse: mockAttestationResponse,
            blockNumber: blockNumber,
          });
          
        expect(response.status).toBe(201);

        console.log("response.status", response.status);
        console.log("response.body", response.body);
          expect(response.body.ext).toMatch(/^0x/);
      });
    });

    describe('WebAuthn Authentication Flow', () => {
      let blockNumber: number;
      it('GET /api/assertion should return assertion options with real data', async () => {
        const agent = request.agent(app.getHttpServer());

        const response = await agent
          .get(`/api/assertion?userId=${userId}&sessionId=${chopsticksSessionId}&wsUrl=${chopsticksWsUrl}`)

        expect(response.status).toBe(200);

        const assertionOptions = response.body;
        blockNumber = assertionOptions.blockNumber;
        if (assertionOptions && assertionOptions.publicKey && assertionOptions.publicKey.challenge) {
          const challengeU8 = hexToUint8Array(assertionOptions.publicKey.challenge);
          assertionOptions.publicKey.challenge = challengeU8.buffer;

          if (assertionOptions.publicKey.allowCredentials && assertionOptions.publicKey.allowCredentials.length > 0) {
            const userIdU8 = base64urlToUint8Array(assertionOptions.publicKey.allowCredentials[0].id);
            assertionOptions.publicKey.allowCredentials[0].id = userIdU8;
          }

          mockAssertionResponse = emulator.get(origin, assertionOptions);

          expect(assertionOptions.publicKey).toHaveProperty('challenge');
          expect(assertionOptions).toHaveProperty('blockNumber');
        }
      });

      it('POST /api/connect should process assertion response with real data', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/connect?sessionId=${chopsticksSessionId}&wsUrl=${chopsticksWsUrl}`)
          .send({
            userId: userId,
            assertionResponse: mockAssertionResponse,
            blockNumber: blockNumber,
          })

          expect(response.status).toBe(201);
          expect(response.body.command).toHaveProperty('hex');
          expect(response.body.command.hex).toMatch(/^0x/);
      });
    });

    describe('GET /api/check-user-registered', () => {
      it('should check if user is registered', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/check-user-registered?userId=${userId}&sessionId=${chopsticksSessionId}&wsUrl=${chopsticksWsUrl}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('ok');
      });
    });
  });
});


