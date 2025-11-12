import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Developer, DeveloperDocument } from '../../database/schemas/developer.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Project, ProjectDocument } from '../../database/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../../database/schemas/milestone.schema';
import { UpdateDeveloperRequest } from '../../types';

@Injectable()
export class DevelopersService {
  constructor(
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  async findByUserId(userId: number): Promise<Developer | null> {
    return this.developerModel.findOne({ userId }).exec();
  }

  async create(userId: number, name: string): Promise<Developer> {
    const newDeveloper = new this.developerModel({
      userId,
      name,
      languages: [],
      skills: [],
      isAvailableForHire: false,
      isAvailableFullTime: false,
      isAvailablePartTime: false,
      isAvailableHourly: false,
    });
    return newDeveloper.save();
  }

  async update(
    developerId: number,
    updateData: UpdateDeveloperRequest,
  ): Promise<Developer> {
    const developer = await this.findOne(developerId);

    if (updateData.name) developer.name = updateData.name;
    if (updateData.bio !== undefined) developer.bio = updateData.bio;
    if (updateData.background !== undefined) developer.background = updateData.background;
    if (updateData.roleId !== undefined) developer.roleId = updateData.roleId;
    if (updateData.proficiencyId !== undefined) developer.proficiencyId = updateData.proficiencyId;
    if (updateData.githubUsername !== undefined) developer.githubUsername = updateData.githubUsername;
    if (updateData.portfolioUrl !== undefined) developer.portfolioUrl = updateData.portfolioUrl;
    if (updateData.location !== undefined) developer.location = updateData.location;
    if (updateData.availability !== undefined) developer.availability = updateData.availability;
    if (updateData.languages !== undefined) developer.languages = updateData.languages;
    if (updateData.skills !== undefined) developer.skills = updateData.skills;
    if (updateData.isAvailableForHire !== undefined) developer.isAvailableForHire = updateData.isAvailableForHire;
    if (updateData.isAvailableFullTime !== undefined) developer.isAvailableFullTime = updateData.isAvailableFullTime;
    if (updateData.isAvailablePartTime !== undefined) developer.isAvailablePartTime = updateData.isAvailablePartTime;
    if (updateData.isAvailableHourly !== undefined) developer.isAvailableHourly = updateData.isAvailableHourly;
    if (updateData.availableHoursPerWeek !== undefined) developer.availableHoursPerWeek = updateData.availableHoursPerWeek;

    return developer.save();
  }

  async updateImage(
    developerId: number,
    imageData: Buffer,
    mimeType: string,
  ): Promise<Developer> {
    const developer = await this.findOne(developerId);
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
    const developer = await this.findOne(developerId);
    const user = await this.userModel.findOne({ id: developer.userId }).exec();
    const consultantProjects = await this.projectModel
      .find({ consultantId: developerId })
      .exec();
    const projectNames = consultantProjects.map(p => p.title);

    return {
      ...developer.toObject(),
      user,
      consultantProjects: projectNames,
    };
  }
}

