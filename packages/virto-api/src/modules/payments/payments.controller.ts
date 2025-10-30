import { Controller, Post, Get, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  ReleasePaymentRequest,
  ReleasePaymentResponse,
  AcceptAndPayRequest,
  AcceptAndPayResponse,
  GetPaymentRequest,
  GetPaymentResponse,
  HealthResponse
} from './types';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  async createPayment(@Body() body: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      return await this.paymentsService.createPayment(body);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to create payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('release')
  async releasePayment(@Body() body: ReleasePaymentRequest): Promise<ReleasePaymentResponse> {
    try {
      return await this.paymentsService.releasePayment(body);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to release payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('accept-and-pay')
  async acceptAndPay(@Body() body: AcceptAndPayRequest): Promise<AcceptAndPayResponse> {
    try {
      return await this.paymentsService.acceptAndPay(body);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to accept and pay',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('get')
  async getPayment(
    @Query('paymentId') paymentId: string
  ): Promise<GetPaymentResponse> {
    try {
      if (!paymentId) {
        throw new HttpException('Payment ID is required', HttpStatus.BAD_REQUEST);
      }
      
      const paymentIdBigInt = BigInt(paymentId);
      
      return await this.paymentsService.getPayment({ paymentId: paymentIdBigInt });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  async healthCheck(): Promise<HealthResponse> {
    try {
      return await this.paymentsService.healthCheck();
    } catch (error) {
      throw new HttpException('Service is unhealthy', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

