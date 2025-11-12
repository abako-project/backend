import {
  Controller,
  Get,
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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { UpdateClientRequest } from '../../types';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

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
  @ApiOperation({ summary: 'Update client profile' })
  @ApiResponse({ status: 200, description: 'Client updated successfully' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() updateData: UpdateClientRequest,
    @UploadedFile() file?: Express.Multer.File,
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

