import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import {
  ExtrinsicResponse,
  SetAvailabilityRequest,
  RegisterWorkerRequest,
  RegisterWorkersRequest,
  AdminSetWorkerAvailabilityRequest,
  DeployResponse
} from './types';

@Injectable()
export class CalendarService {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) { }

  async registerWorker(
    contractAddress: string,
    body: RegisterWorkerRequest,
    authToken: string
  ): Promise<any> {
    return this.callPreSignedWriteMethod(
      contractAddress,
      'register_worker',
      { worker: body.worker }
    );
  }

  async setAvailability(
    contractAddress: string,
    body: SetAvailabilityRequest,
    authToken: string
  ): Promise<any> {
    return this.callWriteMethodWithSigning(
      contractAddress,
      'set_availability',
      { availability: body.availability },
      authToken
    );
  }

  async registerWorkers(
    contractAddress: string,
    body: RegisterWorkersRequest,
    authToken: string
  ): Promise<any> {
    return this.callPreSignedWriteMethod(
      contractAddress,
      'register_workers',
      { workers: body.workers }
    );
  }

  async adminSetWorkerAvailability(
    contractAddress: string,
    body: AdminSetWorkerAvailabilityRequest,
    authToken: string
  ): Promise<any> {
    return this.callPreSignedWriteMethod(
      contractAddress,
      'admin_set_worker_availability',
      { worker: body.worker, availability: body.availability }
    );
  }

  async getAvailabilityHours(
    contractAddress: string,
    worker: string
  ): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_availability_hours', { worker });
  }

  async isAvailable(
    contractAddress: string,
    worker: string,
    minHours?: number
  ): Promise<ExtrinsicResponse> {
    const params: any = { worker };
    if (minHours !== undefined) {
      params.min_hours = minHours;
    }
    return this.callReadMethod(contractAddress, 'is_available', params);
  }

  async getAvailableWorkers(
    contractAddress: string,
    minHours?: number
  ): Promise<ExtrinsicResponse> {
    const params: any = {};
    if (minHours !== undefined) {
      params.min_hours = minHours;
    }
    return this.callReadMethod(contractAddress, 'get_available_workers', params);
  }

  async getRegisteredWorkers(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_registered_workers');
  }

  async getAllWorkersAvailability(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_all_workers_availability');
  }

  private async callWriteMethodWithSigning(
    contractAddress: string,
    method: string,
    data: any,
    authToken: string
  ): Promise<any> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const craftUrl = `${signingServiceUrl}/calendar/call/${contractAddress}/${method}`;
      const requestBody = { data };

      const caller = await this.authService.getAddress(authToken);

      console.log({caller});

      const craftResponse = await fetch(craftUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...requestBody, caller})
      });

      if (!craftResponse.ok) {
        throw new Error(`Craft service error: ${craftResponse.status} ${craftResponse.statusText}`);
      }

      const craftResult = await craftResponse.json() as ExtrinsicResponse;
      console.log('Crafted extrinsic (unsigned):', craftResult);

      if (craftResult.encodedData) {
        const signResult = await this.authService.sign(authToken, {
          extrinsic: craftResult.encodedData
        });

        if (!signResult.success) {
          throw new HttpException(
            `Signing failed: ${signResult.error}`,
            HttpStatus.UNAUTHORIZED
          );
        }

        console.log('Signed result:', signResult);
        return signResult;
      } else {
        throw new HttpException('Crafted extrinsic is missing encoded data', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      throw new HttpException(
        `Error calling write method with signing ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async callPreSignedWriteMethod(
    contractAddress: string,
    method: string,
    data: any
  ): Promise<any> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const craftUrl = `${signingServiceUrl}/calendar/call/${contractAddress}/${method}`;
      const requestBody = { data };

      const craftResponse = await fetch(craftUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!craftResponse.ok) {
        throw new Error(`Craft service error: ${craftResponse.status} ${craftResponse.statusText}`);
      }

      const craftResult = await craftResponse.json();
      console.log('Pre-signed result:', craftResult);

      return craftResult;
    } catch (error) {
      throw new HttpException(
        `Error calling pre-signed write method ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async callReadMethod(
    contractAddress: string,
    method: string,
    params?: Record<string, any>
  ): Promise<ExtrinsicResponse> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      let url = `${signingServiceUrl}/calendar/query/${contractAddress}/${method}`;
      console.log(url);
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
        url += `?${searchParams.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log(response);

      const result = await response.json() as ExtrinsicResponse;

      console.log({ result });

      return result;
    } catch (error) {
      throw new HttpException(
        `Error calling read method ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

