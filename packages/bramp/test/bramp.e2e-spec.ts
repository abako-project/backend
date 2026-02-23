import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PapiService } from './../src/papi/papi.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getPolkadotSigner } from 'polkadot-api/signer';
import { TrackerService } from './../src/tracker/tracker.service';
import { DepositModule } from './../src/deposit/deposit.module';
import { DepositService } from './../src/deposit/deposit.service';
import { WithdrawalService } from './../src/withdrawal/withdrawal.service';

describe('Bramp System (E2E) - On-Ramp / Off-Ramp Flow', () => {
    let app: INestApplication;
    let papiService: PapiService;
    let depositService: DepositService;
    let withdrawalService: WithdrawalService;
    let trackerService: TrackerService;
    let mockPrismaService: any;

    // In-memory DB state
    const usersDb = new Map();
    let txDb: any[] = [];
    let depositAddressesDb = new Map();

    beforeAll(async () => {
        // Reset In-Memory DB
        usersDb.clear();
        txDb = [];
        depositAddressesDb.clear();

        mockPrismaService = {
            user: {
                create: jest.fn().mockImplementation(({ data }) => {
                    const id = usersDb.size + 1;
                    const newUser = { id, ...data, balance: '0', createdAt: new Date(), updatedAt: new Date() };
                    usersDb.set(id, newUser);
                    return Promise.resolve(newUser);
                }),
                findUnique: jest.fn().mockImplementation(({ where }) => {
                    if (where.id) return Promise.resolve(usersDb.get(where.id));
                    if (where.email) {
                        for (const user of usersDb.values()) {
                            if (user.email === where.email) return Promise.resolve(user);
                        }
                    }
                    return Promise.resolve(null);
                }),
                update: jest.fn().mockImplementation(({ where, data }) => {
                    const user = usersDb.get(where.id);
                    if (user) {
                        // Simple update logic
                        if (data.balance && typeof data.balance === 'object' && data.balance.increment) {
                            const current = BigInt(user.balance);
                            const inc = BigInt(data.balance.increment);
                            user.balance = (current + inc).toString();
                        } else if (data.balance) {
                            user.balance = data.balance;
                        }
                        usersDb.set(where.id, user);
                        return Promise.resolve(user);
                    }
                    return Promise.resolve(null);
                }),
                deleteMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
            },
            transaction: {
                create: jest.fn().mockImplementation(({ data }) => {
                    const newTx = { id: txDb.length + 1, ...data };
                    txDb.push(newTx);
                    return Promise.resolve(newTx);
                }),
                findMany: jest.fn().mockImplementation(({ where }) => {
                    return Promise.resolve(txDb.filter(t => t.userId === where.userId));
                }),
                findUnique: jest.fn().mockImplementation(({ where }) => {
                    const tx = txDb.find(t => t.id === where.id);
                    return Promise.resolve(tx || null);
                }),
                findFirst: jest.fn().mockImplementation(({ where }) => {
                    // Simple find implementation matching userId, type, status, amount
                    const found = txDb.find(t => {
                        let match = true;
                        if (where.userId && t.userId !== where.userId) match = false;
                        if (where.type && t.type !== where.type) match = false;
                        if (where.status && t.status !== where.status) match = false;
                        if (where.amount && t.amount !== where.amount) match = false;
                        return match;
                    });
                    return Promise.resolve(found || null);
                }),
                update: jest.fn().mockImplementation(({ where, data }) => {
                    const txIndex = txDb.findIndex(t => t.id === where.id);
                    if (txIndex > -1) {
                        const updated = { ...txDb[txIndex], ...data };
                        txDb[txIndex] = updated;
                        return Promise.resolve(updated);
                    }
                    return Promise.resolve(null);
                }),
                deleteMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
            },
            depositAddress: {
                findUnique: jest.fn().mockImplementation(({ where, include }) => {
                    // Check by address or userId
                    let foundDa: any = null;
                    for (const da of depositAddressesDb.values()) {
                        if (where.address && da.address === where.address) foundDa = da;
                        if (where.userId && da.userId === where.userId) foundDa = da;
                    }

                    if (foundDa) {
                        // Mock include logic
                        if (include && include.user) {
                            return Promise.resolve({
                                ...foundDa,
                                user: usersDb.get(foundDa.userId)
                            });
                        }
                        return Promise.resolve(foundDa);
                    }
                    return Promise.resolve(null);
                }),
                create: jest.fn().mockImplementation(({ data }) => {
                    const newDa = { id: depositAddressesDb.size + 1, ...data };
                    depositAddressesDb.set(newDa.id, newDa);
                    return Promise.resolve(newDa);
                }),
                deleteMany: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
            $connect: jest.fn(),
            $disconnect: jest.fn(),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue(mockPrismaService)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        papiService = moduleFixture.get<PapiService>(PapiService);
        depositService = moduleFixture.get<DepositService>(DepositService);
        trackerService = moduleFixture.get<TrackerService>(TrackerService);
        withdrawalService = moduleFixture.get<WithdrawalService>(WithdrawalService);
    });

    afterAll(async () => {
        await app.close();
    });

    jest.setTimeout(120000);

    let userId: number;
    const userEmail = `test_onramp_${Date.now()}@example.com`;
    // Bob = Liquidity Provider (LP)
    // Charlie = End User
    let bobFiatBalance = 0; // Starts at 0 (or we can fund it conceptually)

    let currentDepositAddress: string | null = null;

    const printBalances = async (stage: string) => {
        console.log(`\n📊 --- [${stage}] ---`);
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice').address;
        const bob = keyring.addFromUri('//Bob').address;
        const charlie = keyring.addFromUri('//Charlie').address;

        const assets = [
            { name: 'Admin (Alice)', address: alice },
            { name: 'Liquidity Provider (Bob)', address: bob },
            { name: 'User (Charlie)', address: charlie },
        ];

        // Add Vault if exists
        if (currentDepositAddress) {
            assets.push({ name: 'App Vault (Deposit Addr)', address: currentDepositAddress });
        }

        for (const account of assets) {
            try {
                const bal = await papiService.api.query.Assets.Account.getValue(
                    { type: 'Here', value: 1 } as any,
                    account.address
                );
                let valBig = bal ? BigInt(bal.balance) : 0n;
                const val = valBig.toString();
                console.log(`   🏦 ${account.name.padEnd(30)}: ${val.padStart(10)} (Tokens)`);
            } catch (e) {
                console.log(`   🏦 ${account.name.padEnd(30)}:          0 (Tokens - No Account)`);
            }
        }

        // Simulating the "Bank Account" via DB
        if (userId) {
            const user = usersDb.get(userId);
            const dbBal = user ? user.balance : '0';
            console.log(`   💵 User App Ledger (Fiat?)      : ${dbBal.padStart(10)}`);
        }
        console.log(`   💵 Bob App Ledger (Fiat?)       : ${bobFiatBalance.toString().padStart(10)}`);

        console.log('-------------------------------\n');
    };

    describe('Setup & Funding', () => {
        it('✅ Step 0: Admin Funds Liquidity Provider (Bob)', async () => {
            await cryptoWaitReady();
            const alice = new Keyring({ type: 'sr25519' }).addFromUri('//Alice');
            const bob = new Keyring({ type: 'sr25519' }).addFromUri('//Bob');

            // Admin funds Bob with 100,000 Tokens if needed
            const bobAccount = await papiService.api.query.Assets.Account.getValue(
                { type: 'Here', value: 1 } as any,
                bob.address
            );

            if (!bobAccount || BigInt(bobAccount.balance) < 100000n) {
                console.log('   💰 Funding LP (Bob) with 100,000 Tokens...');
                const aliceSigner = getPolkadotSigner(alice.publicKey, 'Sr25519', (input) => alice.sign(input));
                await new Promise<void>((resolve) => {
                    papiService.api.tx.Assets.transfer({
                        id: { type: 'Here', value: 1 } as any,
                        target: { type: 'Id', value: bob.address },
                        amount: 100000n
                    }).signSubmitAndWatch(aliceSigner).subscribe({
                        next: (e: any) => { if (e.type === 'finalized') resolve(); }
                    });
                });
            }
            console.log('   ✅ LP Funded.');
        });

        it('✅ Step 1: Create User (Charlie)', async () => {
            const response = await request(app.getHttpServer())
                .post('/users')
                .send({
                    email: userEmail,
                })
                .expect(201);
            userId = response.body.id;

            // INTIALIZE FIAT BALANCE TO 10000 per User Request
            const userEntry = usersDb.get(userId);
            usersDb.set(userId, { ...userEntry, balance: '10000' });

            console.log(`✅ User Created (ID: ${userId}) - Initial Fiat: 10000`);
            await printBalances('INITIAL STATE');
        });
    });

    // --- DEPOSIT (On-Ramp: Fiat -> Crypto) ---
    // User sends Fiat -> LP sends Crypto
    describe('📥 DEPOSIT (On-Ramp: Buy Crypto)', () => {
        it('✅ Step 2: User requests 1000 -> LP sends 1000 Crypto', async () => {
            const charlie = new Keyring({ type: 'sr25519' }).addFromUri(`//Charlie/${Date.now()}`);
            const amount = '1000';

            console.log(`\n   🔄 [Scenario] Charlie sends 1000 Fiat to Bob's Bank...`);
            // SIMULATE FIAT TRANSFER: Charlie -> Bob
            const userEntry = usersDb.get(userId);
            usersDb.set(userId, { ...userEntry, balance: '10000' }); // Ensure started with 10k

            // Execute Request (App Logic: Deduct User Fiat -> Lock it)
            // Note: DepositService deducts from User. We assume this "Locked" meant "Sent to Bob".
            // So we manually increment Bob's Fiat here to represent the "Bank Transfer" completion.
            bobFiatBalance += 1000;
            console.log(`   💵 [Sim] Bank Transfer: Charlie (-${amount}) -> Bob (+${amount})`);

            console.log(`   🔄 App triggering Crypto Transfer (LP -> Charlie)...`);

            const req = await depositService.requestDeposit({ userId, amount, toAddress: charlie.address });
            // Confirm immediately (Simulate Automated Payout)
            await depositService.confirmDeposit(req.depositId, charlie.address);

            // Capture Deposit Address for future logs
            // Ideally we get it from DB as it is generated/used
            const da = await mockPrismaService.depositAddress.findUnique({ where: { userId } });
            if (da) currentDepositAddress = da.address;

            // Verify On-Chain
            console.log(`   ⏳ Verifying User received Crypto...`);
            let balance = 0n;
            for (let i = 0; i < 15; i++) {
                const acct = await papiService.api.query.Assets.Account.getValue(
                    { type: 'Here', value: 1 } as any,
                    charlie.address
                );
                if (acct && BigInt(acct.balance) > 0n) {
                    balance = BigInt(acct.balance);
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            expect(balance).toBeGreaterThanOrEqual(1000n);
            console.log(`   ✅ Charlie Received Crypto! Balance: ${balance}`);

            await printBalances('AFTER ON-RAMP');
        }, 120000);
    });

    // --- WITHDRAWAL (Off-Ramp: Crypto -> Fiat) ---
    // User sends Crypto -> LP sends Fiat
    describe('💵 WITHDRAWAL (Off-Ramp: Sell Crypto)', () => {
        it('✅ Step 3: User sends 1000 Crypto -> LP Credits Fiat', async () => {
            const charlie = new Keyring({ type: 'sr25519' }).addFromUri('//Charlie');
            const amount = 1000n;

            // 1. Create "Withdrawal Request" (Ingress Notice)
            console.log(`\n   🔄 User informing App of incoming transfer...`);
            await withdrawalService.create({ userId, amount: amount.toString() });

            // 2. User simulates sending Crypto to Bob (LP)
            console.log(`   🔄 User (Charlie) sending 1000 Crypto to LP (Vault)...`);
            const charlieSigner = getPolkadotSigner(charlie.publicKey, 'Sr25519', (input) => charlie.sign(input));

            // Get Deposit Address (User's specific Vault address)
            const userDa = await mockPrismaService.depositAddress.findUnique({ where: { userId } });
            const targetAddress = userDa.address;
            console.log(`   ℹ️  Sending to App Vault (User specific): ${targetAddress}`);

            await new Promise<void>((resolve) => {
                papiService.api.tx.Assets.transfer({
                    id: { type: 'Here', value: 1 } as any,
                    target: { type: 'Id', value: targetAddress },
                    amount: amount
                }).signSubmitAndWatch(charlieSigner).subscribe({
                    next: (e: any) => { if (e.type === 'finalized') resolve(); }
                });
            });

            console.log(`   ✅ Transfer Finalized.`);

            // 3. Wait for Credit (Fiat Payment Simulation)
            console.log(`   ⏳ Waiting for App to detect and credit Fiat...`);
            let dbBalance = '0';
            for (let i = 0; i < 30; i++) {
                const u = usersDb.get(userId);
                // On-Ramp left User with 9000 (10000 - 1000).
                // Off-Ramp Credits 1000 -> Should exist at 10000.
                if (u && u.balance === '10000') {
                    dbBalance = u.balance;
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            // SIMULATE FIAT PAYOUT: Bob -> Charlie
            // System credited Charlie in DB (`u.balance` increased).
            // We must reflect this came from Bob.
            bobFiatBalance -= 1000;
            console.log(`   💵 [Sim] Bank Payout: Bob (-1000) -> Charlie (+1000)`);

            expect(dbBalance).toBe('10000');
            console.log(`   ✅ Fiat Credited! User DB Balance: ${dbBalance}`);

            await printBalances('FINAL STATE');
        }, 120000);
    });
});
