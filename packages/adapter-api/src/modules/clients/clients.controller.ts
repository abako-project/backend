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
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientRequest, UpdateClientRequest } from './types';


@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create client profile',
    description: 'Creates a new client profile with user account. Requires: image (profile), company name, name, department, company website, description, and location.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'client@example.com' },
        name: { type: 'string', example: 'John Doe' },
        company: { type: 'string', example: 'Acme Corp' },
        department: { type: 'string', example: 'Engineering' },
        website: { type: 'string', example: 'https://acme.com' },
        description: { type: 'string', example: 'Leading tech company' },
        location: { type: 'string', example: 'New York, USA' },
        image: { type: 'string', format: 'binary', description: 'Profile image' }
      },
      required: ['email', 'name', 'company', 'department', 'website', 'description', 'location']
    }
  })
  @ApiResponse({ status: 201, description: 'Client created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() body: CreateClientRequest,
    @UploadedFile() file?: any,
  ) {
    const client = await this.clientsService.create(body);

    if (file) {
      await this.clientsService.updateImage(
        client.id!,
        file.buffer,
        file.mimetype,
      );
    }

    return {
      message: 'Client profile created successfully',
      clientId: client.id,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all clients' })
  @ApiResponse({ status: 200, description: 'List of all clients' })
  async findAll() {
    const clients = await this.clientsService.findAll();
    return { clients };
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Get a specific client by ID' })
  @ApiResponse({ status: 200, description: 'Client details' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findOne(@Param('clientId', ParseIntPipe) clientId: number) {
    const client = await this.clientsService.getWithRelations(clientId);
    return { client };
  }

  @Put(':clientId')
  @ApiOperation({ 
    summary: 'Update client profile',
    description: 'Updates client profile with additional information.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'client@example.com' },
        name: { type: 'string', example: 'John Doe' },
        company: { type: 'string', example: 'Acme Corp' },
        department: { type: 'string', example: 'Engineering' },
        website: { type: 'string', example: 'https://acme.com' },
        description: { type: 'string', example: 'Leading tech company' },
        location: { type: 'string', example: 'New York, USA' },
        image: { type: 'string', format: 'binary', description: 'Profile image' }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Client updated successfully' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() updateData: UpdateClientRequest,
    @UploadedFile() file?: any,
  ) {
    const client = await this.clientsService.update(clientId, updateData);

    if (file) {
      await this.clientsService.updateImage(
        clientId,
        file.buffer,
        file.mimetype,
      );
    }

    return {
      message: 'Client updated successfully',
      clientId: client.id,
    };
  }

  @Get(':clientId/attachment')
  @ApiOperation({ summary: 'Get client profile image' })
  @ApiResponse({ status: 200, description: 'Client image' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getAttachment(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Res() res: Response,
  ) {
    const { data, mimeType } = await this.clientsService.getImage(clientId);
    res.set('Content-Type', mimeType);
    res.send(data);
  }

  @Get(':clientId/projects')
  @ApiOperation({ summary: 'Get all projects for a client' })
  @ApiResponse({ status: 200, description: 'List of client projects' })
  async getProjects(@Param('clientId', ParseIntPipe) clientId: number) {
    const projects = await this.clientsService.getProjects(clientId);
    return { projects };
  }
}

