import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import { DeployResponse, ExtrinsicResponse, QueryResponse } from './types';

@Injectable()
export class ProjectsService {
  private paymentIds: Map<string, string> = new Map();

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
    const completeResult = await this.callPreSignedWriteMethod(contractAddress, 'mark_completed', { ratings: body.ratings });
    
    try {
      console.log({paymentIds: this.paymentIds});
      const paymentId = this.paymentIds.get(contractAddress);

      if (paymentId) {
        await this.releaseAdvancePayment(paymentId);
        this.paymentIds.delete(contractAddress);
        console.log(`Advance payment released automatically after project completion, paymentId: ${paymentId}`);
      } else {
        console.warn(`No payment ID found for contract ${contractAddress}, skipping advance payment release`);
      }
    } catch (error) {
      console.error('Error releasing advance payment after completion:', error);
    }
    
    return completeResult;
  }

  private async createAdvancePayment(contractAddress: string, workerAccountId: string): Promise<{ success: boolean; paymentId?: string }> {
    try {
      const scopeInfo = await this.getScopeInfo(contractAddress);
      if (!scopeInfo.success || !scopeInfo.response || !Array.isArray(scopeInfo.response)) {
        throw new Error('Scope info not available or invalid format');
      }

      if (scopeInfo.response.length < 4) {
        throw new Error('Scope info response incomplete');
      }

      const totalCost = scopeInfo.response[3];
      const advancePercentage = scopeInfo.response[1];

      const advanceAmount = (BigInt(totalCost) * BigInt(advancePercentage)) / BigInt(100);
      
      const federateServer = this.configService.getFederateServer();
      const paymentsUrl = `${federateServer.replace('/api', '')}/api/payments/create`;

      console.log(`Creating advance payment of ${advanceAmount} for worker ${workerAccountId}`);

      const createResponse = await fetch(paymentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientAddress: workerAccountId,
          amount: advanceAmount.toString(),
          assetId: 1,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Payment service error: ${createResponse.status} ${createResponse.statusText}`);
      }

      const createResult = await createResponse.json() as { success: boolean; paymentId?: string | bigint };
      console.log('Advance payment created:', createResult);

      return {
        success: createResult.success,
        paymentId: createResult.paymentId ? String(createResult.paymentId) : undefined,
      };
    } catch (error) {
      console.error('Error creating advance payment:', error);
      throw new HttpException(
        `Error creating advance payment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async releaseAdvancePayment(paymentId: string): Promise<{ success: boolean; txHash?: string }> {
    try {
      const federateServer = this.configService.getFederateServer();
      const paymentsUrl = `${federateServer.replace('/api', '')}/api/payments/release`;

      console.log(`Releasing advance payment with ID: ${paymentId}`);

      const releaseResponse = await fetch(paymentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: `${paymentId}`,
        }),
      });

      if (!releaseResponse.ok) {
        throw new Error(`Payment service error: ${releaseResponse.status} ${releaseResponse.statusText}`);
      }

      const releaseResult = await releaseResponse.json() as { success: boolean; txHash?: string };
      console.log('Advance payment released:', releaseResult);

      return releaseResult;
    } catch (error) {
      console.error('Error releasing advance payment:', error);
      throw new HttpException(
        `Error releasing advance payment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    const approveResult = await this.callPreSignedWriteMethod(contractAddress, 'approve_scope', { approved_task_ids: body.approved_task_ids });
    
    try {
      const teamInfo = await this.getTeam(contractAddress);
      if (teamInfo.success && teamInfo.response && Array.isArray(teamInfo.response) && teamInfo.response.length > 0) {
        const firstTeamMember = teamInfo.response[0];
        const workerAccountId = firstTeamMember.account_id;
        
        const paymentResult = await this.createAdvancePayment(contractAddress, workerAccountId);
        if (paymentResult.paymentId) {
          this.paymentIds.set(contractAddress, paymentResult.paymentId);
          console.log(`Advance payment created automatically after scope approval for worker ${workerAccountId}, paymentId: ${paymentResult.paymentId}`);
        }
      } else {
        console.warn('Team info not available or empty, skipping advance payment creation');
      }
    } catch (error) {
      console.error('Error creating advance payment after scope approval:', error);
    }
    
    return approveResult;
  }

  async completeTask(contractAddress: string, body: { task_id: number }, authToken: string): Promise<any> {
    return this.callPreSignedWriteMethod(contractAddress, 'complete_task', { task_id: body.task_id });
  }

  async getProjectInfo(contractAddress: string): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_project_info');
  }

  async getTeam(contractAddress: string): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_team');
  }

  async getScopeInfo(contractAddress: string): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_scope_info');
  }

  async getTask(contractAddress: string, taskId: number): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_task', { task_id: taskId });
  }

  async getTaskCompletionStatus(contractAddress: string, taskId: number): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_task_completion_status', { task_id: taskId });
  }

  async getAllTasks(contractAddress: string): Promise<QueryResponse> {
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
  ): Promise<QueryResponse> {
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

      const result = await response.json() as QueryResponse;

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
