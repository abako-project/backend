import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('Bramp Integration E2E Tests', () => {
    let app: INestApplication;
    let keyring: Keyring;

    let testClientKeypair: any;
    let testDeveloperKeypair: any;
    let testClientAddress: string;
    let testDeveloperAddress: string;

    beforeAll(async () => {
        await cryptoWaitReady();
        keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

        console.info('🚀 Starting Bramp Integration E2E Tests');
        console.info('='.repeat(80));

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
        console.info('='.repeat(80));
        console.info('✅ Bramp Integration E2E Tests Completed\n');
    });

    async function checkBalance(address: string, assetId: number = 1): Promise<bigint> {
        const federateServerUrl = 'http://localhost:3000/api';
        const response = await fetch(`${federateServerUrl}/balance?address=${encodeURIComponent(address)}&assetId=${assetId}`);
        if (!response.ok) {
            throw new Error(`Failed to get balance: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as { balance: string };
        return BigInt(data.balance);
    }

    describe('💰 Bramp Deposit Flow (On-Ramp)', () => {
        it('should create fresh test addresses for deposit test', async () => {
            console.log('Generating fresh keypair for deposit test...');

            testClientKeypair = keyring.addFromUri(`//TestClient/${Date.now()}`);
            testClientAddress = testClientKeypair.address;

            console.info(`✅ Generated test client address: ${testClientAddress}`);
            console.log('Funding test account with native token...');
            const alice = keyring.addFromUri('//Alice');

            expect(testClientAddress).toBeDefined();
            expect(testClientAddress).toMatch(/^5[A-Za-z0-9]{47}$/);
        });

        it('should check initial balance of test address', async () => {
            console.log(`Checking initial balance of ${testClientAddress}...`);

            const initialBalance = await checkBalance(testClientAddress);
            console.info(`   Initial balance: ${initialBalance}`);

            expect(initialBalance).toBeDefined();
        });

        it('should create bramp user and request deposit to test address', async () => {
            console.log('Creating bramp user for deposit test...');

            const testEmail = `bramp-deposit-test-${Date.now()}@example.com`;

            const createUserResponse = await request(app.getHttpServer())
                .post('/bramp/users')
                .send({ email: testEmail })
                .expect(201);

            const brampUser = createUserResponse.body;

            console.info(`✅ Created bramp user: ID ${brampUser.id}`);
            console.info(`   Email: ${testEmail}`);
            console.info(`   Bramp deposit address: ${brampUser.depositAddress.address}`);

            const depositAmount = '100';
            const depositResponse = await request(app.getHttpServer())
                .post('/bramp/deposit')
                .send({
                    userId: brampUser.id,
                    amount: depositAmount,
                    toAddress: testClientAddress
                })
                .expect(201);

            const depositRequest = depositResponse.body;

            console.info(`✅ Deposit requested: ID ${depositRequest.depositId}`);

            const confirmResponse = await request(app.getHttpServer())
                .post(`/bramp/deposit/${depositRequest.depositId}/confirm`)
                .send({ toAddress: testClientAddress })
                .expect(201);

            const confirmation = confirmResponse.body;

            console.info(`✅ Deposit confirmed:`);
            console.info(`   Transaction Hash: ${confirmation.txHash}`);
            console.info(`   Status: ${confirmation.status}`);

            expect(confirmation.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
            expect(confirmation.status).toBe('success');

            await new Promise(resolve => setTimeout(resolve, 6000));

            const finalBalance = await checkBalance(testClientAddress, 1);
            const nativeBalance = await checkBalance(testClientAddress, 0);
            console.log(`Final Asset 1 Balance: ${finalBalance}`);
            console.log(`Final Native Balance: ${nativeBalance}`);

            expect(nativeBalance).toBeGreaterThan(0);

            expect(finalBalance).toBeGreaterThan(0);
            console.info(`✅ Verified funds transferred to test address: ${testClientAddress}`);
        });
    });

    describe('💸 Bramp Withdrawal Flow (Off-Ramp)', () => {
        it('should create fresh test addresses for withdrawal test', async () => {
            console.log('Generating fresh keypair for withdrawal test...');

            testDeveloperKeypair = keyring.addFromUri(`//TestDeveloper/${Date.now()}`);
            testDeveloperAddress = testDeveloperKeypair.address;

            console.info(`✅ Generated test developer address: ${testDeveloperAddress}`);
            expect(testDeveloperAddress).toBeDefined();
            expect(testDeveloperAddress).toMatch(/^5[A-Za-z0-9]{47}$/);
        });

        it('should create bramp user and request withdrawal from test address', async () => {
            console.log('Creating bramp user for withdrawal test...');

            const testEmail = `bramp-withdrawal-test-${Date.now()}@example.com`;

            const createUserResponse = await request(app.getHttpServer())
                .post('/bramp/users')
                .send({ email: testEmail })
                .expect(201);

            const brampUser = createUserResponse.body;

            console.info(`✅ Created bramp user: ID ${brampUser.id}`);
            console.info(`   Email: ${testEmail}`);
            console.info(`   Bramp deposit address: ${brampUser.depositAddress.address}`);

            const withdrawalAmount = '3000';
            const withdrawalResponse = await request(app.getHttpServer())
                .post('/bramp/withdrawal')
                .send({
                    userId: brampUser.id,
                    amount: withdrawalAmount
                })
                .expect(201);

            const withdrawal = withdrawalResponse.body;

            console.info(`✅ Withdrawal created:`);
            console.info(`   Withdrawal ID: ${withdrawal.withdrawalId}`);
            console.info(`   Deposit Address: ${withdrawal.depositAddress}`);
            console.info(`   Amount: ${withdrawal.amount}`);

            expect(withdrawal.withdrawalId).toBeGreaterThan(0);
            expect(withdrawal.depositAddress).toMatch(/^5[A-Za-z0-9]{47}$/);
            expect(withdrawal.amount).toBe(withdrawalAmount);

            console.info(`✅ Developer should send ${withdrawalAmount} from ${testDeveloperAddress} to ${withdrawal.depositAddress}`);
            console.info(`✅ Then bramp processes off-ramp to fiat`);
        });
    });

    describe('🔍 Bramp Balance Verification', () => {
        it('should verify Bramp Provider (Alice) has sufficient funds', async () => {
            console.log('Checking bramp provider (Alice) balance...');

            const aliceKeypair = keyring.addFromUri('//Alice');
            const aliceAddress = aliceKeypair.address;

            const aliceBalance = await checkBalance(aliceAddress);
            console.info(`   Alice's balance: ${aliceBalance}`);

            expect(aliceBalance).toBeGreaterThan(100000);
            console.info(`✅ Bramp provider has sufficient funds for operations`);
        });
    });
});
