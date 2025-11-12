import {
  Controller,
  Get,
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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DevelopersService } from './developers.service';
import { UpdateDeveloperRequest } from '../../types';

@ApiTags('developers')
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

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
  @ApiOperation({ summary: 'Update developer profile' })
  @ApiResponse({ status: 200, description: 'Developer updated successfully' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('developerId', ParseIntPipe) developerId: number,
    @Body() updateData: UpdateDeveloperRequest,
    @UploadedFile() file?: Express.Multer.File,
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

