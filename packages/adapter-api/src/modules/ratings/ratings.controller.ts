import {
  Controller,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { 
  RatingResponse, 
  DeveloperRatingsResponse, 
  ClientRatingsResponse 
} from './types';

@ApiTags('ratings')
@Controller({ path: 'ratings', version: '1' })
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('client/:clientId')
  @ApiOperation({ 
    summary: 'Get ratings given by a specific client',
    description: 'Returns all ratings that a specific client has given to developers'
  })
  @ApiParam({ 
    name: 'clientId', 
    description: 'The ID of the client',
    example: '507f1f77bcf86cd799439012'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Ratings given by the client',
    type: ClientRatingsResponse
  })
  async getRatingsByClient(@Param('clientId') clientId: string) {
    const result = await this.ratingsService.getRatingsByClient(clientId);
    return result;
  }

  @Get('developer/:developerId')
  @ApiOperation({ 
    summary: 'Get ratings received by a specific developer',
    description: 'Returns all ratings that a specific developer has received, including average rating'
  })
  @ApiParam({ 
    name: 'developerId', 
    description: 'The ID of the developer',
    example: '507f1f77bcf86cd799439013'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Ratings received by the developer',
    type: DeveloperRatingsResponse
  })
  async getRatingsByDeveloper(@Param('developerId') developerId: string) {
    const result = await this.ratingsService.getRatingsByDeveloper(developerId);
    return result;
  }

  @Get('project/:projectId')
  @ApiOperation({ 
    summary: 'Get all ratings for a specific project',
    description: 'Returns all ratings associated with a specific project'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'The ID of the project',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Ratings for the project',
    type: [RatingResponse]
  })
  async getRatingsByProject(@Param('projectId') projectId: string) {
    const ratings = await this.ratingsService.getRatingsByProject(projectId);
    return { ratings };
  }
}

