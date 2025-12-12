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
import { CreateProposalRequest, UpdateProposalRequest, ScopeRejectRequest, CreateMilestoneRequest, UpdateMilestoneRequest } from './types';

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
    summary: 'Get specific task information and milestone',
    description: 'Retrieves detailed information about a specific task from the smart contract and its corresponding milestone from MongoDB'
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
    description: 'Task and milestone information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        method: { type: 'string' },
        contractAddress: { type: 'string' },
        response: {
          type: 'object',
          description: 'Task information from the smart contract',
          properties: {
            id: { type: 'number' },
            cost: { type: 'string' },
            complexity: { type: 'object' },
            dependencies: { type: 'array' },
            status: { type: 'object' }
          }
        },
        milestone: {
          type: 'object',
          description: 'Milestone information from MongoDB',
          properties: {
            id: { type: 'number' },
            contractAddress: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            budget: { type: 'number' },
            deliveryTime: { type: 'number' },
            role: { type: 'string' },
            proficiency: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
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
    summary: 'Get all project tasks and milestones',
    description: 'Retrieves all tasks from the smart contract and milestones from MongoDB for a specific project'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All tasks and milestones retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        method: { type: 'string' },
        contractAddress: { type: 'string' },
        response: {
          type: 'array',
          description: 'Array of tasks from the smart contract',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              cost: { type: 'string' },
              complexity: { type: 'object' },
              dependencies: { type: 'array' },
              status: { type: 'object' }
            }
          }
        },
        milestones: {
          type: 'array',
          description: 'Array of milestones from MongoDB',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              contractAddress: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              budget: { type: 'number' },
              deliveryTime: { type: 'number' },
              role: { type: 'string' },
              proficiency: { type: 'string' },
              skills: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
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
        projectType: { 
          type: 'number',
          description: 'Project type',
          example: 1
        },
        budget: { 
          type: 'number',
          description: 'Project budget in tokens',
          example: 5000
        },
        deliveryTime: { 
          type: 'number',
          description: 'Expected delivery time',
          example: 30
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        },
        clientId: { 
          type: 'string',
          description: 'Client AccountId',
          example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        },
        calendarContract: {
          type: 'string',
          description: 'Optional: Calendar contract address. If not provided, uses DAO default calendar contract.',
          example: 'Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr'
        },
        ratingsContract: {
          type: 'string',
          description: 'Optional: Ratings contract address. If not provided, uses DAO default ratings contract.',
          example: 'JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY'
        }
      },
      required: ['title', 'budget', 'deliveryTime', 'deliveryDate', 'clientId'],
      description: 'Project will use provided contract addresses or default to DAO shared contracts if not specified'
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
    @Body() body: CreateProposalRequest & { clientId: string },
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
        projectType: { 
          type: 'number',
          description: 'Project type',
          example: 1
        },
        budget: { 
          type: 'number',
          description: 'Project budget in tokens',
          example: 5000
        },
        deliveryTime: { 
          type: 'number',
          description: 'Expected delivery time',
          example: 30
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        }
      },
      required: ['title', 'budget', 'deliveryTime', 'deliveryDate']
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

  @Post(':contractAddress/propose_scope')
  @ApiOperation({ 
    summary: 'Coordinator approves project and proposes scope',
    description: 'Coordinator approves a project by creating milestones and proposing scope to the smart contract. This is an atomic operation that saves milestones to the database and converts them into tasks for the blockchain contract.'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication (coordinator)',
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
        milestones: {
          type: 'array',
          description: 'Array of milestones for the project',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', example: 'Phase 1: Design' },
              description: { type: 'string', example: 'Complete UI/UX design' },
              budget: { type: 'number', example: 5000 },
              deliveryTime: { type: 'number', example: 15 },
              deliveryDate: { type: 'string', example: '2024-12-31' },
              role: { type: 'string', example: 'Frontend Developer' },
              proficiency: { type: 'string', example: 'Senior' },
              skills: { 
                type: 'array',
                items: { type: 'string' },
                example: ['React', 'TypeScript', 'CSS']
              }
            }
          }
        },
        advance_payment_percentage: {
          type: 'number',
          description: 'Percentage of advance payment (0-100)',
          example: 20
        },
        document_hash: {
          type: 'string',
          description: 'IPFS or document hash containing detailed project scope',
          example: 'QmXYZ...'
        }
      },
      required: ['milestones', 'advance_payment_percentage', 'document_hash']
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Project approved, milestones created, and scope proposed successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token or not a coordinator'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async proposeScope(
    @Param('contractAddress') contractAddress: string,
    @Body() body: {
      milestones: CreateMilestoneRequest[];
      advance_payment_percentage: number;
      document_hash: string;
    },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.coordinatorApproveProject(contractAddress, body, token);
  }

  @Post(':contractAddress/coordinator_reject')
  @ApiOperation({ 
    summary: 'Coordinator rejects project',
    description: 'Coordinator rejects a project with a reason. The rejection is stored.'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication (coordinator)',
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
        rejectionReason: {
          type: 'string',
          description: 'Detailed reason for project rejection',
          example: 'Project scope is unclear and budget is insufficient'
        }
      },
      required: ['rejectionReason']
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Project rejected successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token or not a coordinator'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async coordinatorRejectProject(
    @Param('contractAddress') contractAddress: string,
    @Body() body: { rejectionReason: string },
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.coordinatorRejectProject(contractAddress, body.rejectionReason);
  }

  @Put(':contractAddress/milestones/:milestoneId')
  @ApiOperation({ 
    summary: 'Update milestone',
    description: 'Updates a specific milestone'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
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
          description: 'Budget for the milestone in tokens',
          example: 5000
        },
        deliveryTime: { 
          type: 'number',
          description: 'Delivery time in days',
          example: 15
        },
        deliveryDate: { 
          type: 'string',
          description: 'Expected delivery date (ISO format)',
          example: '2024-12-31'
        },
        role: { 
          type: 'string',
          description: 'Required role for the milestone',
          example: 'Frontend Developer'
        },
        proficiency: { 
          type: 'string',
          description: 'Required proficiency level',
          example: 'Senior'
        },
        skills: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Required skills',
          example: ['React', 'TypeScript', 'CSS']
        },
        availability: { 
          type: 'string',
          enum: ['fulltime', 'parttime', 'hourly'],
          description: 'Developer availability type',
          example: 'fulltime'
        }
      },
      required: ['title', 'budget', 'deliveryTime', 'deliveryDate', 'availability']
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
    @Param('contractAddress') contractAddress: string,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Body() body: UpdateMilestoneRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.projectsService.updateMilestone(contractAddress, milestoneId, body);
  }

  @Delete(':contractAddress/milestones/:milestoneId')
  @ApiOperation({ 
    summary: 'Delete milestone',
    description: 'Deletes a specific milestone'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the project',
    type: 'string'
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
    @Param('contractAddress') contractAddress: string,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    await this.projectsService.deleteMilestone(contractAddress, milestoneId);
    return { success: true, message: 'Milestone deleted successfully' };
  }
}
