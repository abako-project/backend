import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import { DevelopersService } from '../developers/developers.service';
import { ClientsService } from '../clients/clients.service';
import { DeployResponse, ExtrinsicResponse, QueryResponse, CreateMilestoneRequest, UpdateMilestoneRequest, CreateProposalRequest, UpdateProposalRequest, ScopeRejectRequest, CoordinatorApprovalRequest } from './types';
import { Project, ProjectDocument } from '../../database/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../../database/schemas/milestone.schema';

@Injectable()
export class ProjectsService {
  private paymentIds: Map<string, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly developersService: DevelopersService,
    private readonly clientsService: ClientsService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
  ) {}

  /**
   * Helper method to get contract address from project ID
   * Validates that the project exists and has a contract address
   */
  private async getContractAddressFromProjectId(projectId: string): Promise<string> {
    const project = await this.projectModel.findById(projectId).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.contractAddress) {
      if (project.creationStatus === 'creating') {
        throw new HttpException(
          `Project is still being created. Current status: ${project.creationStatus}`,
          HttpStatus.BAD_REQUEST
        );
      } else if (project.creationStatus === 'failed') {
        throw new HttpException(
          `Project creation failed: ${project.creationError || 'Unknown error'}`,
          HttpStatus.BAD_REQUEST
        );
      } else {
        throw new HttpException(
          `Project does not have a contract address yet. Current status: ${project.creationStatus || 'unknown'}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return project.contractAddress;
  }

  private async getUserIdFromAddress(
    address: string,
    findByEmailFn: (email: string) => Promise<{ id?: number } | null>,
    entityType: string
  ): Promise<number | null> {
    try {
      const federateServerUrl = this.configService.getFederateServer();
      const url = `${federateServerUrl}/get-user-id-by-address?address=${encodeURIComponent(address)}`;
      
      const response = await fetch(url, { method: "GET" });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Could not find user for ${entityType} address: ${address}`);
          return null;
        }
        throw new Error(`Failed to get user ID: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json() as { userId?: string };
      
      const { userId } = responseData;
      
      if (!userId) {
        console.warn(`No userId returned for ${entityType} address: ${address}`);
        return null;
      }

      // Find entity by email (userId is the email)
      const entity = await findByEmailFn(userId);
      
      if (!entity) {
        console.warn(`Could not find ${entityType} for user email: ${userId}`);
        return null;
      }

      return entity.id!;
    } catch (error) {
      console.error(`Error getting ${entityType} ID from address ${address}:`, error);
      return null;
    }
  }

  async assignCoordinator(projectId: string, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const result = await this.callPreSignedWriteMethod(contractAddress, 'assign_coordinator', {});
    
    if (result && result.success && result.coordinator) {
      const project = await this.projectModel.findById(projectId).exec();
      
      if (project) {
        const developerId = await this.getUserIdFromAddress(
          result.coordinator,
          (email) => this.developersService.findByEmail(email),
          'developer'
        );
        
        if (developerId) {
          project.consultantId = developerId.toString();
          project.updatedAt = Date.now();
          await project.save();
          console.log(`Coordinator ${result.coordinator} (developer ID: ${developerId}) assigned to project ${projectId} (${contractAddress})`);
        } else {
          console.warn(`Could not find developer ID for coordinator address ${result.coordinator}. Project ${projectId} will not have consultantId set.`);
        }
      }
    } else {
      console.error('Error assigning coordinator:', result);
      throw new HttpException(
        `Error assigning coordinator: ${result.error}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    
    return result;
  }

  async assignTeam(projectId: string, body: { _team_size: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const assignResult = await this.callWriteMethod(contractAddress, 'assign_team', { _team_size: body._team_size }, authToken);
    
    // Create advance payment in background after team is assigned
    this.createAdvancePaymentInBackground(projectId, contractAddress).catch((error) => {
      console.error(`[Background] Error creating advance payment for project ${projectId}:`, error);
    });
    
    return assignResult;
  }

  /**
   * Creates advance payment automatically in background after team is assigned.
   * Waits for team assignment to complete before creating the payment.
   */
  private async createAdvancePaymentInBackground(projectId: string, contractAddress: string): Promise<void> {
    try {
      console.log(`[Background] Waiting for team assignment to complete before creating advance payment for project ${projectId}...`);
      
      // Wait for team to be assigned with polling mechanism
      let teamAssigned = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait time
      
      while (attempts < maxAttempts && !teamAssigned) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        try {
          const teamInfo = await this.getTeam(projectId);
          if (teamInfo.success && teamInfo.response && Array.isArray(teamInfo.response) && teamInfo.response.length > 0) {
            teamAssigned = true;
            console.log(`[Background] Team assigned, proceeding with advance payment creation for project ${projectId}`);
            
            const firstTeamMember = teamInfo.response[0];
            const workerAccountId = firstTeamMember.account_id;
            
            const paymentResult = await this.createAdvancePayment(projectId, workerAccountId);
            if (paymentResult.paymentId) {
              this.paymentIds.set(contractAddress, paymentResult.paymentId);
              console.log(`[Background] Advance payment created automatically after scope approval for worker ${workerAccountId}, paymentId: ${paymentResult.paymentId}`);
            } else {
              console.warn(`[Background] Advance payment creation did not return paymentId for project ${projectId}`);
            }
            return;
          }
        } catch (error) {
          // Team might not be assigned yet, continue polling
          console.log(`[Background] Team not yet assigned (attempt ${attempts + 1}/${maxAttempts}), waiting...`);
        }
        
        attempts++;
      }
      
      if (!teamAssigned) {
        console.warn(`[Background] Team assignment timed out after ${maxAttempts} seconds for project ${projectId}, skipping advance payment creation`);
      }
    } catch (error) {
      console.error(`[Background] Error creating advance payment for project ${projectId}:`, error);
      // Don't throw - this is a background operation
    }
  }

  async markCompleted(projectId: string, body: { ratings: Array<[string, number]> }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const completeResult = await this.callPreSignedWriteMethod(contractAddress, 'mark_completed', { ratings: body.ratings });
    
    // Set deliveryDate automatically when project is marked as completed
    try {
      const project = await this.projectModel.findById(projectId).exec();
      if (project) {
        project.deliveryDate = Date.now();
        await project.save();
        console.log(`Delivery date set automatically for project ${projectId}: ${project.deliveryDate}`);
      } else {
        console.warn(`Project ${projectId} not found when trying to set delivery date`);
      }
    } catch (error) {
      console.error(`Error setting delivery date for project ${projectId}:`, error);
    }
    
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

  private async createAdvancePayment(projectId: string, workerAccountId: string): Promise<{ success: boolean; paymentId?: string }> {
    try {
      const contractAddress = await this.getContractAddressFromProjectId(projectId);
      const scopeInfo = await this.getScopeInfo(projectId);
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

      console.log(`Creating advance payment of ${advanceAmount} for worker ${workerAccountId} (project ${projectId})`);

      const createResponse = await fetch(paymentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientAddress: workerAccountId,
          amount: advanceAmount.toString(),
          assetId: 1,
          remark: contractAddress,
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

  async setCalendarContract(projectId: string, body: { calendar_contract: string }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.callWriteMethod(contractAddress, 'set_calendar_contract', { calendar_contract: body.calendar_contract }, authToken);
  }

  private async proposeScope(contractAddress: string, body: { 
    tasks: Array<[number, any, string, number[]]>;
    advance_payment_percentage: number;
    document_hash: string;
  }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'propose_scope', body, authToken);
  }

  async approveScope(projectId: string, body: { approved_task_ids: number[] }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const approveResult = await this.callPreSignedWriteMethod(contractAddress, 'approve_scope', { approved_task_ids: body.approved_task_ids });
    
    return approveResult;
  }

  async rejectScope(projectId: string, body: ScopeRejectRequest, authToken: string): Promise<any> {
    const project = await this.projectModel.findById(projectId).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    
    if (body.clientResponse) {
      project.proposalRejectionReason = body.clientResponse;
      project.updatedAt = Date.now();
      await project.save();
    }
    
    return { success: true };
  }

  async coordinatorRejectProject(projectId: string, rejectionReason: string): Promise<any> {
    const project = await this.projectModel.findById(projectId).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    project.coordinatorApprovalStatus = 'rejected';
    project.coordinatorRejectionReason = rejectionReason || 'No reason provided';
    project.state = 'rejected_by_coordinator';
    project.updatedAt = Date.now();
    await project.save();

    return { success: true, status: 'rejected' };
  }

  async coordinatorApproveProject(
    projectId: string, 
    approvalData: CoordinatorApprovalRequest,
    authToken: string
  ): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const project = await this.projectModel.findById(projectId).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    try {
      console.log('Creating milestones in MongoDB...');
      const createdMilestones: Milestone[] = [];
      
      // Create all milestones in MongoDB
      for (const milestoneData of approvalData.milestones) {
        const milestone = await this.createMilestone(contractAddress, milestoneData);
        createdMilestones.push(milestone);
        console.log(`Milestone created: ${milestone.id} - ${milestone.title}`);
      }

      // Convert milestones to tasks for the contract
      const tasks: Array<[number, any, string, number[]]> = createdMilestones.map(milestone => [
        milestone.id!, // task id from milestone id
        { type: 'Days', value: milestone.deliveryTime }, // complexity
        milestone.budget.toString(), // cost as string
        [] // no dependencies for now
      ]);

      console.log('Proposing scope to contract with tasks:', tasks);
      
      // Propose scope to the contract
      const proposeResult = await this.proposeScope(contractAddress, {
        tasks,
        advance_payment_percentage: approvalData.advance_payment_percentage,
        document_hash: approvalData.document_hash,
      }, authToken);

      console.log('Scope proposed successfully');

      // Update project status to approved
      project.coordinatorApprovalStatus = 'approved';
      project.state = 'scope_proposed';
      project.updatedAt = Date.now();
      await project.save();

      return { 
        success: true, 
        status: 'approved',
        milestones: createdMilestones,
        proposeResult 
      };
    } catch (error) {
      console.error('Error during coordinator approval:', error);
      throw new HttpException(
        `Error during coordinator approval: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async submitTaskForReview(projectId: string, body: { task_id: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.callWriteMethod(contractAddress, 'submit_task_for_review', { task_id: body.task_id }, authToken);
  }

  async completeTask(projectId: string, body: { task_id: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const completeResult = await this.callPreSignedWriteMethod(contractAddress, 'complete_task', { task_id: body.task_id });
    
    // Update milestone state in MongoDB to 'completed'
    try {
      const milestone = await this.milestoneModel.findOne({ contractAddress, id: body.task_id }).exec();
      if (milestone) {
        milestone.state = 'completed';
        milestone.updatedAt = Date.now();
        await milestone.save();
        console.log(`Milestone ${body.task_id} marked as completed for project ${projectId}`);
      } else {
        console.warn(`Milestone ${body.task_id} not found in MongoDB for project ${projectId}, contract address ${contractAddress}`);
      }
    } catch (error) {
      console.error(`Error updating milestone state for task ${body.task_id} in project ${projectId}:`, error);
      // Don't throw - the contract call succeeded, MongoDB update is secondary
    }
    
    return completeResult;
  }

  async rejectMilestone(projectId: string, milestoneId: number, body: { rejectionReason?: string }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: milestoneId }).exec();
    
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }

    // Update milestone in MongoDB with rejection information
    milestone.state = 'rejected';
    milestone.rejectionReason = body.rejectionReason || 'No reason provided';
    milestone.updatedAt = Date.now();
    await milestone.save();

    return { success: true, status: 'rejected', milestone: milestone.toObject() };
  }

  async getProjectInfo(projectId: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return project;
  }


  async getTeam(projectId: string): Promise<QueryResponse> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);

    const teamResponse = await this.callReadMethod(contractAddress, 'get_team');
    
    if (teamResponse.success && Array.isArray(teamResponse.response)) {
      // Get all milestones for this project and group by developerId
      const milestones = await this.milestoneModel.find({ contractAddress }).exec();
      const milestonesByDeveloperId = new Map<number, number[]>();
      
      milestones.forEach(milestone => {
        if (milestone.developerId !== undefined && milestone.developerId !== null) {
          const existing = milestonesByDeveloperId.get(milestone.developerId) || [];
          existing.push(milestone.id!);
          milestonesByDeveloperId.set(milestone.developerId, existing);
        }
      });
      
      const enrichedTeam = await Promise.all(
        teamResponse.response.map(async (member: any) => {
          const developerId = await this.getDeveloperIdFromAddress(member.account_id);
          const milestoneIds = developerId ? (milestonesByDeveloperId.get(developerId) || []) : [];
          
          return {
            ...member,
            developerId: developerId || null,
          };
        })
      );
      
      return {
        ...teamResponse,
        response: enrichedTeam,
      };
    }
    
    return teamResponse;
  }

  private async getDeveloperIdFromAddress(address: string): Promise<number | null> {
    return this.getUserIdFromAddress(
      address,
      (email: string) => this.developersService.findByEmail(email),
      'developer'
    );
  }

  async getScopeInfo(projectId: string): Promise<QueryResponse> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.callReadMethod(contractAddress, 'get_scope_info');
  }

  async getTask(projectId: string, taskId: number): Promise<QueryResponse & { milestone?: Milestone }> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const taskResponse = await this.callReadMethod(contractAddress, 'get_task', { task_id: taskId });
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: taskId }).exec();
    return {
      ...taskResponse,
      milestone: milestone ? milestone.toObject() : undefined,
    };
  }

  async getTaskCompletionStatus(projectId: string, taskId: number): Promise<QueryResponse & { milestoneState?: string }> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const taskStatusResponse = await this.callReadMethod(contractAddress, 'get_task_completion_status', { task_id: taskId });
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: taskId }).exec();
    return {
      ...taskStatusResponse,
      milestoneState: milestone ? milestone.state : undefined,
    };
  }

  async getAllTasks(projectId: string): Promise<QueryResponse & { milestones: Milestone[] }> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const tasksResponse = await this.callReadMethod(contractAddress, 'get_all_tasks');
    const milestones = await this.milestoneModel.find({ contractAddress }).sort({ displayOrder: 1 }).exec();
    return {
      ...tasksResponse,
      milestones: milestones.map(m => m.toObject()),
    };
  }

  async deployContract(
    version: string,
    proposalData: CreateProposalRequest,
    authToken: string
  ): Promise<{ projectId: string; creationStatus: string; message: string }> {
    try {
      // Use provided contracts or fallback to defaults
      const defaultCalendarContract = process.env.DEFAULT_CALENDAR_CONTRACT || 'Dd34LSU53MLwJpq4wfHmDFwAifJrcaPbd1qTCGZcR7iXQkd';
      
      const calendarContract = proposalData.calendarContract || defaultCalendarContract;

      const userId = await this.authService.getUserIdFromToken(authToken);
      const client = await this.clientsService.findByEmail(userId);
      
      if (!client || !client.id) {
        throw new HttpException(
          `Could not find client ID for user ${userId}. Please ensure the client is registered.`,
          HttpStatus.BAD_REQUEST
        );
      }

      const newProject = new this.projectModel({
        title: proposalData.title,
        summary: proposalData.summary,
        description: proposalData.description,
        url: proposalData.url,
        projectType: proposalData.projectType,
        budget: proposalData.budget,
        deliveryTime: proposalData.deliveryTime,
        clientId: client.id.toString(),
        calendarContract: calendarContract,
        state: 'draft',
        creationStatus: 'creating',
      });
      
      const savedProject = await newProject.save();
      const projectId = savedProject._id.toString();

      this.executeDeploymentInBackground(
        projectId,
        version,
        proposalData,
        authToken,
        calendarContract
      ).catch((error) => {
        console.error(`[Fatal] Background deployment error handler caught error for project ${projectId}:`, error);
        this.projectModel.findByIdAndUpdate(
          projectId,
          {
            creationStatus: 'failed',
            creationError: `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ).exec().catch((updateError) => {
          console.error(`[Fatal] Could not update project ${projectId} status after fatal error:`, updateError);
        });
      });

      return {
        projectId,
        creationStatus: 'creating',
        message: 'Project creation started. Use the project ID to check creation status.'
      };
    } catch (error) {
      console.error('Error initiating deploy contract:', error);
      throw new HttpException(
        `Error initiating project creation: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async executeDeploymentInBackground(
    projectId: string,
    version: string,
    proposalData: CreateProposalRequest,
    authToken: string,
    calendarContract: string
  ): Promise<void> {
    let project = await this.projectModel.findById(projectId).exec();
    
    if (!project) {
      console.error(`[Background] Project ${projectId} not found`);
      return;
    }

    try {
      const daoAddress = this.configService.getDaoAddress();
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const deployerUrl = `${signingServiceUrl}/projects/deploy/${version}`;
      const address = await this.authService.getAddress(authToken!);
      
      const defaultRatingsContract = process.env.DEFAULT_RATINGS_CONTRACT || 'JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY';
      
      const ratingsContract = proposalData.ratingsContract || defaultRatingsContract;
      
      const deployBody: any = {
        name: proposalData.title,
        dao_address: daoAddress,
        calendar_contract: calendarContract,
        ratings_contract: ratingsContract,
      };

      console.log(`[Background] Deploying contract for project ${projectId}`, {deployerUrl, deployBody});
      
      const deployerResponse = await fetch(deployerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...deployBody, address})
      });

      if (!deployerResponse.ok) {
        const errorText = await deployerResponse.text();
        throw new Error(`Deployer service error: ${deployerResponse.status} ${deployerResponse.statusText} - ${errorText}`);
      }

      const deployerResult = await deployerResponse.json() as DeployResponse;
      console.log(`[Background] Deployer result for project ${projectId}:`, deployerResult);

      if (!deployerResult.address) {
        throw new Error('Deployer did not return a contract address');
      }

      // Update project with contract address and success status
      project.contractAddress = deployerResult.address;
      project.state = 'deployed';
      project.creationStatus = 'created';
      project.creationError = undefined;
      await project.save();
      console.log(`[Background] Project ${projectId} successfully created with contract address: ${deployerResult.address}`);

      // Automatically assign coordinator after deployment
      try {
        console.log(`[Background] Automatically assigning coordinator to project ${projectId} (${deployerResult.address})...`);
        await this.assignCoordinator(projectId, authToken);
        console.log(`[Background] Coordinator assigned successfully to project ${projectId} (${deployerResult.address})`);
      } catch (error) {
        console.error(`[Background] Error assigning coordinator to project ${projectId} (${deployerResult.address}):`, error);
        project.creationError = `Deployment successful but coordinator assignment failed: ${error.message}`;
        await project.save();
      }
    } catch (error) {
      console.error(`[Background] Error in deployment for project ${projectId}:`, error);
      
      project = await this.projectModel.findById(projectId).exec();
      if (project) {
        project.creationStatus = 'failed';
        project.creationError = error instanceof Error ? error.message : 'Unknown error during deployment';
        await project.save();
        console.log(`[Background] Project ${projectId} marked as failed: ${project.creationError}`);
      } else {
        console.error(`[Background] Could not update project ${projectId} status - project not found in database`);
      }
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

      const userId = await this.authService.getUserIdFromToken(authToken);

      const federateServerUrl = this.configService.getFederateServer();
      const url = `${federateServerUrl}/get-user-address?userId=${encodeURIComponent(userId)}`;

      const callerResponse = await fetch(url, { method: "GET" });
      if (!callerResponse.ok) {
        throw new HttpException(
          `Failed to fetch caller address from FederateServer: ${callerResponse.status} ${callerResponse.statusText}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const { address: caller } = await callerResponse.json() as { address: string };

      console.log({caller});
      console.log({craftUrl});
      
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

  async saveProject(contractAddress: string, projectData: Partial<Project>): Promise<Project> {
    const existingProject = await this.projectModel.findOne({ contractAddress }).exec();
    if (existingProject) {
      Object.assign(existingProject, projectData);
      return existingProject.save();
    }
    const newProject = new this.projectModel({ contractAddress, ...projectData });
    return newProject.save();
  }

  async updateProject(projectId: string, updateData: UpdateProposalRequest, authToken?: string): Promise<Project> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (updateData.title) project.title = updateData.title;
    if (updateData.summary !== undefined) project.summary = updateData.summary;
    if (updateData.description !== undefined) project.description = updateData.description;
    if (updateData.url !== undefined) project.url = updateData.url;
    if (updateData.projectType !== undefined) project.projectType = updateData.projectType;
    if (updateData.budget !== undefined) project.budget = updateData.budget;
    if (updateData.deliveryTime !== undefined) project.deliveryTime = updateData.deliveryTime;

    project.updatedAt = Date.now();
    const savedProject = await project.save();

    // If project has contractAddress but no consultantId, try to assign coordinator in background
    if (savedProject.contractAddress && !savedProject.consultantId && authToken) {
      this.assignCoordinatorInBackground(projectId, authToken).catch((error) => {
        console.error(`[Background] Error assigning coordinator to project ${projectId} during update:`, error);
      });
    }

    return savedProject;
  }

  private async assignCoordinatorInBackground(projectId: string, authToken: string): Promise<void> {
    try {
      console.log(`[Background] Attempting to assign coordinator to project ${projectId}...`);
      await this.assignCoordinator(projectId, authToken);
      console.log(`[Background] Coordinator assigned successfully to project ${projectId}`);
    } catch (error) {
      console.error(`[Background] Failed to assign coordinator to project ${projectId}:`, error);
    }
  }

  async createMilestone(contractAddress: string, milestoneData: CreateMilestoneRequest): Promise<Milestone> {
    const highestMilestone = await this.milestoneModel
      .findOne({ contractAddress })
      .sort({ displayOrder: -1 })
      .exec();

    const displayOrder = highestMilestone ? highestMilestone.displayOrder + 1 : 0;

    const newMilestone = new this.milestoneModel({
      contractAddress,
      title: milestoneData.title,
      description: milestoneData.description,
      budget: milestoneData.budget,
      deliveryTime: milestoneData.deliveryTime,
      role: milestoneData.role,
      proficiency: milestoneData.proficiency,
      skills: milestoneData.skills || [],
      neededFullTimeDeveloper: milestoneData.availability === 'fulltime',
      neededPartTimeDeveloper: milestoneData.availability === 'parttime',
      neededHourlyDeveloper: milestoneData.availability === 'hourly',
      displayOrder,
      state: 'pending',
    });

    return newMilestone.save();
  }

  async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.milestoneModel.find({ contractAddress }).sort({ displayOrder: 1 }).exec();
  }

  async getMilestoneById(projectId: string, milestoneId: number): Promise<Milestone> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: milestoneId }).exec();
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }
    return milestone;
  }

  async updateMilestone(projectId: string, milestoneId: number, updateData: UpdateMilestoneRequest): Promise<MilestoneDocument> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: milestoneId }).exec();
    
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }

    milestone.title = updateData.title;
    if (updateData.description !== undefined) milestone.description = updateData.description;
    milestone.budget = updateData.budget;
    milestone.deliveryTime = updateData.deliveryTime;
    if (updateData.role !== undefined) milestone.role = updateData.role;
    if (updateData.proficiency !== undefined) milestone.proficiency = updateData.proficiency;
    if (updateData.skills !== undefined) milestone.skills = updateData.skills;
    
    milestone.neededFullTimeDeveloper = updateData.availability === 'fulltime';
    milestone.neededPartTimeDeveloper = updateData.availability === 'parttime';
    milestone.neededHourlyDeveloper = updateData.availability === 'hourly';

    milestone.updatedAt = Date.now();
    return milestone.save();
  }

  async deleteMilestone(projectId: string, milestoneId: number): Promise<void> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const result = await this.milestoneModel.deleteOne({ contractAddress, id: milestoneId }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }
  }
}
