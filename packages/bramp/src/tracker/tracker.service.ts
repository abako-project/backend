import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PapiService } from '../papi/papi.service';
import { PrismaService } from '../prisma/prisma.service';
import { HexString } from 'polkadot-api';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { Subscription, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';

@Injectable()
export class TrackerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TrackerService.name);
    private subscription: Subscription;
    private isShutdown = false;

    constructor(
        private papi: PapiService,
        private prisma: PrismaService,
    ) { }

    async onModuleInit() {
        this.startTracking();
    }

    onModuleDestroy() {
        this.isShutdown = true;
        if (this.subscription) {
            this.subscription.unsubscribe();
            console.log('[TrackerService] Unsubscribed from block listener.');
        }
    }

    private async startTracking() {
        console.log('[TrackerService] Starting block listener...');

        // Subscribe to finalized blocks using concatMap to process sequentially
        this.subscription = this.papi.client.finalizedBlock$
            .pipe(
                concatMap(async (block) => {
                    if (this.isShutdown) return;
                    const blockNumber = block.number;
                    const hash = block.hash;

                    console.log(`[TrackerService] Processing Block #${blockNumber} (${hash})`);

                    try {
                        const events = await this.papi.api.query.System.Events.getValue({ at: hash as HexString });

                        if (this.isShutdown) return;

                        // Process events for block

                        for (const event of events) {
                            const { event: { type, value } } = event;

                            if (type === 'Assets' && value.type === 'Transferred') {
                                const { asset_id, from, to, amount } = value.value;
                                console.log(`[TrackerService] Checking Asset Transfer: ${JSON.stringify(asset_id)}, To: ${to}, Amount: ${amount}`);

                                // Check for Asset ID 1
                                const idStr = String(asset_id);
                                const idJson = JSON.stringify(asset_id);

                                let matches = idStr === '1';
                                if (!matches && (idJson.includes('"value":1') || idJson.includes('"value":"1"'))) {
                                    matches = true;
                                }

                                if (matches) {
                                    console.log('[TrackerService] Asset ID Matched! Processing deposit...');
                                    await this.handleDeposit(to, amount.toString(), hash, blockNumber.toString());
                                } else {
                                    console.log('[TrackerService] Asset ID did NOT match.');
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing block ${blockNumber}:`, error);
                    }
                })
            )
            .subscribe();
    }

    private async handleDeposit(toAddress: string, amount: string, blockHash: string, blockNumber: string) {
        if (this.isShutdown) return;

        let normalizedAddress = toAddress;
        try {
            const publicKey = decodeAddress(toAddress);
            normalizedAddress = encodeAddress(publicKey, 42);
        } catch (e) {
            console.warn(`[TrackerService] Failed to normalize address: ${toAddress}`, e);
        }

        console.log(`[TrackerService] Finding deposit address for: ${toAddress} (Normalized: ${normalizedAddress})`);

        const depositAddress = await this.prisma.depositAddress.findUnique({
            where: { address: normalizedAddress },
            include: { user: true }
        });

        if (depositAddress) {
            console.log(`[TrackerService] Detected Deposit! User: ${depositAddress.userId}, Amount: ${amount}`);

            const userId = depositAddress.userId;

            await (this.prisma as any).$transaction(async (tx: any) => {
                const pendingTx = await tx.transaction.findFirst({
                    where: {
                        userId,
                        type: 'WITHDRAWAL',
                        status: 'PENDING',
                        amount: amount
                    }
                });

                if (pendingTx) {
                    console.log(`[TrackerService] Matched Pending Withdraw Request #${pendingTx.id}`);

                    await tx.transaction.update({
                        where: { id: pendingTx.id },
                        data: {
                            status: 'CONFIRMED',
                            txHash: `${blockHash}_${Date.now()}`,
                        }
                    });

                    const currentBalance = BigInt(depositAddress.user.balance);
                    const depositAmount = BigInt(amount);
                    const newBalance = (currentBalance + depositAmount).toString();

                    await tx.user.update({
                        where: { id: userId },
                        data: { balance: newBalance }
                    });

                    console.log(`User ${userId} credited with ${amount} (Request Fulfilled)`);
                } else {
                    console.warn(`[TrackerService] No Pending Withdraw Request found for User ${userId} with Amount ${amount}. Ignoring deposit.`);
                }
            });

        } else {
            console.log(`[TrackerService] No deposit address found for ${normalizedAddress}`);
        }
    }
}
