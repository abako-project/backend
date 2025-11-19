import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DevelopersService } from './developers.service';
import { CreateDeveloperRequest, UpdateDeveloperRequest } from './types';

@ApiTags('developers')
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create developer profile',
    description: 'Creates a new developer profile with user account. Requires: profile image, name, email, github username, and optional portfolio.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'developer@example.com' },
        name: { type: 'string', example: 'Jane Smith' },
        githubUsername: { type: 'string', example: 'janesmith' },
        portfolioUrl: { type: 'string', example: 'https://portfolio.com' },
        image: { type: 'string', format: 'binary', description: 'Profile image' }
      },
      required: ['email', 'name', 'githubUsername']
    }
  })
  @ApiResponse({ status: 201, description: 'Developer created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() body: CreateDeveloperRequest,
    @UploadedFile() file?: any,
  ) {
    const developer = await this.developersService.create(body);

    if (file) {
      await this.developersService.updateImage(
        developer.id!,
        file.buffer,
        file.mimetype,
      );
    }

    return {
      message: 'Developer profile created successfully',
      developerId: developer.id,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all developers' })
  @ApiResponse({ status: 200, description: 'List of all developers' })
  async findAll() {
    const developers = await this.developersService.findAll();
    return { developers };
  }

  @Get(':developerId')
  @ApiOperation({ summary: 'Get a specific developer by ID' })
  @ApiResponse({ status: 200, description: 'Developer details' })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async findOne(@Param('developerId', ParseIntPipe) developerId: number) {
    const developer = await this.developersService.getWithRelations(developerId);
    return { developer };
  }

  @Put(':developerId')
  @ApiOperation({ 
    summary: 'Update developer profile',
    description: 'Updates developer profile with additional information: bio, background, role, skills, spoken languages, location, and availability.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Jane Smith' },
        email: { type: 'string', format: 'email', example: 'developer@example.com' },
        githubUsername: { type: 'string', example: 'janesmith' },
        portfolioUrl: { type: 'string', example: 'https://portfolio.com' },
        bio: { type: 'string', example: 'Experienced full-stack developer' },
        background: { type: 'string', example: '5 years of experience in web development' },
        role: { type: 'string', enum: ['junior', 'mid-level', 'senior'], example: 'mid-level' },
        location: { type: 'string', example: 'San Francisco, USA' },
        availability: { type: 'string', enum: ['NotAvailable', 'PartTime', 'FullTime', 'WeeklyHours'], example: 'FullTime' },
        languages: { type: 'array', items: { type: 'string' }, example: ['1', '2'] },
        skills: { type: 'array', items: { type: 'string' }, example: ['1', '2', '3'] },
        availableHoursPerWeek: { type: 'number', example: 40 },
        image: { type: 'string', format: 'binary', description: 'Profile image' }
      },
      required: ['name', 'email', 'githubUsername', 'bio', 'background', 'role', 'location', 'availability', 'languages', 'skills']
    }
  })
  @ApiResponse({ status: 200, description: 'Developer updated successfully' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('developerId', ParseIntPipe) developerId: number,
    @Body() updateData: UpdateDeveloperRequest,
    @UploadedFile() file?: any,
  ) {
    const developer = await this.developersService.update(developerId, updateData);

    if (file) {
      await this.developersService.updateImage(
        developerId,
        file.buffer,
        file.mimetype,
      );
    }

    return {
      message: 'Developer updated successfully',
      developerId: developer.id,
    };
  }

  @Get(':developerId/attachment')
  @ApiOperation({ summary: 'Get developer profile image' })
  @ApiResponse({ status: 200, description: 'Developer image' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getAttachment(
    @Param('developerId', ParseIntPipe) developerId: number,
    @Res() res: Response,
  ) {
    const { data, mimeType } = await this.developersService.getImage(developerId);
    res.set('Content-Type', mimeType);
    res.send(data);
  }

  @Get(':developerId/projects')
  @ApiOperation({ summary: 'Get all projects for a developer (as consultant)' })
  @ApiResponse({ status: 200, description: 'List of developer projects' })
  async getProjects(@Param('developerId', ParseIntPipe) developerId: number) {
    const projects = await this.developersService.getProjects(developerId);
    return { projects };
  }

  @Get(':developerId/milestones')
  @ApiOperation({ summary: 'Get all milestones assigned to a developer' })
  @ApiResponse({ status: 200, description: 'List of developer milestones with project info' })
  async getMilestones(@Param('developerId', ParseIntPipe) developerId: number) {
    const milestones = await this.developersService.getMilestones(developerId);
    return { milestones };
  }
}

