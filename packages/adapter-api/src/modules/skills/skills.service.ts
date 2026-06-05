import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Skill } from '../../database/entities/skill.entity';

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill) private readonly skillRepo: Repository<Skill>,
  ) {}

  normalize(names: string[]): string[] {
    return [...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))];
  }

  async ensure(
    names: string[],
    category: 'software' | 'soft' = 'software',
  ): Promise<string[]> {
    const normalized = this.normalize(names);
    for (const name of normalized) {
      const existing = await this.skillRepo.findOne({ where: { name } });
      if (!existing) {
        await this.skillRepo.save(this.skillRepo.create({ name, category }));
      }
    }
    return normalized;
  }

  async resolveReferences(references: Array<number | string>): Promise<number[]> {
    const ids = [...new Set(references.filter((value): value is number => (
      typeof value === 'number' && Number.isInteger(value) && value > 0
    )))];
    const names = references.filter((value): value is string => typeof value === 'string');
    const normalizedNames = this.normalize(names);

    if (ids.length > 0) {
      const existing = await this.skillRepo.findBy({ id: In(ids) });
      if (existing.length !== ids.length) {
        throw new BadRequestException('One or more skill IDs do not exist');
      }
    }

    for (const name of normalizedNames) {
      await this.create(name, 'software');
    }
    const namedSkills = normalizedNames.length > 0
      ? await this.skillRepo.findBy({ name: In(normalizedNames) })
      : [];
    return [...new Set([...ids, ...namedSkills.map((skill) => skill.id)])].sort((a, b) => a - b);
  }

  async validateIds(ids: number[]): Promise<number[]> {
    return this.resolveReferences(ids);
  }

  async create(name: string, category: 'software' | 'soft'): Promise<Skill> {
    const [normalized] = this.normalize([name]);
    if (!normalized) throw new BadRequestException('Skill name cannot be empty');
    const existing = await this.skillRepo.findOne({ where: { name: normalized } });
    if (existing) return existing;
    return this.skillRepo.save(this.skillRepo.create({
      name: normalized,
      category: category === 'soft' ? 'soft' : 'software',
    }));
  }

  findAll(): Promise<Skill[]> {
    return this.skillRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }
}
