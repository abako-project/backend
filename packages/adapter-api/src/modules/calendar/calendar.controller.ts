import { Controller, Get, Post, Body, Param, Query, Headers } from '@nestjs/common';
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
import { CalendarService } from './calendar.service';
import {
  SetAvailabilityRequest,
  RegisterWorkerRequest,
  RegisterWorkersRequest,
  AdminSetWorkerAvailabilityRequest,
} from './types';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided or invalid format');
    }
    return authHeader.split(' ')[1];
  }

  @Post(':contractAddress/register_worker')
  @ApiOperation({ 
    summary: 'Register a new worker',
    description: 'Registers a new worker in the calendar contract'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
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
        worker: { 
          type: 'string',
          description: 'AccountId of the worker to register',
          example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        }
      },
      required: ['worker']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Worker registered successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async registerWorker(
    @Param('contractAddress') contractAddress: string,
    @Body() body: RegisterWorkerRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.calendarService.registerWorker(contractAddress, body, token);
  }

  @Post(':contractAddress/set_availability')
  @ApiOperation({ 
    summary: 'Set worker availability',
    description: 'Worker sets their general availability level'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
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
        availability: { 
          description: 'Availability level',
          oneOf: [
            { type: 'string', enum: ['NotAvailable', 'PartTime', 'FullTime'] },
            { 
              type: 'object',
              properties: {
                WeeklyHours: { type: 'number', example: 20 }
              }
            }
          ],
          example: 'FullTime'
        }
      },
      required: ['availability']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Availability set successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token or worker not registered'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async setAvailability(
    @Param('contractAddress') contractAddress: string,
    @Body() body: SetAvailabilityRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.calendarService.setAvailability(contractAddress, body, token);
  }

  @Post(':contractAddress/register_workers')
  @ApiOperation({ 
    summary: 'Register multiple workers',
    description: 'Admin can register multiple workers at once'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
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
        workers: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Array of worker AccountIds to register',
          example: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty']
        }
      },
      required: ['workers']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Workers registered successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token or not admin'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async registerWorkers(
    @Param('contractAddress') contractAddress: string,
    @Body() body: RegisterWorkersRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.calendarService.registerWorkers(contractAddress, body, token);
  }

  @Post(':contractAddress/admin_set_worker_availability')
  @ApiOperation({ 
    summary: 'Admin set worker availability',
    description: 'Admin can set availability for a worker (useful for bulk operations)'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
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
        worker: { 
          type: 'string',
          description: 'AccountId of the worker',
          example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        },
        availability: { 
          description: 'Availability level',
          oneOf: [
            { type: 'string', enum: ['NotAvailable', 'PartTime', 'FullTime'] },
            { 
              type: 'object',
              properties: {
                WeeklyHours: { type: 'number', example: 20 }
              }
            }
          ],
          example: 'FullTime'
        }
      },
      required: ['worker', 'availability']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Worker availability set successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid token or not admin'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async adminSetWorkerAvailability(
    @Param('contractAddress') contractAddress: string,
    @Body() body: AdminSetWorkerAvailabilityRequest,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.calendarService.adminSetWorkerAvailability(contractAddress, body, token);
  }

  @Get(':contractAddress/get_availability_hours')
  @ApiOperation({ 
    summary: 'Get worker availability hours',
    description: "Retrieves a worker's general availability in hours"
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
    type: 'string'
  })
  @ApiQuery({ 
    name: 'worker', 
    description: 'AccountId of the worker',
    type: 'string',
    example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Worker availability hours retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Worker not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getAvailabilityHours(
    @Param('contractAddress') contractAddress: string,
    @Query('worker') worker: string
  ) {
    return await this.calendarService.getAvailabilityHours(contractAddress, worker);
  }

  @Get(':contractAddress/is_available')
  @ApiOperation({ 
    summary: 'Check if worker is available',
    description: 'Check if a worker is available with optional minimum hours filter'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
    type: 'string'
  })
  @ApiQuery({ 
    name: 'worker', 
    description: 'AccountId of the worker',
    type: 'string',
    example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
  })
  @ApiQuery({ 
    name: 'min_hours', 
    description: 'Minimum hours required (optional)',
    type: 'number',
    required: false,
    example: 20
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Worker availability status retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Worker not found'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async isAvailable(
    @Param('contractAddress') contractAddress: string,
    @Query('worker') worker: string,
    @Query('min_hours') minHours?: number
  ) {
    return await this.calendarService.isAvailable(contractAddress, worker, minHours);
  }

  @Get(':contractAddress/get_available_workers')
  @ApiOperation({ 
    summary: 'Get all available workers',
    description: 'Get all available workers with optional minimum hours filter'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
    type: 'string'
  })
  @ApiQuery({ 
    name: 'min_hours', 
    description: 'Minimum hours required (optional)',
    type: 'number',
    required: false,
    example: 20
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Available workers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          worker: { type: 'string' },
          hours: { type: 'number' }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getAvailableWorkers(
    @Param('contractAddress') contractAddress: string,
    @Query('min_hours') minHours?: number
  ) {
    return await this.calendarService.getAvailableWorkers(contractAddress, minHours);
  }

  @Get(':contractAddress/get_registered_workers')
  @ApiOperation({ 
    summary: 'Get all registered workers',
    description: 'Retrieves all registered workers in the calendar'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Registered workers retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'string' }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getRegisteredWorkers(@Param('contractAddress') contractAddress: string) {
    return await this.calendarService.getRegisteredWorkers(contractAddress);
  }

  @Get(':contractAddress/get_all_workers_availability')
  @ApiOperation({ 
    summary: 'Get all workers with their availability',
    description: 'Retrieves all registered workers with their availability hours'
  })
  @ApiParam({ 
    name: 'contractAddress', 
    description: 'The contract address of the calendar',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All workers availability retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          worker: { type: 'string' },
          hours: { type: 'number' }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error'
  })
  async getAllWorkersAvailability(@Param('contractAddress') contractAddress: string) {
    return await this.calendarService.getAllWorkersAvailability(contractAddress);
  }

  @Post('deploy/:version')
  @ApiOperation({ 
    summary: 'Deploy calendar contract',
    description: 'Deploys a new calendar contract with the specified version'
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
  @ApiResponse({ 
    status: 200, 
    description: 'Contract deployed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        address: { type: 'string' },
        inkVersion: { type: 'string' },
        contractType: { type: 'string' }
      }
    }
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
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return await this.calendarService.deployContract(version, token);
  }
}

