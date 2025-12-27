import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from '../../database/schemas/client.schema';
import { Project, ProjectDocument } from '../../database/schemas/project.schema';
import { CreateClientRequest, UpdateClientRequest } from './types';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async findAll(): Promise<Client[]> {
    return this.clientModel.find().exec();
  }

  async findOne(clientId: number): Promise<Client> {
    const client = await this.clientModel.findOne({ id: clientId }).exec();
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }
    return client;
  }

  async findByEmail(email: string): Promise<Client | null> {
    return this.clientModel.findOne({ email }).exec();
  }

  async create(data: CreateClientRequest): Promise<Client> {
    try {
      const newClient = new this.clientModel({
        name: data.name,
        email: data.email,
        company: data.company,
        department: data.department,
        website: data.website,
        description: data.description,
        location: data.location,
        languages: data.languages || [],
      });
      return await newClient.save();
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        throw new BadRequestException(messages.join(', '));
      }
      throw error;
    }
  }

  async update(
    clientId: number,
    updateData: UpdateClientRequest,
  ): Promise<ClientDocument> {
    const client = await this.clientModel.findOne({ id: clientId }).exec();
    
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    try {
      if (updateData.name !== undefined) client.name = updateData.name;
      if (updateData.company !== undefined) client.company = updateData.company;
      if (updateData.department !== undefined) client.department = updateData.department;
      if (updateData.website !== undefined) client.website = updateData.website;
      if (updateData.description !== undefined) client.description = updateData.description;
      if (updateData.location !== undefined) client.location = updateData.location;
      if (updateData.languages !== undefined) client.languages = updateData.languages;

      return await client.save();
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        throw new BadRequestException(messages.join(', '));
      }
      throw error;
    }
  }

  async updateImage(
    clientId: number,
    imageData: Buffer,
    mimeType: string,
  ): Promise<ClientDocument> {
    const client = await this.clientModel.findOne({ id: clientId }).exec();
    
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }
    
    client.imageData = imageData;
    client.imageMimeType = mimeType;
    return client.save();
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
    return this.projectModel.find({ clientId }).exec();
  }

  async getWithRelations(clientId: number): Promise<any> {
    const client = await this.clientModel.findOne({ id: clientId }).exec();
    
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }
    
    const projects = await this.projectModel.find({ clientId }).exec();
    const projectNames = projects.map(p => p.title);

    return {
      ...client.toObject(),
      projects: projectNames,
    };
  }
}

