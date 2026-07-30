import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Developer } from '../../database/entities/developer.entity';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { MilestoneAssignment } from '../../database/entities/milestone-assignment.entity';
import { CreateDeveloperRequest, UpdateDeveloperRequest } from './types';
import { SkillsService } from '../skills/skills.service';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';

type DeveloperProfile = Developer & {
  skills: number[];
  roleIds: number[];
};

@Injectable()
export class DevelopersService {
  constructor(
    @InjectRepository(Developer) private developerRepo: Repository<Developer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
    @InjectRepository(MilestoneAssignment) private milestoneAssignmentRepo: Repository<MilestoneAssignment>,
    private readonly skillsService: SkillsService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async findAll(): Promise<DeveloperProfile[]> {
    const developers = await this.developerRepo.find();
    return Promise.all(developers.map((developer) => this.withQualifications(developer)));
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

  async findByUserIdentifier(identifier: string): Promise<Developer | null> {
    return this.developerRepo.findOne({
      where: [
        { userId: identifier },
        { email: identifier },
      ],
    });
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  async create(data: CreateDeveloperRequest): Promise<Developer> {
    try {
      const email = this.normalizeOptionalText(data.email);
      const userId = this.normalizeOptionalText(data.userId) ?? email;

      if (!userId) {
        throw new BadRequestException('Missing required field: userId or email');
      }

      const newDeveloper = this.developerRepo.create({
        userId,
        email,
        name: data.name,
        githubUsername: data.githubUsername,
        portfolioUrl: data.portfolioUrl,
        availability: 'NotAvailable',
        languages: [],
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
    authToken: string,
  ): Promise<Developer> {
    const developer = await this.developerRepo.findOne({ where: { id: developerId } });

    if (!developer) {
      throw new NotFoundException(`Developer with id ${developerId} not found`);
    }

    const userId = developer.userId ?? developer.email;
    if (!userId) {
      throw new BadRequestException('Developer must have either userId or email');
    }
    await this.assertProfileOwner(userId, authToken);

    if (
      updateData.userId !== undefined
      && this.normalizeOptionalText(updateData.userId) !== developer.userId
    ) {
      throw new BadRequestException('userId cannot be changed through profile update');
    }
    if (updateData.email !== undefined) developer.email = this.normalizeOptionalText(updateData.email);
    developer.name = updateData.name;
    developer.githubUsername = updateData.githubUsername;
    if (updateData.portfolioUrl !== undefined) developer.portfolioUrl = updateData.portfolioUrl;
    developer.bio = updateData.bio;
    developer.background = updateData.background;
    developer.proficiency = updateData.proficiency;
    developer.location = updateData.location;
    developer.availability = updateData.availability;
    developer.languages = updateData.languages;
    if (updateData.availableHoursPerWeek !== undefined) developer.availableHoursPerWeek = updateData.availableHoursPerWeek;

    const roleIds = this.normalizeRoleIds(updateData.roleIds);
    const skillIds = await this.skillsService.resolveReferences(
      updateData.skills,
      userId,
      roleIds,
    );
    await this.skillsService.replaceUserQualifications(userId, skillIds, roleIds);

    return this.developerRepo.save(developer);
  }

  async updateCoordinatorEligibility(
    developerId: number,
    isCoordinator: boolean,
  ): Promise<{ id: number; isCoordinator: boolean }> {
    const developer = await this.findOne(developerId);
    if (process.env.USE_MOCK_AUTH !== 'true') {
      throw new NotImplementedException(
        'Coordinator authorization is not implemented outside mock mode',
      );
    }

    const userId = developer.userId ?? developer.email;
    if (!userId) {
      throw new BadRequestException('Developer has no user identifier');
    }

    const response = await fetch(
      `${this.configService.getFederateServer()}/users/${encodeURIComponent(userId)}/coordinator`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: Boolean(isCoordinator) }),
      },
    );
    const result = await response.json() as {
      error?: string;
      roles?: Array<{ id: number }>;
    };
    if (!response.ok) {
      throw new BadRequestException(result.error ?? 'Failed to update coordinator role');
    }

    return {
      id: developer.id,
      isCoordinator: result.roles?.some(({ id }) => id === 1) ?? false,
    };
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
    const assignments = await this.milestoneAssignmentRepo.find({ where: { developerId } });
    const assignedMilestoneIds = assignments.map((assignment) => assignment.milestoneId);
    const milestones = assignedMilestoneIds.length > 0
      ? await this.milestoneRepo.find({
          where: [
            { developerId },
            { id: In(assignedMilestoneIds) },
          ],
        })
      : await this.milestoneRepo.find({ where: { developerId } });

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
      ...await this.withQualifications(developer),
      consultantProjects: projectNames,
    };
  }

  private async withQualifications(developer: Developer): Promise<DeveloperProfile> {
    const userId = developer.userId ?? developer.email;
    if (!userId) {
      throw new BadRequestException('Developer has no user identifier');
    }
    const { skillIds, roleIds } = await this.skillsService.getUserQualifications(userId);
    return {
      ...developer,
      skills: skillIds,
      roleIds,
    };
  }

  private normalizeRoleIds(values: number[] | number): number[] {
    const roleIds = (Array.isArray(values) ? values : [values]).map(Number);
    if (
      roleIds.length === 0
      || roleIds.some((roleId) => !Number.isInteger(roleId) || roleId <= 0)
      || new Set(roleIds).size !== roleIds.length
    ) {
      throw new BadRequestException('roleIds must contain unique positive integers');
    }
    return roleIds.sort((a, b) => a - b);
  }

  private async assertProfileOwner(userId: string, authToken: string): Promise<void> {
    let authenticatedUserId: string;
    try {
      authenticatedUserId = await this.authService.getUserIdFromToken(authToken);
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
    if (authenticatedUserId !== userId) {
      throw new ForbiddenException('Cannot update another user profile');
    }
  }
}
