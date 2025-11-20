import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Developer, DeveloperDocument } from '../../database/schemas/developer.schema';
import { Project, ProjectDocument } from '../../database/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../../database/schemas/milestone.schema';
import { CreateDeveloperRequest, UpdateDeveloperRequest } from './types';

@Injectable()
export class DevelopersService {
  constructor(
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
  ) {}

  async findAll(): Promise<Developer[]> {
    return this.developerModel.find().exec();
  }

  async findOne(developerId: number): Promise<Developer> {
    const developer = await this.developerModel.findOne({ id: developerId }).exec();
    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }
    return developer;
  }

  async findByEmail(email: string): Promise<Developer | null> {
    return this.developerModel.findOne({ email }).exec();
  }

  async create(data: CreateDeveloperRequest): Promise<Developer> {
    const newDeveloper = new this.developerModel({
      email: data.email,
      name: data.name,
      githubUsername: data.githubUsername,
      portfolioUrl: data.portfolioUrl,
      bio: '',
      background: '',
      role: 'junior',
      location: '',
      availability: 'NotAvailable',
      languages: [],
      skills: [],
    });
    return newDeveloper.save();
  }

  async update(
    developerId: number,
    updateData: UpdateDeveloperRequest,
  ): Promise<DeveloperDocument> {
    const developer = await this.developerModel.findOne({ id: developerId }).exec();
    
    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }

    developer.name = updateData.name;
    developer.email = updateData.email;
    developer.githubUsername = updateData.githubUsername;
    if (updateData.portfolioUrl !== undefined) developer.portfolioUrl = updateData.portfolioUrl;
    developer.bio = updateData.bio;
    developer.background = updateData.background;
    developer.role = updateData.role;
    developer.location = updateData.location;
    developer.availability = updateData.availability;
    developer.languages = updateData.languages;
    developer.skills = updateData.skills;
    if (updateData.availableHoursPerWeek !== undefined) developer.availableHoursPerWeek = updateData.availableHoursPerWeek;

    return developer.save();
  }

  async updateImage(
    developerId: number,
    imageData: Buffer,
    mimeType: string,
  ): Promise<DeveloperDocument> {
    const developer = await this.developerModel.findOne({ id: developerId }).exec();
    
    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }
    
    developer.imageData = imageData;
    developer.imageMimeType = mimeType;
    return developer.save();
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
    return this.projectModel.find({ consultantId: developerId }).exec();
  }

  async getMilestones(developerId: number): Promise<any[]> {
    const milestones = await this.milestoneModel
      .find({ developerId })
      .exec();

    // Get projects for each milestone
    const projectIds = [...new Set(milestones.map(m => m.projectId))];
    const projects = await this.projectModel
      .find({ id: { $in: projectIds } })
      .exec();

    const projectMap = new Map(projects.map(p => [p.id, p]));

    return milestones.map(milestone => ({
      ...milestone.toObject(),
      project: projectMap.get(milestone.projectId),
    }));
  }

  async getWithRelations(developerId: number): Promise<any> {
    const developer = await this.developerModel.findOne({ id: developerId }).exec();
    
    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }
    
    const consultantProjects = await this.projectModel
      .find({ consultantId: developerId })
      .exec();
    const projectNames = consultantProjects.map(p => p.title);

    return {
      ...developer.toObject(),
      consultantProjects: projectNames,
    };
  }
}

