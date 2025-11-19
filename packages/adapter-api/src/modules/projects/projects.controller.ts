import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProposalRequest, UpdateProposalRequest, ScopeRejectRequest } from '../../types';
import { CreateMilestoneRequest, UpdateMilestoneRequest } from './types';

@ApiTags('Projects')
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided or invalid format');
    }
    return authHeader.split(' ')[1];
  }

  @Post(':contractAddress/assign_coordinator')
  @ApiOperation({ 
    summary: 'Assign coordinator to project',
    description: 'Assigns a coordinator to manage the specified project contract'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Coordinator assigned successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async assignCoordinator(
    @Param('contractAddress') contractAddress: string,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.assignCoordinator(contractAddress, token);
  }

  @Post(':contractAddress/assign_team')
  @ApiOperation({ 
    summary: 'Assign team to project',
    description: 'Assigns a team with specified size to the project contract'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        _team_size: { 
          type: 'number',
          description: 'Number of team members to assign',
          example: 5
        }
      },
      required: ['_team_size']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Team assigned successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async assignTeam(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { _team_size: number },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.assignTeam(contractAddress, body, token);
  }

  @Post(':contractAddress/mark_completed')
  @ApiOperation({ 
    summary: 'Mark project as completed',
    description: 'Marks the project as completed with team member ratings'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ratings: { 
          type: 'array',
          items: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                { type: 'number' }
              ]
            },
            minItems: 2,
            maxItems: 2
          },
          description: 'Array of team member ratings as [account_id, rating] tuples',
          example: [["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 4.5]]
        }
      },
      required: ['ratings']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Project marked as completed successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async markCompleted(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { ratings: Array<[string, number]> },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.markCompleted(contractAddress, body, token);
  }

  @Post(':contractAddress/set_calendar_contract')
  @ApiOperation({ 
    summary: 'Set calendar contract',
    description: 'Associates a calendar contract with the project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        calendar_contract: { 
          type: 'string',
          description: 'Address of the calendar contract to associate',
          example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        }
      },
      required: ['calendar_contract']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Calendar contract set successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async setCalendarContract(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { calendar_contract: string },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.setCalendarContract(contractAddress, body, token);
  }

  @Post(':contractAddress/propose_scope')
  @ApiOperation({ 
    summary: 'Propose project scope',
    description: 'Proposes a scope for the project with tasks, advance payment percentage, and document hash'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tasks: { 
          type: 'array',
          items: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'number' },
                { type: 'object' },
                { type: 'string' },
                { type: 'array', items: { type: 'number' } }
              ]
            },
            minItems: 4,
            maxItems: 4
          },
          description: 'Array of tasks as [id, complexity, cost, dependencies] tuples'
        },
        advance_payment_percentage: { 
          type: 'number',
          description: 'Percentage of advance payment',
          example: 30
        },
        document_hash: { 
          type: 'string',
          description: 'Hash of the project document',
          example: '0x1234567890abcdef...'
        }
      },
      required: ['tasks', 'advance_payment_percentage', 'document_hash']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Scope proposed successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async proposeScope(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { 
      tasks: Array<[number, any, string, number[]]>;
      advance_payment_percentage: number;
      document_hash: string;
    },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.proposeScope(contractAddress, body, token);
  }

  @Post(':contractAddress/approve_scope')
  @ApiOperation({ 
    summary: 'Approve project scope',
    description: 'Approves specific tasks from the proposed project scope'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approved_task_ids: { 
          type: 'array',
          items: { type: 'number' },
          description: 'Array of task IDs to approve',
          example: [1, 2, 3]
        }
      },
      required: ['approved_task_ids']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Scope approved successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async approveScope(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { approved_task_ids: number[] },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.approveScope(contractAddress, body, token);
  }

  @Post(':contractAddress/reject_scope')
  @ApiOperation({ 
    summary: 'Reject project scope',
    description: 'Rejects the proposed project scope with optional client response'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientResponse: { 
          type: 'string',
          description: 'Optional client response explaining the rejection',
          example: 'The proposed scope does not meet our requirements'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Scope rejected successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async rejectScope(
    @Param('contractAddress') contractAddress: string,
    @Body() body: ScopeRejectRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.rejectScope(contractAddress, body, token);
  }

  @Post(':contractAddress/complete_task')
  @ApiOperation({ 
    summary: 'Complete a task',
    description: 'Marks a specific task as completed in the project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        task_id: { 
          type: 'number',
          description: 'ID of the task to complete',
          example: 1
        }
      },
      required: ['task_id']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Task completed successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async completeTask(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { task_id: number },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.completeTask(contractAddress, body, token);
  }

  @Get(':contractAddress/get_project_info')
  @ApiOperation({ 
    summary: 'Get project information',
    description: 'Retrieves detailed information about a specific project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Project information retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getProjectInfo(@Param('contractAddress') contractAddress: string) {
    return await this.projectsService.getProjectInfo(contractAddress);
  }

  @Get(':contractAddress/get_team')
  @ApiOperation({ 
    summary: 'Get project team',
    description: 'Retrieves the team members assigned to a specific project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Team information retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getTeam(@Param('contractAddress') contractAddress: string) {
    return await this.projectsService.getTeam(contractAddress);
  }

  @Get(':contractAddress/get_scope_info')
  @ApiOperation({ 
    summary: 'Get project scope information',
    description: 'Retrieves the scope information for a specific project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Scope information retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getScopeInfo(@Param('contractAddress') contractAddress: string) {
    return await this.projectsService.getScopeInfo(contractAddress);
  }

  @Get(':contractAddress/get_task')
  @ApiOperation({ 
    summary: 'Get specific task information',
    description: 'Retrieves detailed information about a specific task in the project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiQuery({ 
    name: 'task_id', 
    description: 'ID of the task to retrieve',
    type: 'number',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Task information retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Task or project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getTask(
    @Param('contractAddress') contractAddress: string,
    @Query('task_id') taskId: number
  ) {
    return await this.projectsService.getTask(contractAddress, taskId);
  }

  @Get(':contractAddress/get_task_completion_status')
  @ApiOperation({ 
    summary: 'Get task completion status',
    description: 'Retrieves the completion status of a specific task'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiQuery({ 
    name: 'task_id', 
    description: 'ID of the task to check completion status',
    type: 'number',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Task completion status retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Task or project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getTaskCompletionStatus(
    @Param('contractAddress') contractAddress: string,
    @Query('task_id') taskId: number
  ) {
    return await this.projectsService.getTaskCompletionStatus(contractAddress, taskId);
  }

  @Get(':contractAddress/get_all_tasks')
  @ApiOperation({ 
    summary: 'Get all project tasks',
    description: 'Retrieves all tasks associated with a specific project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All tasks retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getAllTasks(@Param('contractAddress') contractAddress: string) {
    return await this.projectsService.getAllTasks(contractAddress);
  }

  @Post('deploy/:version')
  @ApiOperation({ 
    summary: 'Deploy project contract',
    description: 'Deploys a new project contract with the specified version and creates a proposal'
  })
  @ApiParam({ 
    name: 'version', 
    description: 'Version of the contract to deploy',
    type: 'string',
    example: 'v1.0.0'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { 
          type: 'string',
          description: 'Title of the project',
          example: 'My Project'
        },
        summary: { 
          type: 'string',
          description: 'Brief summary of the project',
          example: 'A brief project description'
        },
        description: { 
          type: 'string',
          description: 'Detailed description of the project',
          example: 'Full project description...'
        },
        url: { 
          type: 'string',
          description: 'Project URL',
          example: 'https://example.com'
        },
        projectTypeId: { 
          type: 'number',
          description: 'Project type ID',
          example: 1
        },
        budgetId: { 
          type: 'number',
          description: 'Budget ID',
          example: 1
        },
        deliveryTimeId: { 
          type: 'number',
          description: 'Delivery time ID',
          example: 1
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        },
        clientId: { 
          type: 'number',
          description: 'Client ID',
          example: 1
        }
      },
      required: ['title', 'budgetId', 'deliveryTimeId', 'deliveryDate', 'clientId']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract deployed successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async deployContract(
    @Param('version') version: string,
    @Body() body: CreateProposalRequest & { clientId: number },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    const { clientId, ...proposalData } = body;
    return await this.projectsService.deployContract(version, proposalData, clientId, token);
  }

  @Put(':contractAddress')
  @ApiOperation({ 
    summary: 'Update project',
    description: 'Updates project information in the database'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { 
          type: 'string',
          description: 'Title of the project',
          example: 'My Project'
        },
        summary: { 
          type: 'string',
          description: 'Brief summary of the project',
          example: 'A brief project description'
        },
        description: { 
          type: 'string',
          description: 'Detailed description of the project',
          example: 'Full project description...'
        },
        url: { 
          type: 'string',
          description: 'Project URL',
          example: 'https://example.com'
        },
        projectTypeId: { 
          type: 'number',
          description: 'Project type ID',
          example: 1
        },
        budgetId: { 
          type: 'number',
          description: 'Budget ID',
          example: 1
        },
        deliveryTimeId: { 
          type: 'number',
          description: 'Delivery time ID',
          example: 1
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        }
      },
      required: ['title', 'budgetId', 'deliveryTimeId', 'deliveryDate']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Project updated successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async updateProject(
    @Param('contractAddress') contractAddress: string,
    @Body() body: UpdateProposalRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.updateProject(contractAddress, body);
  }

  @Post(':projectId/milestones')
  @ApiOperation({ 
    summary: 'Create milestone',
    description: 'Creates a new milestone for the specified project'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    type: 'number'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { 
          type: 'string',
          description: 'Title of the milestone',
          example: 'Phase 1: Design'
        },
        description: { 
          type: 'string',
          description: 'Description of the milestone',
          example: 'Complete the UI/UX design'
        },
        budget: { 
          type: 'number',
          description: 'Budget for the milestone',
          example: 5000
        },
        deliveryTimeId: { 
          type: 'number',
          description: 'Delivery time ID',
          example: 1
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        },
        roleId: { 
          type: 'number',
          description: 'Required role ID',
          example: 1
        },
        proficiencyId: { 
          type: 'number',
          description: 'Required proficiency ID',
          example: 2
        },
        skills: { 
          type: 'array',
          items: { type: 'number' },
          description: 'Required skill IDs',
          example: [1, 2, 3]
        },
        availability: { 
          type: 'string',
          enum: ['fulltime', 'parttime', 'hourly'],
          description: 'Developer availability type',
          example: 'fulltime'
        }
      },
      required: ['title', 'budget', 'deliveryTimeId', 'deliveryDate', 'availability']
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Milestone created successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async createMilestone(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: CreateMilestoneRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.createMilestone(projectId, body);
  }

  @Get(':projectId/milestones')
  @ApiOperation({ 
    summary: 'Get project milestones',
    description: 'Retrieves all milestones for the specified project'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    type: 'number'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Milestones retrieved successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  async getMilestones(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.getMilestonesByProject(projectId);
  }

  @Get(':projectId/milestones/:milestoneId')
  @ApiOperation({ 
    summary: 'Get milestone by ID',
    description: 'Retrieves a specific milestone by its ID'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    type: 'number'
  })
  @ApiParam({ 
    name: 'milestoneId', 
    description: 'The ID of the milestone',
    type: 'number'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Milestone retrieved successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Milestone not found'
  })
  async getMilestone(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.getMilestoneById(projectId, milestoneId);
  }

  @Put(':projectId/milestones/:milestoneId')
  @ApiOperation({ 
    summary: 'Update milestone',
    description: 'Updates a specific milestone'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    type: 'number'
  })
  @ApiParam({ 
    name: 'milestoneId', 
    description: 'The ID of the milestone',
    type: 'number'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { 
          type: 'string',
          description: 'Title of the milestone',
          example: 'Phase 1: Design'
        },
        description: { 
          type: 'string',
          description: 'Description of the milestone',
          example: 'Complete the UI/UX design'
        },
        budget: { 
          type: 'number',
          description: 'Budget for the milestone',
          example: 5000
        },
        deliveryTimeId: { 
          type: 'number',
          description: 'Delivery time ID',
          example: 1
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        },
        roleId: { 
          type: 'number',
          description: 'Required role ID',
          example: 1
        },
        proficiencyId: { 
          type: 'number',
          description: 'Required proficiency ID',
          example: 2
        },
        skills: { 
          type: 'array',
          items: { type: 'number' },
          description: 'Required skill IDs',
          example: [1, 2, 3]
        },
        availability: { 
          type: 'string',
          enum: ['fulltime', 'parttime', 'hourly'],
          description: 'Developer availability type',
          example: 'fulltime'
        }
      },
      required: ['title', 'budget', 'deliveryTimeId', 'deliveryDate', 'availability']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Milestone updated successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Milestone not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async updateMilestone(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Body() body: UpdateMilestoneRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.updateMilestone(projectId, milestoneId, body);
  }

  @Delete(':projectId/milestones/:milestoneId')
  @ApiOperation({ 
    summary: 'Delete milestone',
    description: 'Deletes a specific milestone'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    type: 'number'
  })
  @ApiParam({ 
    name: 'milestoneId', 
    description: 'The ID of the milestone',
    type: 'number'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Milestone deleted successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Milestone not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async deleteMilestone(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    await this.projectsService.deleteMilestone(projectId, milestoneId);
    return { success: true, message: 'Milestone deleted successfully' };
  }
}
