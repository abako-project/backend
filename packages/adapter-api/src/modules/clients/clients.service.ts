import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../database/entities/client.entity';
import { Project } from '../../database/entities/project.entity';
import { CreateClientRequest, UpdateClientRequest } from './types';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
  ) {}

  async findAll(): Promise<Client[]> {
    return this.clientRepo.find();
  }

  async findOne(clientId: number): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }
    return client;
  }

  async findByEmail(email: string): Promise<Client | null> {
    return this.clientRepo.findOne({ where: { email } });
  }

  async create(data: CreateClientRequest): Promise<Client> {
    try {
      const newClient = this.clientRepo.create({
        name: data.name,
        email: data.email,
        company: data.company,
        department: data.department,
        website: data.website,
        description: data.description,
        location: data.location,
        languages: data.languages || [],
      });
      return await this.clientRepo.save(newClient);
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT_NOTNULL' || error?.driverError?.code === 'SQLITE_CONSTRAINT_NOTNULL') {
        throw new BadRequestException('Missing required fields');
      }
      throw error;
    }
  }

  async update(
    clientId: number,
    updateData: UpdateClientRequest,
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    if (updateData.name !== undefined) client.name = updateData.name;
    if (updateData.company !== undefined) client.company = updateData.company;
    if (updateData.department !== undefined) client.department = updateData.department;
    if (updateData.website !== undefined) client.website = updateData.website;
    if (updateData.description !== undefined) client.description = updateData.description;
    if (updateData.location !== undefined) client.location = updateData.location;
    if (updateData.languages !== undefined) client.languages = updateData.languages;

    return this.clientRepo.save(client);
  }

  async updateImage(
    clientId: number,
    imageData: Buffer,
    mimeType: string,
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    client.imageData = imageData;
    client.imageMimeType = mimeType;
    return this.clientRepo.save(client);
  }

  async getImage(clientId: number): Promise<{ data: Buffer; mimeType: string }> {
    const client = await this.findOne(clientId);
    if (!client.imageData) {
      throw new NotFoundException(`Client ${clientId} has no image`);
    }
    return {
      data: client.imageData,
      mimeType: client.imageMimeType || 'image/png',
    };
  }

  async getProjects(clientId: number): Promise<Project[]> {
    return this.projectRepo.find({ where: { clientId: clientId.toString() } });
  }

  async getWithRelations(clientId: number): Promise<any> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const projects = await this.projectRepo.find({ where: { clientId: clientId.toString() } });
    const projectNames = projects.map(p => p.title);

    return {
      ...client,
      projects: projectNames,
    };
  }
}
