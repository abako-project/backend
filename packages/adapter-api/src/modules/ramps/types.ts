export interface BrampUser {
    id: number;
    email: string;
    balance: string;
    depositAddress: {
        id: number;
        address: string;
        derivationIndex: number;
        userId: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserRequest {
    email: string;
}

export interface CreateUserResponse {
    id: number;
    email: string;
    balance: string;
    depositAddress: {
        id: number;
        address: string;
        derivationIndex: number;
        userId: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface DepositRequest {
    userId: number;
    amount: string;
    toAddress: string;
}

export interface DepositResponse {
    message: string;
    depositId: number;
    instructions: {
        amount: string;
        bankAccount: string;
        reference: string;
    };
}

export interface ConfirmDepositResponse {
    status: string;
    txHash: string;
}

export interface WithdrawalRequest {
    userId: number;
    amount: string;
}

export interface WithdrawalResponse {
    message: string;
    withdrawalId: number;
    depositAddress: string;
    amount: string;
}
