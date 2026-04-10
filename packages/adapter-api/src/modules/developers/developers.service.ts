import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Developer } from '../../database/entities/developer.entity';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { CreateDeveloperRequest, UpdateDeveloperRequest } from './types';

@Injectable()
export class DevelopersService {
  constructor(
    @InjectRepository(Developer) private developerRepo: Repository<Developer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
  ) {}

  async findAll(): Promise<Developer[]> {
    return this.developerRepo.find();
  }

  async findOne(developerId: number): Promise<Developer> {
    const developer = await this.developerRepo.findOne({ where: { id: developerId } });
    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }
    return developer;
  }

  async findByEmail(email: string): Promise<Developer | null> {
    return this.developerRepo.findOne({ where: { email } });
  }

  async create(data: CreateDeveloperRequest): Promise<Developer> {
    try {
      const newDeveloper = this.developerRepo.create({
        email: data.email,
        name: data.name,
        githubUsername: data.githubUsername,
        portfolioUrl: data.portfolioUrl,
        availability: 'NotAvailable',
        languages: [],
        skills: [],
      });
      return await this.developerRepo.save(newDeveloper);
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT_NOTNULL' || error?.driverError?.code === 'SQLITE_CONSTRAINT_NOTNULL') {
        throw new BadRequestException('Missing required fields');
      }
      throw error;
    }
  }

  async update(
    developerId: number,
    updateData: UpdateDeveloperRequest,
  ): Promise<Developer> {
    const developer = await this.developerRepo.findOne({ where: { id: developerId } });

    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }

    developer.name = updateData.name;
    developer.githubUsername = updateData.githubUsername;
    if (updateData.portfolioUrl !== undefined) developer.portfolioUrl = updateData.portfolioUrl;
    developer.bio = updateData.bio;
    developer.background = updateData.background;
    developer.proficiency = updateData.proficiency;
    if (updateData.role !== undefined) developer.role = updateData.role;
    developer.location = updateData.location;
    developer.availability = updateData.availability;
    developer.languages = updateData.languages;
    developer.skills = updateData.skills;
    if (updateData.availableHoursPerWeek !== undefined) developer.availableHoursPerWeek = updateData.availableHoursPerWeek;

    return this.developerRepo.save(developer);
  }

  async updateImage(
    developerId: number,
    imageData: Buffer,
    mimeType: string,
  ): Promise<Developer> {
    const developer = await this.developerRepo.findOne({ where: { id: developerId } });

    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }

    developer.imageData = imageData;
    developer.imageMimeType = mimeType;
    return this.developerRepo.save(developer);
  }

  async getImage(developerId: number): Promise<{ data: Buffer; mimeType: string }> {
    const developer = await this.findOne(developerId);
    if (!developer.imageData) {
      throw new NotFoundException(`Developer ${developerId} has no image`);
    }
    return {
      data: developer.imageData,
      mimeType: developer.imageMimeType || 'image/png',
    };
  }

  async getProjects(developerId: number): Promise<Project[]> {
    return this.projectRepo.find({ where: { consultantId: developerId.toString() } });
  }

  async getMilestones(developerId: number): Promise<any[]> {
    const milestones = await this.milestoneRepo.find({ where: { developerId } });

    const contractAddresses = [...new Set(milestones.map(m => m.contractAddress))];
    const projects = contractAddresses.length > 0
      ? await this.projectRepo.find({ where: { contractAddress: In(contractAddresses) } })
      : [];

    const projectMap = new Map(projects.map(p => [p.contractAddress, p]));

    return milestones.map(milestone => ({
      ...milestone,
      project: projectMap.get(milestone.contractAddress),
    }));
  }

  async getWithRelations(developerId: number): Promise<any> {
    const developer = await this.developerRepo.findOne({ where: { id: developerId } });

    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }

    const consultantProjects = await this.projectRepo.find({
      where: { consultantId: developerId.toString() },
    });
    const projectNames = consultantProjects.map(p => p.title);

    return {
      ...developer,
      consultantProjects: projectNames,
    };
  }
}
