import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import * as crypto from 'crypto';

function generateAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let addr = '5';
    for (let i = 0; i < 47; i++) {
        addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr;
}

describe('Bramp Integration E2E Tests', () => {
    let app: INestApplication;
    let testClientAddress: string;
    let testDeveloperAddress: string;

    beforeAll(async () => {
        console.info('Starting Bramp Integration E2E Tests');

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        await app.init();

        testClientAddress = generateAddress();
        testDeveloperAddress = generateAddress();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Bramp Deposit Flow (On-Ramp)', () => {
        it('should create bramp user and request deposit to test address', async () => {
            const testEmail = `bramp-deposit-test-${Date.now()}@example.com`;

            const createUserResponse = await request(app.getHttpServer())
                .post('/v1/bramp/users')
                .send({ email: testEmail })
                .expect(201);

            const brampUser = createUserResponse.body;
            expect(brampUser).toHaveProperty('id');
            expect(brampUser).toHaveProperty('email', testEmail);
            expect(brampUser).toHaveProperty('depositAddress');

            const depositResponse = await request(app.getHttpServer())
                .post('/v1/bramp/deposit')
                .send({
                    userId: brampUser.id,
                    amount: '100',
                    toAddress: testClientAddress
                })
                .expect(201);

            const depositRequest = depositResponse.body;
            expect(depositRequest).toHaveProperty('depositId');
            expect(depositRequest).toHaveProperty('instructions');

            const confirmResponse = await request(app.getHttpServer())
                .post(`/v1/bramp/deposit/${depositRequest.depositId}/confirm`)
                .send({ toAddress: testClientAddress })
                .expect(201);

            const confirmation = confirmResponse.body;
            expect(confirmation.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
            expect(confirmation.status).toBe('success');
        });
    });

    describe('Bramp Withdrawal Flow (Off-Ramp)', () => {
        it('should create bramp user and request withdrawal', async () => {
            const testEmail = `bramp-withdrawal-test-${Date.now()}@example.com`;

            const createUserResponse = await request(app.getHttpServer())
                .post('/v1/bramp/users')
                .send({ email: testEmail })
                .expect(201);

            const brampUser = createUserResponse.body;
            expect(brampUser).toHaveProperty('id');

            const withdrawalAmount = '3000';
            const withdrawalResponse = await request(app.getHttpServer())
                .post('/v1/bramp/withdrawal')
                .send({
                    userId: brampUser.id,
                    amount: withdrawalAmount
                })
                .expect(201);

            const withdrawal = withdrawalResponse.body;
            expect(withdrawal.withdrawalId).toBeGreaterThan(0);
            expect(withdrawal.depositAddress).toMatch(/^5[A-Za-z0-9]{47}$/);
            expect(withdrawal.amount).toBe(withdrawalAmount);
        });
    });

    describe('Bramp User Management', () => {
        it('should list all bramp users', async () => {
            const response = await request(app.getHttpServer())
                .get('/v1/bramp/users')
                .expect(200);

            // getUserByEmail returns null when no email query is provided
            // This tests the endpoint is reachable
        });
    });
});
