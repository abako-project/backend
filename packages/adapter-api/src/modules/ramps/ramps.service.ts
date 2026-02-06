import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
    BrampUser,
    CreateUserRequest,
    CreateUserResponse,
    DepositRequest,
    DepositResponse,
    ConfirmDepositResponse,
    WithdrawalRequest,
    WithdrawalResponse,
} from './types';

@Injectable()
export class RampService {
    private readonly logger = new Logger(RampService.name);
    private readonly brampServiceUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.brampServiceUrl = this.configService.getBrampServiceUrl();
        this.logger.log(`Bramp service URL: ${this.brampServiceUrl}`);
    }

    /**
     * Create a new user in the bramp service
     */
    async createUser(email: string): Promise<CreateUserResponse> {
        try {
            const url = `${this.brampServiceUrl}/users`;
            const body: CreateUserRequest = { email };

            this.logger.log(`Creating bramp user for email: ${email}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Bramp service error: ${response.status} ${response.statusText} - ${errorText}`,
                );
            }

            const result = await response.json() as CreateUserResponse;
            this.logger.log(`Bramp user created: ID ${result.id}, Email: ${result.email}`);

            return result;
        } catch (error) {
            this.logger.error(`Error creating bramp user for ${email}:`, error);
            throw error;
        }
    }

    /**
     * Get user by email from bramp service
     */
    async getUserByEmail(email: string): Promise<BrampUser | null> {
        try {
            const url = `${this.brampServiceUrl}/users`;

            this.logger.log(`Getting bramp user by email: ${email}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    this.logger.warn(`Bramp user not found for email: ${email}`);
                    return null;
                }
                const errorText = await response.text();
                throw new Error(
                    `Bramp service error: ${response.status} ${response.statusText} - ${errorText}`,
                );
            }

            const users = await response.json() as BrampUser[];
            const user = users.find(u => u.email === email);

            if (!user) {
                this.logger.warn(`Bramp user not found for email: ${email}`);
                return null;
            }

            this.logger.log(`Found bramp user: ID ${user.id}, Email: ${user.email}`);
            return user;
        } catch (error) {
            this.logger.error(`Error getting bramp user by email ${email}:`, error);
            throw error;
        }
    }

    /**
     * Request a deposit (on-ramp: fiat -> crypto)
     */
    async requestDeposit(
        userId: number,
        amount: string,
        toAddress: string,
    ): Promise<DepositResponse> {
        try {
            const url = `${this.brampServiceUrl}/deposit`;
            const body: DepositRequest = {
                userId,
                amount,
                toAddress,
            };

            this.logger.log(
                `Requesting deposit for user ${userId}: amount ${amount} to ${toAddress}`,
            );

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Bramp service error: ${response.status} ${response.statusText} - ${errorText}`,
                );
            }

            const result = await response.json() as DepositResponse;
            this.logger.log(`Deposit requested: ID ${result.depositId}`);

            return result;
        } catch (error) {
            this.logger.error(`Error requesting deposit for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Confirm a deposit (triggers blockchain transfer)
     */
    async confirmDeposit(
        depositId: number,
        toAddress: string,
    ): Promise<ConfirmDepositResponse> {
        try {
            const url = `${this.brampServiceUrl}/deposit/${depositId}/confirm`;
            const body = { toAddress };

            this.logger.log(
                `Confirming deposit ${depositId} to address ${toAddress}`,
            );

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Bramp service error: ${response.status} ${response.statusText} - ${errorText}`,
                );
            }

            const result = await response.json() as ConfirmDepositResponse;
            this.logger.log(
                `Deposit confirmed: ID ${depositId}, txHash: ${result.txHash}`,
            );

            return result;
        } catch (error) {
            this.logger.error(`Error confirming deposit ${depositId}:`, error);
            throw error;
        }
    }

    /**
     * Create a withdrawal request (off-ramp: crypto -> fiat)
     */
    async createWithdrawal(
        userId: number,
        amount: string,
    ): Promise<WithdrawalResponse> {
        try {
            const url = `${this.brampServiceUrl}/withdrawal`;
            const body: WithdrawalRequest = {
                userId,
                amount,
            };

            this.logger.log(
                `Creating withdrawal for user ${userId}: amount ${amount}`,
            );

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Bramp service error: ${response.status} ${response.statusText} - ${errorText}`,
                );
            }

            const result = await response.json() as WithdrawalResponse;
            this.logger.log(`Withdrawal created: ID ${result.withdrawalId}`);

            return result;
        } catch (error) {
            this.logger.error(`Error creating withdrawal for user ${userId}:`, error);
            throw error;
        }
    }
}
