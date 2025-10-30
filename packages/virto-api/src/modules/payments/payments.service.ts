import { Injectable } from '@nestjs/common';
import { createClient, Binary } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { kreivo, MultiAddress } from '@polkadot-api/descriptors';
import { ConfigService } from '../../config/config.service';
import { polkadotSigner } from '../vos-mock/signer';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  ReleasePaymentRequest,
  ReleasePaymentResponse,
  AcceptAndPayRequest,
  AcceptAndPayResponse,
  GetPaymentRequest,
  GetPaymentResponse,
  Payment,
  HealthResponse
} from './types';

@Injectable()
export class PaymentsService {
  constructor(private readonly configService: ConfigService) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const asset = request.assetId !== undefined 
        ? { type: 'Here' as const, value: request.assetId }
        : { type: 'Here' as const, value: 1 };

      const payTx = kreivoApi.tx.Payments.pay({
        beneficiary: MultiAddress.Id(request.recipientAddress),
        asset: asset,
        amount: request.amount,
        remark: request.remark ? Binary.fromText(request.remark) : Binary.fromBytes(new Uint8Array(0)),
      });

      console.log(`Creating payment to ${request.recipientAddress} for amount ${request.amount}`);

      const result = await new Promise((resolve, reject) => {
        payTx.signSubmitAndWatch(polkadotSigner)
          .subscribe({
            next: (event: any) => {
              console.info('Create payment transaction event:', event.type);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found, events: event.events });
              }
            },
            error: (error) => {
              console.error('Create payment transaction error:', error);
              reject(error);
            }
          });
      });

      
      client.destroy();
      
      const resultData = result as { ok: boolean; txHash: string; blockHash?: any; events?: any[] };

      console.log('Result data:', resultData.events);

      const paymentsCreatedEvent = resultData.events?.find((event: any) => event.type === 'Payments')
      let paymentId = paymentsCreatedEvent?.value?.value?.payment_id

      if (paymentId === undefined || paymentId === null) {
        throw new Error('Payment ID not found in events');
      }

      if (!resultData.ok) {
        throw new Error('Failed to create payment');
      }

      console.log(`Payment created successfully. TxHash: ${resultData.txHash}`);

      return {
        success: true,
        txHash: resultData.txHash,
        paymentId: paymentId.toString()
      };
    } catch (error) {
      console.error('Error creating payment on blockchain:', error);
      throw new Error(`Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async releasePayment(request: ReleasePaymentRequest): Promise<ReleasePaymentResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const releaseTx = kreivoApi.tx.Payments.release({
        payment_id: request.paymentId,
      });

      console.log(`Releasing payment with ID: ${request.paymentId}`);

      const result = await new Promise<{ ok: boolean; txHash: string; blockHash?: any }>((resolve, reject) => {
        releaseTx.signSubmitAndWatch(polkadotSigner)
          .subscribe({
            next: (event) => {
              console.info('Release payment transaction event:', event.type);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found });
              }
            },
            error: (error) => {
              console.error('Release payment transaction error:', error);
              reject(error);
            }
          });
      });

      client.destroy();

      if (!result.ok) {
        throw new Error('Failed to release payment');
      }

      console.log(`Payment released successfully. TxHash: ${result.txHash}`);

      return {
        success: true,
        txHash: result.txHash
      };
    } catch (error) {
      console.error('Error releasing payment on blockchain:', error);
      throw new Error(`Failed to release payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptAndPay(request: AcceptAndPayRequest): Promise<AcceptAndPayResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const acceptAndPayTx = kreivoApi.tx.Payments.accept_and_pay({
        payment_id: request.paymentId,
      });

      console.log(`Accepting and paying for payment ID: ${request.paymentId}`);

      const result = await new Promise<{ ok: boolean; txHash: string; blockHash?: any }>((resolve, reject) => {
        acceptAndPayTx.signSubmitAndWatch(polkadotSigner)
          .subscribe({
            next: (event) => {
              console.info('Accept and pay transaction event:', event.type);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found });
              }
            },
            error: (error) => {
              console.error('Accept and pay transaction error:', error);
              reject(error);
            }
          });
      });

      client.destroy();

      if (!result.ok) {
        throw new Error('Failed to accept and pay');
      }

      console.log(`Accept and pay completed successfully. TxHash: ${result.txHash}`);

      return {
        success: true,
        txHash: result.txHash
      };
    } catch (error) {
      console.error('Error in accept and pay on blockchain:', error);
      throw new Error(`Failed to accept and pay: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPayment(request: GetPaymentRequest): Promise<GetPaymentResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const paymentParties = await kreivoApi.query.Payments.PaymentParties.getValue(
        request.paymentId
      );

      if (!paymentParties) {
        client.destroy();
        return {
          payment: null
        };
      }

      const from = paymentParties[0] as string;
      const to = paymentParties[1] as string;

      const payment = await kreivoApi.query.Payments.Payment.getValue(
        from,
        request.paymentId
      );

      client.destroy();

      if (!payment) {
        return {
          payment: null
        };
      }

      const paymentData: Payment = {
        from: from,
        to: to,
        amount: payment.amount as bigint,
        asset: payment.asset,
        state: payment.state.type as string,
        paymentId: request.paymentId,
      };

      console.log(`Payment found: ${JSON.stringify(paymentData)}`);

      return {
        payment: paymentData
      };
    } catch (error) {
      console.error('Error getting payment from blockchain:', error);
      throw new Error(`Failed to get payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'payments'
    };
  }
}

