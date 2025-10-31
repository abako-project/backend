export interface Payment {
  from: string;
  to: string;
  amount: bigint;
  asset: any;
  state: string;
  paymentId: bigint;
}

export interface CreatePaymentRequest {
  recipientAddress: string;
  amount: bigint;
  assetId?: number;
  remark?: string;
}

export interface CreatePaymentResponse {
  success: boolean;
  txHash?: string;
  paymentId?: bigint;
}

export interface ReleasePaymentRequest {
  paymentId: bigint;
}

export interface ReleasePaymentResponse {
  success: boolean;
  txHash?: string;
}

export interface AcceptAndPayRequest {
  paymentId: bigint;
}

export interface AcceptAndPayResponse {
  success: boolean;
  txHash?: string;
}

export interface GetPaymentRequest {
  paymentId: bigint;
}

export interface GetPaymentResponse {
  payment: Payment | null;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

