import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import { DeployResponse, ExtrinsicResponse, QueryResponse, CreateMilestoneRequest, UpdateMilestoneRequest, CreateProposalRequest, UpdateProposalRequest, ScopeRejectRequest, CoordinatorApprovalRequest } from './types';
import { Project, ProjectDocument } from '../../database/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../../database/schemas/milestone.schema';

@Injectable()
export class ProjectsService {
  private paymentIds: Map<string, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
  ) {}

  async assignCoordinator(contractAddress: string, authToken: string): Promise<any> {
    const result = await this.callPreSignedWriteMethod(contractAddress, 'assign_coordinator', {});
    
    if (result && result.success && result.coordinator) {
      const project = await this.projectModel.findOne({ contractAddress }).exec();
      
      if (project) {
        project.consultantId = result.coordinator;
        project.updatedAt = Date.now();
        await project.save();
        console.log(`Coordinator ${result.coordinator} assigned to project ${contractAddress}`);
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

  async setCalendarContract(contractAddress: string, body: { calendar_contract: string }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'set_calendar_contract', { calendar_contract: body.calendar_contract }, authToken);
  }

  private async proposeScope(contractAddress: string, body: { 
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

  async rejectScope(contractAddress: string, body: ScopeRejectRequest, authToken: string): Promise<any> {
    const project = await this.projectModel.findOne({ contractAddress }).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with contract address ${contractAddress} not found`);
    }
    
    if (body.clientResponse) {
      project.proposalRejectionReason = body.clientResponse;
      project.updatedAt = Date.now();
      await project.save();
    }
    
    return { success: true };
  }

  async coordinatorRejectProject(contractAddress: string, rejectionReason: string): Promise<any> {
    const project = await this.projectModel.findOne({ contractAddress }).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with contract address ${contractAddress} not found`);
    }

    project.coordinatorApprovalStatus = 'rejected';
    project.coordinatorRejectionReason = rejectionReason || 'No reason provided';
    project.state = 'rejected_by_coordinator';
    project.updatedAt = Date.now();
    await project.save();

    return { success: true, status: 'rejected' };
  }

  async coordinatorApproveProject(
    contractAddress: string, 
    approvalData: CoordinatorApprovalRequest,
    authToken: string
  ): Promise<any> {
    const project = await this.projectModel.findOne({ contractAddress }).exec();
    
    if (!project) {
      throw new NotFoundException(`Project with contract address ${contractAddress} not found`);
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

  async completeTask(contractAddress: string, body: { task_id: number }, authToken: string): Promise<any> {
    return this.callPreSignedWriteMethod(contractAddress, 'complete_task', { task_id: body.task_id });
  }

  async getProjectInfo(contractAddress: string): Promise<Project> {
    const project = await this.projectModel.findOne({ contractAddress }).exec();
    if (!project) {
      throw new NotFoundException(`Project with contract address ${contractAddress} not found`);
    }
    return project;
  }

  async getTeam(contractAddress: string): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_team');
  }

  async getScopeInfo(contractAddress: string): Promise<QueryResponse> {
    return this.callReadMethod(contractAddress, 'get_scope_info');
  }

  async getTask(contractAddress: string, taskId: number): Promise<QueryResponse & { milestone?: Milestone }> {
    const taskResponse = await this.callReadMethod(contractAddress, 'get_task', { task_id: taskId });
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: taskId }).exec();
    return {
      ...taskResponse,
      milestone: milestone ? milestone.toObject() : undefined,
    };
  }

  async getTaskCompletionStatus(contractAddress: string, taskId: number): Promise<QueryResponse & { milestoneState?: string }> {
    const taskStatusResponse = await this.callReadMethod(contractAddress, 'get_task_completion_status', { task_id: taskId });
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: taskId }).exec();
    return {
      ...taskStatusResponse,
      milestoneState: milestone ? milestone.state : undefined,
    };
  }

  async getAllTasks(contractAddress: string): Promise<QueryResponse & { milestones: Milestone[] }> {
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
    clientId: string,
    authToken: string
  ): Promise<DeployResponse> {
    try {
      const daoAddress = this.configService.getDaoAddress();
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      const deployerUrl = `${signingServiceUrl}/projects/deploy/${version}`;
      const address = await this.authService.getAddress(authToken!);
      
      // Use provided contracts or fallback to defaults
      const defaultRatingsContract = process.env.DEFAULT_RATINGS_CONTRACT || 'JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY';
      const defaultCalendarContract = process.env.DEFAULT_CALENDAR_CONTRACT || 'Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr';
      
      const calendarContract = proposalData.calendarContract || defaultCalendarContract;
      const ratingsContract = proposalData.ratingsContract || defaultRatingsContract;
      
      const deployBody: any = {
        name: proposalData.title,
        dao_address: daoAddress,
        calendar_contract: calendarContract,
        ratings_contract: ratingsContract,
      };

      console.log({deployerUrl, deployBody});
      
      const deployerResponse = await fetch(deployerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...deployBody, address})
      });

      console.log(deployerResponse);

      if (!deployerResponse.ok) {
        throw new Error(`Deployer service error: ${deployerResponse.status} ${deployerResponse.statusText}`);
      }

      const deployerResult = await deployerResponse.json() as DeployResponse;
      console.log('Deployer result:', deployerResult);

      if (deployerResult.address) {
        await this.saveProject(deployerResult.address, {
          title: proposalData.title,
          summary: proposalData.summary,
          description: proposalData.description,
          url: proposalData.url,
          projectType: proposalData.projectType,
          budget: proposalData.budget,
          deliveryTime: proposalData.deliveryTime,
          deliveryDate: new Date(proposalData.deliveryDate).getTime(),
          clientId: clientId,
          calendarContract: calendarContract,
          state: 'deployed',
        });

        // Automatically assign coordinator after deployment
        try {
          console.log('Automatically assigning coordinator to project...');
          await this.assignCoordinator(deployerResult.address, authToken);
          console.log('Coordinator assigned successfully');
        } catch (error) {
          console.error('Error assigning coordinator:', error);
          throw new HttpException(
            `Error assigning coordinator: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
          // Don't fail the deployment if coordinator assignment fails
        }
      }

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

  async saveProject(contractAddress: string, projectData: Partial<Project>): Promise<Project> {
    const existingProject = await this.projectModel.findOne({ contractAddress }).exec();
    if (existingProject) {
      Object.assign(existingProject, projectData);
      return existingProject.save();
    }
    const newProject = new this.projectModel({ contractAddress, ...projectData });
    return newProject.save();
  }

  async updateProject(contractAddress: string, updateData: UpdateProposalRequest): Promise<Project> {
    const project = await this.projectModel.findOne({ contractAddress }).exec();
    if (!project) {
      throw new NotFoundException(`Project with contract address ${contractAddress} not found`);
    }

    if (updateData.title) project.title = updateData.title;
    if (updateData.summary !== undefined) project.summary = updateData.summary;
    if (updateData.description !== undefined) project.description = updateData.description;
    if (updateData.url !== undefined) project.url = updateData.url;
    if (updateData.projectType !== undefined) project.projectType = updateData.projectType;
    if (updateData.budget !== undefined) project.budget = updateData.budget;
    if (updateData.deliveryTime !== undefined) project.deliveryTime = updateData.deliveryTime;
    if (updateData.deliveryDate) project.deliveryDate = new Date(updateData.deliveryDate).getTime();

    project.updatedAt = Date.now();
    return project.save();
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
      deliveryDate: new Date(milestoneData.deliveryDate).getTime(),
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

  async getMilestonesByProject(contractAddress: string): Promise<Milestone[]> {
    return this.milestoneModel.find({ contractAddress }).sort({ displayOrder: 1 }).exec();
  }

  async getMilestoneById(contractAddress: string, milestoneId: number): Promise<Milestone> {
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: milestoneId }).exec();
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for contract ${contractAddress}`);
    }
    return milestone;
  }

  async updateMilestone(contractAddress: string, milestoneId: number, updateData: UpdateMilestoneRequest): Promise<MilestoneDocument> {
    const milestone = await this.milestoneModel.findOne({ contractAddress, id: milestoneId }).exec();
    
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for contract ${contractAddress}`);
    }

    milestone.title = updateData.title;
    if (updateData.description !== undefined) milestone.description = updateData.description;
    milestone.budget = updateData.budget;
    milestone.deliveryTime = updateData.deliveryTime;
    milestone.deliveryDate = new Date(updateData.deliveryDate).getTime();
    if (updateData.role !== undefined) milestone.role = updateData.role;
    if (updateData.proficiency !== undefined) milestone.proficiency = updateData.proficiency;
    if (updateData.skills !== undefined) milestone.skills = updateData.skills;
    
    milestone.neededFullTimeDeveloper = updateData.availability === 'fulltime';
    milestone.neededPartTimeDeveloper = updateData.availability === 'parttime';
    milestone.neededHourlyDeveloper = updateData.availability === 'hourly';

    milestone.updatedAt = Date.now();
    return milestone.save();
  }

  async deleteMilestone(contractAddress: string, milestoneId: number): Promise<void> {
    const result = await this.milestoneModel.deleteOne({ contractAddress, id: milestoneId }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for contract ${contractAddress}`);
    }
  }
}
