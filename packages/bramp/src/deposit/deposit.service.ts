import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PapiService } from '../papi/papi.service';
import { Keyring } from '@polkadot/keyring';
import { getPolkadotSigner } from '@polkadot-api/signer';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { Enum } from 'polkadot-api';

const PROVIDER_URI = process.env.MASTER_ACCOUNT_URI || '//Alice';

@Injectable()
export class DepositService {
    private keyring: Keyring;
    private logger = new Logger(DepositService.name);

    constructor(
        private prisma: PrismaService,
        private papi: PapiService
    ) {
        this.keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
    }

    async requestDeposit(createDepositDto: CreateDepositDto) {
        const { userId: userIdRaw, amount } = createDepositDto;
        console.log('userIdRaw', userIdRaw, typeof userIdRaw);
        const userId = Number(userIdRaw);
        console.log('userId', userId, typeof userId);

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new BadRequestException('User not found');

        // const currentBalance = BigInt(user.balance);
        // const withdrawAmount = BigInt(amount);

        // if (currentBalance < withdrawAmount) {
        //    throw new BadRequestException('Insufficient funds');
        // }

        // const newBalance = (currentBalance - withdrawAmount).toString();
        // await this.prisma.user.update({
        //    where: { id: userId },
        //    data: { balance: newBalance }
        // });

        const tx = await this.prisma.transaction.create({
            data: {
                amount,
                type: 'DEPOSIT',
                status: 'PENDING',
                userId,
            }
        });

        return {
            message: 'Deposit requested. Please proceed with payment/confirmation.',
            depositId: tx.id,
            instructions: {
                amount,
                bankAccount: 'BANK-SIMULATION-1234',
                reference: `DEP-${tx.id}`
            }
        };
    }

    async confirmDeposit(depositId: number, toAddress: string) {
        await cryptoWaitReady();

        const txRecord = await this.prisma.transaction.findUnique({ where: { id: depositId } });
        if (!txRecord) throw new BadRequestException('Transaction not found');
        if (txRecord.status !== 'PENDING') throw new BadRequestException('Transaction not pending');

        const amount = BigInt(txRecord.amount);

        this.logger.log(`Processing "Bank Simulation" for Deposit #${depositId}`);

        try {
            const providerPair = this.keyring.createFromUri(PROVIDER_URI);
            const signer = getPolkadotSigner(
                providerPair.publicKey,
                'Sr25519',
                (input) => providerPair.sign(input)
            );

            this.logger.log(`Initiating Transfer: ${amount} to ${toAddress}`);

            // 1. Send Native Token (ED)
            this.logger.log(`Step 1: Sending Native Token (ED) to ${toAddress}`);
            const txNative = this.papi.api.tx.Balances.transfer_allow_death({
                dest: Enum('Id', toAddress),
                value: BigInt(100), // 10 Units
            });

            await txNative.signSubmitAndWatch(signer).toPromise();
            this.logger.log(`Native Transfer Finalized`);

            // 2. Transfer Asset 1 (amount) to toAddress
            this.logger.log(`Step 2: Transferring Asset 1 (${amount}) to ${toAddress}`);

            const tx = this.papi.api.tx.Assets.transfer({
                id: Enum('Here', 1),
                target: Enum('Id', toAddress),
                amount: BigInt(amount),
            });

            return new Promise((resolve, reject) => {
                tx.signSubmitAndWatch(signer).subscribe({
                    next: (event) => {
                        this.logger.log(`Tx Status: ${event.type}`);
                        if (event.type === 'finalized') {
                            this.logger.log(`Deposit Finalized. Block: ${event.block.hash}`);

                            // Check for Dispatch Error
                            const events = event.events;
                            const failure = events.find(e => e.type === 'System' && e.value.type === 'ExtrinsicFailed');

                            if (failure) {
                                this.logger.error(`Deposit Failed On-Chain: ${JSON.stringify(failure, (key, value) =>
                                    typeof value === 'bigint' ? value.toString() : value
                                )}`);
                                this.refundUser(txRecord.userId, txRecord.amount)
                                    .then(() => reject(new Error('Transaction failed on-chain (DispatchError)')));
                                return;
                            }

                            this.logger.log('Deposit Success: No DispatchError found.');

                            this.prisma.transaction.update({
                                where: { id: depositId },
                                data: {
                                    txHash: event.txHash,
                                }
                            }).then(() => resolve({ status: 'success', txHash: event.txHash }));
                        }
                    },
                    error: (err) => {
                        this.logger.error('Deposit Failed', err);
                        this.refundUser(txRecord.userId, txRecord.amount)
                            .then(() => reject(err));
                    }
                });
            });

        } catch (error) {
            await this.refundUser(txRecord.userId, txRecord.amount);
            throw error;
        }
    }
    private async refundUser(userId: number, amount: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            const newBal = (BigInt(user.balance) + BigInt(amount)).toString();
            await this.prisma.user.update({
                where: { id: userId },
                data: { balance: newBal }
            });
        }
    }
}
