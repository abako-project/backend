import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';
import { DevelopersService } from '../developers/developers.service';
import { ClientsService } from '../clients/clients.service';
import { RatingsService } from '../ratings/ratings.service';
import { EventsService } from '../events/events.service';
import { DeployResponse, ExtrinsicResponse, QueryResponse, CreateMilestoneRequest, UpdateMilestoneRequest, CreateProposalRequest, UpdateProposalRequest, ScopeRejectRequest, CoordinatorApprovalRequest, ApproveScopeRequest } from './types';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { MilestoneAssignment } from '../../database/entities/milestone-assignment.entity';
import { Developer } from '../../database/entities/developer.entity';
import { SkillsService } from '../skills/skills.service';

function milestoneStatsOf(milestones: Milestone[]): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
} {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  for (const m of milestones) {
    if (m.state === 'completed' || m.state === 'approved') completed += 1;
    else if (m.state === 'task_in_progress' || m.state === 'in_progress' || m.state === 'pending_review') inProgress += 1;
    else pending += 1;
  }
  return { total: milestones.length, completed, inProgress, pending };
}

@Injectable()
export class ProjectsService {


  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly developersService: DevelopersService,
    private readonly clientsService: ClientsService,
    private readonly ratingsService: RatingsService,
    private readonly eventsService: EventsService,
    private readonly skillsService: SkillsService,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
    @InjectRepository(MilestoneAssignment) private milestoneAssignmentRepo: Repository<MilestoneAssignment>,
  ) { }

  /**
   * Helper method to get contract address from project ID
   * Validates that the project exists and has a contract address
   */
  private async getContractAddressFromProjectId(projectId: string): Promise<string> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

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

  private async getUserIdentifierFromAddress(
    address: string,
    entityType: string
  ): Promise<string | null> {
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
      return responseData.userId || null;
    } catch (error) {
      console.error(`Error getting user identifier from address ${address}:`, error);
      return null;
    }
  }

  private async getAddressForUserIdentifier(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    try {
      const federateServerUrl = this.configService.getFederateServer();
      const url = `${federateServerUrl}/get-user-address?userId=${encodeURIComponent(userId)}`;
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) return null;
      const responseData = await response.json() as { address?: string };
      return responseData.address || null;
    } catch {
      return null;
    }
  }

  private async getUserIdFromAddress(
    address: string,
    findByIdentifierFn: (identifier: string) => Promise<{ id?: number } | null>,
    entityType: string
  ): Promise<number | null> {
    try {
      const userId = await this.getUserIdentifierFromAddress(address, entityType);
      if (!userId) {
        console.warn(`No userId returned for ${entityType} address: ${address}`);
        return null;
      }

      const entity = await findByIdentifierFn(userId);

      if (!entity) {
        console.warn(`Could not find ${entityType} for user identifier: ${userId}`);
        return null;
      }

      return entity.id!;
    } catch (error) {
      console.error(`Error getting ${entityType} ID from address ${address}:`, error);
      return null;
    }
  }

  private async getDeveloperFromAddress(address: string): Promise<Developer | null> {
    const userId = await this.getUserIdentifierFromAddress(address, 'developer');
    if (!userId) return null;
    return this.developersService.findByUserIdentifier(userId);
  }

  private async getAddressForDeveloperId(developerId: number): Promise<string | null> {
    const developer = await this.developersService.findOne(developerId).catch(() => null);
    return this.getAddressForUserIdentifier(developer?.userId || developer?.email);
  }

  private async getWalletAddress(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    if (!userId.includes('@')) return userId;

    try {
      const federateServerUrl = this.configService.getFederateServer();
      const url = `${federateServerUrl}/get-user-address?userId=${encodeURIComponent(userId)}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      const data = await response.json() as { address?: string };
      return data.address || null;
    } catch {
      return null;
    }
  }

  private async getProjectEventRecipients(
    project: Project,
    teamAddresses: string[] = [],
  ): Promise<string[]> {
    const [client, coordinator] = await Promise.all([
      this.clientsService.findOne(Number(project.clientId)).catch(() => null),
      project.consultantId
        ? this.developersService.findOne(Number(project.consultantId)).catch(() => null)
        : null,
    ]);
    const profileAddresses = await Promise.all([
      this.getWalletAddress(client?.userId || client?.email),
      this.getWalletAddress(coordinator?.userId || coordinator?.email),
    ]);
    return [...new Set([...profileAddresses, ...teamAddresses].filter(Boolean) as string[])];
  }

  private parsePositiveInteger(value: unknown, fieldName: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new HttpException(
        `${fieldName} must be a positive integer`,
        HttpStatus.BAD_REQUEST
      );
    }
    return parsed;
  }

  private async normalizeRequirements(
    requirements: CreateMilestoneRequest['requirements'],
  ): Promise<CreateMilestoneRequest['requirements']> {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new HttpException(
        'Milestone requirements must contain at least one assignment slot',
        HttpStatus.BAD_REQUEST,
      );
    }

    const keys = new Set<string>();
    const normalized: CreateMilestoneRequest['requirements'] = [];
    for (const requirement of requirements) {
      const assignmentKey = requirement.assignmentKey?.trim().toLowerCase();
      if (!assignmentKey) {
        throw new HttpException('assignmentKey is required', HttpStatus.BAD_REQUEST);
      }
      if (keys.has(assignmentKey)) {
        throw new HttpException(
          `Duplicate assignmentKey "${assignmentKey}" in milestone`,
          HttpStatus.BAD_REQUEST,
        );
      }
      keys.add(assignmentKey);
      const skillIds = await this.skillsService.validateIds(requirement.skillIds || []);
      if (skillIds.length === 0) {
        throw new HttpException(
          `Requirement "${assignmentKey}" must contain at least one skill ID`,
          HttpStatus.BAD_REQUEST,
        );
      }
      normalized.push({
        assignmentKey,
        hours: this.parsePositiveInteger(requirement.hours, `${assignmentKey}.hours`),
        skillIds,
      });
    }
    return normalized;
  }

  async assignCoordinator(projectId: string, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const result = await this.callPreSignedWriteMethod(contractAddress, 'assign_coordinator', {});

    if (result && result.success) {
      const assignedAccountId = result.coordinator;
      const developerId = await this.getUserIdFromAddress(
        assignedAccountId,
        (identifier) => this.developersService.findByUserIdentifier(identifier),
        'developer'
      );

      if (developerId) {
        project.consultantId = developerId.toString();
        await this.projectRepo.save(project);
        console.log(`Coordinator ${assignedAccountId} (developer ID: ${developerId}) assigned to project ${projectId} (${contractAddress})`);
      } else {
        console.warn(`Could not find developer ID for coordinator address ${assignedAccountId}. Project ${projectId} will not have consultantId set.`);
      }
      const recipients = await this.getProjectEventRecipients(project, [assignedAccountId]);
      await this.eventsService.publishProjectEvent('project.coordinator_assigned', {
        projectId,
        contractAddress,
        data: {
          developerId: developerId ?? null,
          accountId: assignedAccountId,
        },
      }, recipients);
    } else {
      console.error('Error assigning coordinator:', result);
      throw new HttpException(
        `Error assigning coordinator: ${result.error}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return result;
  }

  private async syncTeamAssignments(project: Project, contractAddress: string): Promise<{
    team: any[];
    tasks: any[];
    selectedDeveloperIds: number[];
  }> {
    const teamResponse = await this.callReadMethod(contractAddress, 'get_team');
    const tasksResponse = await this.callReadMethod(contractAddress, 'get_all_tasks');
    const team = Array.isArray(teamResponse.response) ? teamResponse.response : [];
    const tasks = Array.isArray(tasksResponse.response) ? tasksResponse.response : [];
    const approvedTasks = tasks.filter((task) => task?.status && 'Approved' in task.status);
    const unassignedTasks = approvedTasks.filter((task) => (
      !Array.isArray(task.assignments) || task.assignments.length === 0
    ));
    if (team.length === 0 || unassignedTasks.length > 0) {
      throw new HttpException(
        'Contract did not assign every approved milestone',
        HttpStatus.BAD_REQUEST,
      );
    }
    const milestones = await this.milestoneRepo.find({
      where: { contractAddress },
      order: { displayOrder: 'ASC' },
    });
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    const developerByAddress = new Map<string, Developer>();

    for (const member of team) {
      const accountId = String(member?.account_id || member?.accountId || '');
      if (!accountId) continue;
      const developer = await this.getDeveloperFromAddress(accountId);
      if (developer?.id) developerByAddress.set(accountId, developer);
    }

    await this.milestoneAssignmentRepo.delete({ projectId: project.id });
    for (const task of tasks) {
      const milestone = milestoneById.get(Number(task.id));
      if (!milestone) continue;
      const assignments = Array.isArray(task.assignments) ? task.assignments : [];

      for (const [index, assignment] of assignments.entries()) {
        const accountId = String(assignment.account_id || '');
        if (!accountId) continue;
        let developer = developerByAddress.get(accountId);
        if (!developer) {
          developer = await this.getDeveloperFromAddress(accountId) || undefined;
          if (developer?.id) developerByAddress.set(accountId, developer);
        }
        if (!developer?.id) continue;
        await this.milestoneAssignmentRepo.save(this.milestoneAssignmentRepo.create({
          projectId: project.id,
          contractAddress,
          milestoneId: milestone.id,
          developerId: developer.id,
          accountId,
          assignmentKey: String(assignment.assignment_key),
          hours: Number(assignment.hours),
        }));
        if (index === 0) milestone.developerId = developer.id;
      }

      if (task.completed) milestone.state = 'completed';
      else if (task.status && 'Active' in task.status) milestone.state = 'task_in_progress';
      else if (task.status && 'PendingReview' in task.status) milestone.state = 'in_review';
      else milestone.state = 'pending';
      await this.milestoneRepo.save(milestone);
    }

    project.state = 'team_assigned';
    await this.projectRepo.save(project);
    const selectedDeveloperIds = [...new Set(
      [...developerByAddress.values()].map((developer) => developer.id),
    )];
    const teamAddresses = team
      .map((member: any) => member?.account_id || member?.accountId)
      .filter(Boolean);
    const recipients = await this.getProjectEventRecipients(project, teamAddresses);
    await this.eventsService.publishProjectEvent('project.team_assigned', {
      projectId: project.id,
      contractAddress,
      state: project.state,
      data: {
        teamSize: team.length,
        selectedDeveloperIds,
      },
    }, recipients);

    return { team, tasks, selectedDeveloperIds };
  }

  async assignTeam(projectId: string, _body: { _team_size?: number } | undefined, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignResult = await this.callWriteMethod(contractAddress, 'assign_team', {}, authToken);
    if (assignResult && assignResult.success) {
      const synced = await this.syncTeamAssignments(project, contractAddress);
      return { ...assignResult, assignment: synced };
    }

    return assignResult;
  }

  async markCompleted(projectId: string, body: { ratings: Array<[string, number]>, coordinatorRating: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const completeResult = await this.callWriteMethod(contractAddress, 'mark_completed', { ratings: body.ratings }, authToken);

    // Set deliveryDate automatically when project is marked as completed
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) {
        project.deliveryDate = Date.now();
        project.state = 'completed';
        await this.projectRepo.save(project);
        console.log(`Delivery date set automatically for project ${projectId}: ${project.deliveryDate}`);

        // Save ratings
        try {
          if (body.ratings && body.ratings.length > 0) {
            const ratingsWithDeveloperIds: Array<[string, number]> = [];

            for (const [accountId, rating] of body.ratings) {
              const developerId = await this.getUserIdFromAddress(
                accountId,
                (identifier: string) => this.developersService.findByUserIdentifier(identifier),
                'developer'
              );
              if (developerId) {
                ratingsWithDeveloperIds.push([developerId.toString(), rating]);
              } else {
                console.warn(`Could not find developer ID for account_id ${accountId}, skipping rating`);
              }
            }

            if (ratingsWithDeveloperIds.length > 0) {
              await this.ratingsService.createRatings(
                projectId,
                project.clientId,
                ratingsWithDeveloperIds,
                contractAddress
              );
              console.log(`Ratings saved to database for project ${projectId}: ${ratingsWithDeveloperIds.length} ratings from client ${project.clientId}`);
            }
          }
        } catch (ratingsError) {
          console.error(`Error saving ratings to database for project ${projectId}:`, ratingsError);
        }
      } else {
        console.warn(`Project ${projectId} not found when trying to set delivery date`);
      }
    } catch (error) {
      console.error(`Error setting delivery date for project ${projectId}:`, error);
    }
    return completeResult;
  }



  async setCalendarContract(projectId: string, body: { calendar_contract: string }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.callWriteMethod(contractAddress, 'set_calendar_contract', { calendar_contract: body.calendar_contract }, authToken);
  }

  private async proposeScope(contractAddress: string, body: {
    tasks: Array<[number, any, string, number[]]>;
    advance_payment_percentage: number;
    document_hash: string;
    team_size?: number;
    assignment_requirements: Array<{
      task_id: number;
      requirements: Array<{
        assignment_key: string;
        hours: number;
        skill_ids: number[];
      }>;
    }>;
  }, authToken: string): Promise<any> {
    return this.callWriteMethod(contractAddress, 'propose_scope', body, authToken);
  }

  async approveScope(projectId: string, body: ApproveScopeRequest, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    const approvedTaskIds = Array.isArray(body.approved_task_ids) ? body.approved_task_ids : [];
    if (approvedTaskIds.length === 0) {
      throw new HttpException('approved_task_ids must contain at least one task ID', HttpStatus.BAD_REQUEST);
    }

    const approveResult = await this.callWriteMethod(contractAddress, 'approve_scope', { approved_task_ids: body.approved_task_ids, value: (project.budget || 0).toString() }, authToken);
    let assignmentResult: any = null;
    let assignTeamError: string | undefined;

    // Update project state from 'scope_proposed' to 'scope_accepted' when scope is approved
    if (approveResult && approveResult.success) {
      try {
        const updatedProject = await this.projectRepo.findOne({ where: { id: projectId } });
        if (updatedProject && updatedProject.state === 'scope_proposed') {
          updatedProject.state = 'scope_accepted';
          await this.projectRepo.save(updatedProject);
          console.log(`Project ${projectId} state updated from 'scope_proposed' to 'scope_accepted' after scope approval`);
        }

        const recipients = await this.getProjectEventRecipients(updatedProject || project);
        await this.eventsService.publishProjectEvent('project.scope_approved', {
          projectId,
          contractAddress,
          state: 'scope_accepted',
          data: {
            approvedTaskIds: body.approved_task_ids,
          },
        }, recipients);
      } catch (error) {
        console.error(`Error updating project state for ${projectId} after scope approval:`, error);
      }

      try {
        assignmentResult = await this.syncTeamAssignments(project, contractAddress);
      } catch (error) {
        assignTeamError = error instanceof Error ? error.message : 'Unknown team assignment error';
        console.error(`Error syncing contract team assignment for project ${projectId} after scope approval:`, error);
      }
    }

    return {
      ...approveResult,
      autoAssignTeam: {
        triggered: Boolean(approveResult && approveResult.success),
        success: Boolean(assignmentResult && assignmentResult.team.length > 0),
        teamSize: assignmentResult?.team?.length || 0,
        result: assignmentResult,
        error: assignTeamError,
      },
    };
  }

  async rejectScope(projectId: string, body: ScopeRejectRequest, authToken: string): Promise<any> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.state === 'scope_proposed') {
      project.state = 'scope_rejected';
    }

    if (body.clientResponse) {
      project.proposalRejectionReason = body.clientResponse;
    }

    await this.projectRepo.save(project);
    console.log(`Project ${projectId} state updated from 'scope_proposed' to 'scope_rejected' after scope rejection`);
    const recipients = await this.getProjectEventRecipients(project);
    await this.eventsService.publishProjectEvent('project.scope_rejected', {
      projectId,
      contractAddress: project.contractAddress,
      state: project.state,
      data: {
        clientResponse: body.clientResponse,
      },
    }, recipients);

    return { success: true };
  }

  async coordinatorRejectProject(projectId: string, rejectionReason: string): Promise<any> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    project.coordinatorApprovalStatus = 'rejected';
    project.coordinatorRejectionReason = rejectionReason || 'No reason provided';
    project.state = 'rejected_by_coordinator';
    await this.projectRepo.save(project);

    return { success: true, status: 'rejected' };
  }

  async coordinatorApproveProject(
    projectId: string,
    approvalData: CoordinatorApprovalRequest,
    authToken: string
  ): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    try {
      console.log('Creating milestones in database...');
      const createdMilestones: Milestone[] = [];

      // Create all milestones in database
      for (const milestoneData of approvalData.milestones) {
        const milestone = await this.createMilestone(contractAddress, milestoneData);
        createdMilestones.push(milestone);
        console.log(`Milestone created: ${milestone.id} - ${milestone.title}`);
      }

      const teamSize = new Set(
        createdMilestones.flatMap((milestone) => (
          milestone.requirements.map((requirement) => requirement.assignmentKey)
        )),
      ).size;

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
        team_size: teamSize,
        assignment_requirements: createdMilestones.map((milestone) => ({
          task_id: milestone.id,
          requirements: milestone.requirements.map((requirement) => ({
            assignment_key: requirement.assignmentKey,
            hours: requirement.hours,
            skill_ids: requirement.skillIds,
          })),
        })),
      }, authToken);

      console.log('Scope proposed successfully');

      // Update project status to approved
      project.coordinatorApprovalStatus = 'approved';
      project.state = 'scope_proposed';
      await this.projectRepo.save(project);
      const recipients = await this.getProjectEventRecipients(project);
      await this.eventsService.publishProjectEvent('project.scope_proposed', {
        projectId,
        contractAddress,
        state: 'scope_proposed',
        data: {
          milestoneCount: createdMilestones.length,
          advancePaymentPercentage: approvalData.advance_payment_percentage,
        },
      }, recipients);

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
    const submitResult = await this.callWriteMethod(contractAddress, 'submit_task_for_review', { task_id: body.task_id }, authToken);

    if (submitResult && submitResult.success) {
      try {
        const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: body.task_id } });
        if (milestone) {
          milestone.state = 'in_review';
          await this.milestoneRepo.save(milestone);
          console.log(`Milestone ${body.task_id} state updated to 'in_review' for project ${projectId}`);
        } else {
          console.warn(`Milestone ${body.task_id} not found in database for project ${projectId}, contract address ${contractAddress}`);
        }
      } catch (error) {
        console.error(`Error updating milestone state for task ${body.task_id} in project ${projectId}:`, error);
      }
    }

    return submitResult;
  }

  async completeTask(projectId: string, body: { task_id: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const completeResult = await this.callWriteMethod(contractAddress, 'complete_task', { task_id: body.task_id }, authToken);

    if (completeResult?.success) {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) await this.syncTeamAssignments(project, contractAddress);
    }

    return completeResult;
  }

  async rejectMilestone(projectId: string, milestoneId: number, body: { rejectionReason?: string }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: milestoneId } });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }

    // Update milestone in database with rejection information
    milestone.state = 'rejected';
    milestone.rejectionReason = body.rejectionReason || 'No reason provided';
    await this.milestoneRepo.save(milestone);

    return { success: true, status: 'rejected', milestone: { ...milestone } };
  }

  async submitCoordinatorRatings(projectId: string, body: { clientRating: number, teamRatings: Array<[string, number]> }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const result = await this.callWriteMethod(contractAddress, 'submit_coordinator_ratings', {
      client_rating: body.clientRating,
      team_ratings: body.teamRatings
    }, authToken);

    if (result && result.success) {
      try {
        const project = await this.projectRepo.findOne({ where: { id: projectId } });
        if (project) {
          if (project.consultantId) {
            await this.ratingsService.createRatings(
              projectId,
              project.consultantId,
              [[project.clientId, body.clientRating]],
              contractAddress
            );
          }

          const ratingsWithDeveloperIds: Array<[string, number]> = [];
          for (const [accountId, rating] of body.teamRatings) {
            const developerId = await this.getUserIdFromAddress(
              accountId,
              (identifier: string) => this.developersService.findByUserIdentifier(identifier),
              'developer'
            );
            if (developerId) {
              ratingsWithDeveloperIds.push([developerId.toString(), rating]);
            }
          }
          if (project.consultantId && ratingsWithDeveloperIds.length > 0) {
            await this.ratingsService.createRatings(
              projectId,
              project.consultantId,
              ratingsWithDeveloperIds,
              contractAddress
            );
          }
        }
      } catch (error) {
        console.error(`Error saving coordinator ratings to database for project ${projectId}:`, error);
      }
    }
    return result;
  }

  async submitDeveloperRating(projectId: string, body: { coordinatorRating: number }, authToken: string): Promise<any> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const result = await this.callWriteMethod(contractAddress, 'submit_developer_rating', {
      rating: body.coordinatorRating
    }, authToken);

    if (result && result.success) {
      try {
        const project = await this.projectRepo.findOne({ where: { id: projectId } });
        const userId = await this.authService.getUserIdFromToken(authToken);
        const developer = await this.developersService.findByUserIdentifier(userId);

        if (project && project.consultantId && developer && developer.id) {
          await this.ratingsService.createRatings(
            projectId,
            developer.id.toString(),
            [[project.consultantId, body.coordinatorRating]],
            contractAddress
          );
        }
      } catch (error) {
        console.error(`Error saving developer rating to database for project ${projectId}:`, error);
      }
    }

    return result;
  }

  async getProjectInfo(projectId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
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
      const milestones = await this.milestoneRepo.find({ where: { contractAddress } });
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
      (identifier: string) => this.developersService.findByUserIdentifier(identifier),
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
    const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: taskId } });
    const assignments = await this.milestoneAssignmentRepo.find({ where: { contractAddress, milestoneId: taskId } });
    return {
      ...taskResponse,
      milestone: milestone ? { ...milestone, assignments } as any : undefined,
    };
  }

  async getTaskCompletionStatus(projectId: string, taskId: number): Promise<QueryResponse & { milestoneState?: string }> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const taskStatusResponse = await this.callReadMethod(contractAddress, 'get_task_completion_status', { task_id: taskId });
    const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: taskId } });
    return {
      ...taskStatusResponse,
      milestoneState: milestone ? milestone.state : undefined,
    };
  }

  async getAllTasks(projectId: string): Promise<QueryResponse & { milestones: Milestone[] }> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const tasksResponse = await this.callReadMethod(contractAddress, 'get_all_tasks');
    const milestones = await this.milestoneRepo.find({ where: { contractAddress }, order: { displayOrder: 'ASC' } });
    const assignments = await this.milestoneAssignmentRepo.find({ where: { contractAddress } });
    const assignmentsByMilestone = new Map<number, MilestoneAssignment[]>();
    for (const assignment of assignments) {
      const list = assignmentsByMilestone.get(assignment.milestoneId) ?? [];
      list.push(assignment);
      assignmentsByMilestone.set(assignment.milestoneId, list);
    }

    const enrichedMilestones = await Promise.all(
      milestones.map(async (milestone) => {
        const milestoneObj = {
          ...milestone,
          assignments: assignmentsByMilestone.get(milestone.id) ?? [],
        };

        if (tasksResponse.success && Array.isArray(tasksResponse.response)) {
          const task = tasksResponse.response.find((t: any) => t.id === milestone.id);

          if (task && task.assigned_to) {
            const developerId = await this.getDeveloperIdFromAddress(task.assigned_to);
            if (developerId) {
              milestoneObj.developerId = developerId;

              // Update the milestone in database if it doesn't have developerId set
              if (milestone.developerId !== developerId) {
                milestone.developerId = developerId;
                await this.milestoneRepo.save(milestone);
                console.log(`Updated milestone ${milestone.id} with developerId ${developerId}`);
              }
            }
          }
        }

        return milestoneObj;
      })
    );

    return {
      ...tasksResponse,
      milestones: enrichedMilestones,
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
      const client = await this.clientsService.findByUserIdentifier(userId);

      if (!client || !client.id) {
        throw new HttpException(
          `Could not find client ID for user ${userId}. Please ensure the client is registered.`,
          HttpStatus.BAD_REQUEST
        );
      }

      const newProject = this.projectRepo.create({
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

      const savedProject = await this.projectRepo.save(newProject);
      const projectId = savedProject.id;



      const federateServerUrl = this.configService.getFederateServer();
      const url = `${federateServerUrl}/get-user-address?userId=${encodeURIComponent(userId)}`;

      const callerResponse = await fetch(url, { method: "GET" });
      if (!callerResponse.ok) {
        throw new HttpException(
          `Failed to fetch client address from FederateServer: ${callerResponse.status} ${callerResponse.statusText}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const { address: clientAddress } = await callerResponse.json() as { address: string };

      this.executeDeploymentInBackground(
        projectId,
        version,
        proposalData,
        authToken,
        calendarContract,
        clientAddress
      ).catch((error) => {
        console.error(`[Fatal] Background deployment error handler caught error for project ${projectId}:`, error);
        this.projectRepo.update(projectId, {
          creationStatus: 'failed',
          creationError: `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }).catch((updateError) => {
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
    calendarContract: string,
    client: string
  ): Promise<void> {
    let project = await this.projectRepo.findOne({ where: { id: projectId } });

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
        client,
        dao_address: daoAddress,
        calendar_contract: calendarContract,
        ratings_contract: ratingsContract,
      };

      console.log(`[Background] Deploying contract for project ${projectId}`, { deployerUrl, deployBody });

      const deployerResponse = await fetch(deployerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...deployBody, address })
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
      project.creationError = null;
      await this.projectRepo.save(project);
      console.log(`[Background] Project ${projectId} successfully created with contract address: ${deployerResult.address}`);

      // Automatically assign coordinator after deployment
      try {
        console.log(`[Background] Automatically assigning coordinator to project ${projectId} (${deployerResult.address})...`);
        await this.assignCoordinator(projectId, authToken);
        console.log(`[Background] Coordinator assigned successfully to project ${projectId} (${deployerResult.address})`);
      } catch (error) {
        console.error(`[Background] Error assigning coordinator to project ${projectId} (${deployerResult.address}):`, error);
        project.creationError = `Deployment successful but coordinator assignment failed: ${error.message}`;
        await this.projectRepo.save(project);
      }
    } catch (error) {
      console.error(`[Background] Error in deployment for project ${projectId}:`, error);

      project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) {
        project.creationStatus = 'failed';
        project.creationError = error instanceof Error ? error.message : 'Unknown error during deployment';
        await this.projectRepo.save(project);
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
      console.log({ data });
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

      console.log({ caller });
      console.log({ craftUrl });

      const craftResponse = await fetch(craftUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...requestBody, caller })
      });

      if (!craftResponse.ok) {
        const errorBody = await craftResponse.text();
        console.error(`Craft service error body: ${errorBody}`);
        throw new Error(`Craft service error: ${craftResponse.status} ${craftResponse.statusText} - ${errorBody}`);
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

      console.log({ craftResponse })

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

      console.log({ result });

      return result;
    } catch (error) {
      throw new HttpException(
        `Error calling read method ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async callCalendarReadMethod(
    contractAddress: string,
    method: string,
    params?: Record<string, any>
  ): Promise<QueryResponse> {
    try {
      const signingServiceUrl = this.configService.getSigningServiceUrl();
      let url = `${signingServiceUrl}/calendar/query/${contractAddress}/${method}`;
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

      return await response.json() as QueryResponse;
    } catch (error) {
      throw new HttpException(
        `Error calling calendar read method ${method}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async saveProject(contractAddress: string, projectData: Partial<Project>): Promise<Project> {
    const existingProject = await this.projectRepo.findOne({ where: { contractAddress } });
    if (existingProject) {
      Object.assign(existingProject, projectData);
      return this.projectRepo.save(existingProject);
    }
    const newProject = this.projectRepo.create({ contractAddress, ...projectData } as Project);
    return this.projectRepo.save(newProject);
  }

  async updateProject(projectId: string, updateData: UpdateProposalRequest, authToken?: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
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

    return this.projectRepo.save(project);
  }

  async createMilestone(contractAddress: string, milestoneData: CreateMilestoneRequest): Promise<Milestone> {
    const highestMilestone = await this.milestoneRepo.findOne({
      where: { contractAddress },
      order: { displayOrder: 'DESC' },
    });

    const displayOrder = highestMilestone ? highestMilestone.displayOrder + 1 : 0;
    const requirements = await this.normalizeRequirements(milestoneData.requirements);

    const newMilestone = this.milestoneRepo.create({
      contractAddress,
      title: milestoneData.title,
      description: milestoneData.description,
      budget: milestoneData.budget,
      deliveryTime: milestoneData.deliveryTime,
      requirements,
      displayOrder,
      state: 'pending',
    });

    return this.milestoneRepo.save(newMilestone);
  }

  async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    return this.milestoneRepo.find({ where: { contractAddress }, order: { displayOrder: 'ASC' } });
  }

  async getMilestoneById(projectId: string, milestoneId: number): Promise<Milestone> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: milestoneId } });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }
    return milestone;
  }

  async updateMilestone(projectId: string, milestoneId: number, updateData: UpdateMilestoneRequest): Promise<Milestone> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const milestone = await this.milestoneRepo.findOne({ where: { contractAddress, id: milestoneId } });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }

    milestone.title = updateData.title;
    if (updateData.description !== undefined) milestone.description = updateData.description;
    milestone.budget = updateData.budget;
    milestone.deliveryTime = updateData.deliveryTime;
    milestone.requirements = await this.normalizeRequirements(updateData.requirements);

    return this.milestoneRepo.save(milestone);
  }

  async deleteMilestone(projectId: string, milestoneId: number): Promise<void> {
    const contractAddress = await this.getContractAddressFromProjectId(projectId);
    const result = await this.milestoneRepo.delete({ contractAddress, id: milestoneId });

    if (result.affected === 0) {
      throw new NotFoundException(`Milestone ${milestoneId} not found for project ${projectId}`);
    }
  }

  /**
   * Dashboard list: all projects where the token's user is client, consultant,
   * or assigned to a milestone. Lightweight — no contract queries.
   */
  async listForToken(
    token: string,
    filters: { role?: string; status?: string } = {}
  ): Promise<{ projects: any[]; total: number }> {
    const userId = await this.authService.getUserIdFromToken(token);
    const [client, developer] = await Promise.all([
      this.clientsService.findByUserIdentifier(userId),
      this.developersService.findByUserIdentifier(userId),
    ]);

    const clientId = client?.id?.toString();
    const developerId = developer?.id;

    if (!clientId && !developerId) {
      return { projects: [], total: 0 };
    }

    const qb = this.projectRepo.createQueryBuilder('p');
    const ors: string[] = [];
    const params: Record<string, any> = {};
    if (clientId) {
      ors.push('p.clientId = :clientId');
      params.clientId = clientId;
    }
    if (developerId !== undefined) {
      ors.push('p.consultantId = :consultantId');
      params.consultantId = developerId.toString();
      ors.push(
        'p.contractAddress IN (SELECT m.contractAddress FROM milestones m WHERE m.developerId = :memberDevId)'
      );
      params.memberDevId = developerId;
    }
    qb.where(`(${ors.join(' OR ')})`, params);
    if (filters.status) qb.andWhere('p.state = :status', { status: filters.status });
    qb.orderBy('p.updatedAt', 'DESC');

    const projects = await qb.getMany();

    const contractAddresses = projects.map((p) => p.contractAddress).filter(Boolean) as string[];
    const milestones = contractAddresses.length
      ? await this.milestoneRepo
          .createQueryBuilder('m')
          .where('m.contractAddress IN (:...addrs)', { addrs: contractAddresses })
          .getMany()
      : [];
    const milestonesByContract = new Map<string, Milestone[]>();
    for (const m of milestones) {
      const list = milestonesByContract.get(m.contractAddress) ?? [];
      list.push(m);
      milestonesByContract.set(m.contractAddress, list);
    }
    const assignments = contractAddresses.length
      ? await this.milestoneAssignmentRepo.find({ where: { contractAddress: In(contractAddresses) } })
      : [];
    const assignmentsByContract = new Map<string, MilestoneAssignment[]>();
    for (const assignment of assignments) {
      const list = assignmentsByContract.get(assignment.contractAddress) ?? [];
      list.push(assignment);
      assignmentsByContract.set(assignment.contractAddress, list);
    }

    const entries = projects
      .map((p) => {
        let role: 'client' | 'consultant' | 'team' | null = null;
        if (clientId && p.clientId === clientId) role = 'client';
        else if (developerId !== undefined && p.consultantId === developerId.toString()) role = 'consultant';
        else if (developerId !== undefined && (milestonesByContract.get(p.contractAddress) ?? [])
          .some((m) => m.developerId === developerId)) role = 'team';
        else if (developerId !== undefined && (assignmentsByContract.get(p.contractAddress) ?? [])
          .some((assignment) => assignment.developerId === developerId)) role = 'team';
        if (!role) return null;
        if (filters.role && filters.role !== 'all' && filters.role !== role) return null;

        const ms = milestonesByContract.get(p.contractAddress) ?? [];
        return {
          id: p.id,
          contractAddress: p.contractAddress,
          title: p.title,
          state: p.state,
          role,
          counterpartId: role === 'client' ? p.consultantId : p.clientId,
          milestoneStats: milestoneStatsOf(ms),
          budget: p.budget,
          updatedAt: p.updatedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { projects: entries, total: entries.length };
  }

  /**
   * Dashboard detail: project + milestones from SQLite, gated by user's relation.
   * Composed contract reads (team, scope, tasks) are available via the existing
   * /:projectId/get_{project_info,team,scope_info,all_tasks} endpoints.
   */
  async getForToken(projectId: string, token: string): Promise<any> {
    const userId = await this.authService.getUserIdFromToken(token);
    const [client, developer, project] = await Promise.all([
      this.clientsService.findByUserIdentifier(userId),
      this.developersService.findByUserIdentifier(userId),
      this.projectRepo.findOne({ where: { id: projectId } }),
    ]);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const clientId = client?.id?.toString();
    const developerId = developer?.id;

    const milestones = project.contractAddress
      ? await this.milestoneRepo.find({
          where: { contractAddress: project.contractAddress },
          order: { displayOrder: 'ASC' },
        })
      : [];
    const assignments = project.contractAddress
      ? await this.milestoneAssignmentRepo.find({ where: { contractAddress: project.contractAddress } })
      : [];

    let role: 'client' | 'consultant' | 'team' | null = null;
    if (clientId && project.clientId === clientId) role = 'client';
    else if (developerId !== undefined && project.consultantId === developerId.toString()) role = 'consultant';
    else if (developerId !== undefined && milestones.some((m) => m.developerId === developerId)) role = 'team';
    else if (developerId !== undefined && assignments.some((assignment) => assignment.developerId === developerId)) role = 'team';
    if (!role) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }

    const assignmentsByMilestone = new Map<number, MilestoneAssignment[]>();
    for (const assignment of assignments) {
      const list = assignmentsByMilestone.get(assignment.milestoneId) ?? [];
      list.push(assignment);
      assignmentsByMilestone.set(assignment.milestoneId, list);
    }

    return {
      ...project,
      role,
      milestones: milestones.map((milestone) => ({
        ...milestone,
        assignments: assignmentsByMilestone.get(milestone.id) ?? [],
      })),
      milestoneStats: milestoneStatsOf(milestones),
    };
  }

  async getBalance(address: string, assetId: number = 1): Promise<{ balance: string; assetId: number }> {
    try {
      const federateServer = this.configService.getFederateServer();
      const url = `${federateServer}/balance?address=${encodeURIComponent(address)}&assetId=${assetId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get balance: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { balance: string; assetId: number };
      return result;
    } catch (error) {
      console.error(`Error getting balance for address ${address}:`, error);
      throw new HttpException(
        `Error getting balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
