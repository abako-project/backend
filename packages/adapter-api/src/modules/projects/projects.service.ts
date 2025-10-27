import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import { DeployResponse, ExtrinsicResponse, QueryResponse } from './types';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async assignCoordinator(contractAddress: string, authToken: string): Promise<ExtrinsicResponse> {
    return this.callPreSignedWriteMethod(contractAddress, 'assign_coordinator', {});
  }

  async assignTeam(contractAddress: string, body: { _team_size: number }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'assign_team', { _team_size: body._team_size }, authToken);
  }

  async markCompleted(contractAddress: string, body: { ratings: Array<[string, number]> }, authToken: string): Promise<any> {
    return this.callPreSignedWriteMethod(contractAddress, 'mark_completed', { ratings: body.ratings });
  }

  async setCalendarContract(contractAddress: string, body: { calendar_contract: string }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'set_calendar_contract', { calendar_contract: body.calendar_contract }, authToken);
  }

  async proposeScope(contractAddress: string, body: { 
    tasks: Array<[number, any, string, number[]]>;
    advance_payment_percentage: number;
    document_hash: string;
  }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'propose_scope', body, authToken);
  }

  async approveScope(contractAddress: string, body: { approved_task_ids: number[] }, authToken: string): Promise<any> {
    return this.callPreSignedWriteMethod(contractAddress, 'approve_scope', { approved_task_ids: body.approved_task_ids });
  }

  async completeTask(contractAddress: string, body: { task_id: number }, authToken: string): Promise<any> {
    return this.callPreSignedWriteMethod(contractAddress, 'complete_task', { task_id: body.task_id });
  }

  async getProjectInfo(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_project_info');
  }

  async getTeam(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_team');
  }

  async getScopeInfo(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_scope_info');
  }

  async getTask(contractAddress: string, taskId: number): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_task', { task_id: taskId });
  }

  async getTaskCompletionStatus(contractAddress: string, taskId: number): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_task_completion_status', { task_id: taskId });
  }

  async getAllTasks(contractAddress: string): Promise<ExtrinsicResponse> {
    return this.callReadMethod(contractAddress, 'get_all_tasks');
  }

  async deployContract(
    version: string, 
    body: { 
      name: string;
      dao_address: string;
      calendar_contract?: string;
    },
    authToken: string
  ): Promise<DeployResponse> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const deployerUrl = `${signingServiceUrl}/projects/deploy/${version}`;
      const address = await this.authService.getAddress(authToken!);

      console.log(deployerUrl);

      const deployerResponse = await fetch(deployerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...body, address})
      });

      console.log(deployerResponse);
      if (!deployerResponse.ok) {
        throw new Error(`Deployer service error: ${deployerResponse.status} ${deployerResponse.statusText}`);
      }

      const deployerResult = await deployerResponse.json() as DeployResponse;
      console.log('Deployer result:', deployerResult);

      return deployerResult;
    } catch (error) {
      console.error('Error in deploy contract:', error);
      throw new HttpException(
        `Error calling deploy service: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async callWriteMethod(
    contractAddress: string, 
    method: string, 
    data: any,
    authToken: string
  ): Promise<any> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const craftUrl = `${signingServiceUrl}/projects/call/${contractAddress}/${method}`;
      const address = await this.authService.getAddress(authToken!);
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

      const craftResult = await craftResponse.json() as ExtrinsicResponse;
      console.log('Crafted extrinsic:', craftResult);

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
        `Error calling write method ${method}: ${error.message}`,
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
      const craftUrl = `${signingServiceUrl}/projects/call/${contractAddress}/${method}`;
      const requestBody = { data };

      const craftResponse = await fetch(craftUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log({craftResponse})

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
      let url = `${signingServiceUrl}/projects/query/${contractAddress}/${method}`;
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

       console.log({result});
    
      return result;
    } catch (error) {
      throw new HttpException(
        `Error calling read method ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
