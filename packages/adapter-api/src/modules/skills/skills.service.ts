import {
  BadRequestException,
  HttpException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

export type RoleScopedSkill = {
  id: number;
  name: string;
  category: 'software' | 'soft';
  roleIds: number[];
};

export type CatalogSkill = Omit<RoleScopedSkill, 'roleIds'>;

export type UserQualifications = {
  skillIds: number[];
  roleIds: number[];
};

@Injectable()
export class SkillsService {
  constructor(private readonly configService: ConfigService) {}

  normalize(names: string[]): string[] {
    return [...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))];
  }

  async resolveReferences(
    references: Array<number | string> | number | string,
    mockUserId?: string,
    roleIds?: number[],
  ): Promise<number[]> {
    this.requireMockProvider();
    const values = Array.isArray(references) ? references : [references];
    const ids: number[] = [];
    const names: string[] = [];
    for (const value of values) {
      if (typeof value === 'number') {
        if (!Number.isInteger(value) || value <= 0) {
          throw new BadRequestException('Skill IDs must be positive integers');
        }
        ids.push(value);
        continue;
      }
      if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestException('Skills must contain IDs or non-empty names');
      }
      const normalized = value.trim();
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) {
        if (!Number.isInteger(numeric) || numeric <= 0) {
          throw new BadRequestException('Skill IDs must be positive integers');
        }
        ids.push(numeric);
      } else {
        names.push(normalized);
      }
    }
    return this.resolveMockReferences(ids, this.normalize(names), mockUserId, roleIds);
  }

  async validateIds(ids: number[]): Promise<number[]> {
    return this.resolveReferences(ids);
  }

  async createWithRoles(
    name: string,
    category: 'software' | 'soft' | undefined,
    roleIds: number[],
  ): Promise<RoleScopedSkill> {
    this.requireMockProvider();
    const { skill } = await this.mockRequest<{ skill: RoleScopedSkill }>('/mock/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, roleIds }),
    });
    return skill;
  }

  async findIds(roleId?: string): Promise<number[]> {
    this.requireMockProvider();
    const parsedRoleId = roleId === undefined ? undefined : this.positiveInteger(roleId, 'roleId');
    const suffix = parsedRoleId === undefined ? '' : `?roleId=${parsedRoleId}`;
    return (await this.mockRequest<{ skillIds: number[] }>(`/mock/skills/ids${suffix}`)).skillIds;
  }

  async findNameById(value: string): Promise<string> {
    this.requireMockProvider();
    const id = this.positiveInteger(value, 'skillId');
    return (await this.mockRequest<{ skill: RoleScopedSkill }>(`/mock/skills/${id}`)).skill.name;
  }

  async validateRoleId(value: unknown): Promise<number> {
    this.requireMockProvider();
    const roleId = this.positiveInteger(value, 'roleId');
    const response = await fetch(`${this.configService.getFederateServer()}/roles/${roleId}`);
    if (response.status === 404) throw new BadRequestException('roleId does not exist');
    if (!response.ok) throw new HttpException('Failed to validate roleId', response.status);
    return roleId;
  }

  async findAll(): Promise<CatalogSkill[]> {
    this.requireMockProvider();
    return (await this.mockRequest<{ skills: CatalogSkill[] }>('/mock/skills')).skills;
  }

  async getUserQualifications(userId: string): Promise<UserQualifications> {
    this.requireMockProvider();
    return this.mockRequest(`/mock/users/${encodeURIComponent(userId)}/qualifications`);
  }

  async replaceUserQualifications(
    userId: string,
    skillIds: number[],
    roleIds: number[],
  ): Promise<UserQualifications> {
    this.requireMockProvider();
    return this.mockRequest(`/mock/users/${encodeURIComponent(userId)}/qualifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillIds, roleIds }),
    });
  }

  private requireMockProvider(): void {
    if (process.env.USE_MOCK_AUTH !== 'true') {
      throw new NotImplementedException(
        'Skill and role providers are unavailable until the production smart contract is implemented',
      );
    }
  }

  private async resolveMockReferences(
    ids: number[],
    names: string[],
    userId?: string,
    submittedRoleIds?: number[],
  ): Promise<number[]> {
    const { skills } = await this.mockRequest<{ skills: CatalogSkill[] }>('/mock/skills');
    const byId = new Map(skills.map((skill) => [skill.id, skill]));
    const byName = new Map(skills.map((skill) => [skill.name, skill]));
    const missingNames = names.filter((name) => !byName.has(name));
    if (missingNames.length > 0) {
      const roleIds = submittedRoleIds ?? await this.getMockUserRoleIds(userId);
      for (const name of missingNames) {
        const skill = await this.createWithRoles(name, 'software', roleIds);
        byId.set(skill.id, skill);
        byName.set(skill.name, skill);
      }
    }
    const referenced = [
      ...ids.map((id) => byId.get(id)),
      ...names.map((name) => byName.get(name)),
    ];
    if (referenced.some((skill) => !skill)) {
      throw new BadRequestException('One or more skill IDs do not exist');
    }
    return [...new Set((referenced as CatalogSkill[]).map((skill) => skill.id))]
      .sort((a, b) => a - b);
  }

  private async getMockUserRoleIds(userId?: string): Promise<number[]> {
    if (!userId) {
      throw new BadRequestException('A profile user is required to create uncataloged mock skills');
    }
    const response = await fetch(
      `${this.configService.getFederateServer()}/users/${encodeURIComponent(userId)}/roles`,
    );
    const body = await response.json() as { roles?: Array<{ id: number }>; error?: string };
    if (!response.ok) throw new HttpException(body.error || 'Failed to read profile roles', response.status);
    const roleIds = body.roles?.map((role) => role.id) || [];
    if (roleIds.length === 0) {
      throw new BadRequestException('Profile user must have a mock role before creating skills');
    }
    return roleIds;
  }

  private positiveInteger(value: unknown, field: string): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return parsed;
  }

  private async mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.configService.getSigningServiceUrl()}${path}`, init);
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new HttpException(body.error || 'Mock skill request failed', response.status);
    return body;
  }
}
