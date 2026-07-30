import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@Controller({ path: 'skills', version: '1' })
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List unique lowercase worker skills' })
  async findAll() {
    return { skills: await this.skillsService.findAll() };
  }

  @Get('ids')
  @ApiOperation({ summary: 'List skill IDs, optionally filtered by role ID' })
  async findIds(@Query('roleId') roleId?: string) {
    return { skillIds: await this.skillsService.findIds(roleId) };
  }

  @Get(':skillId')
  @ApiOperation({ summary: 'Get a skill name by ID' })
  async findName(@Param('skillId') skillId: string) {
    return { name: await this.skillsService.findNameById(skillId) };
  }

  @Post()
  @ApiOperation({ summary: 'Add a skill to the shared catalog' })
  async create(@Body() body: {
    name: string;
    category?: 'software' | 'soft';
    roleIds: number[];
  }) {
    return {
      skill: await this.skillsService.createWithRoles(
        body.name,
        body.category,
        body.roleIds,
      ),
    };
  }
}
