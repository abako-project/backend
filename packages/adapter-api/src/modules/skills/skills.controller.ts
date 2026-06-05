import { Body, Controller, Get, Post } from '@nestjs/common';
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

  @Post()
  @ApiOperation({ summary: 'Add a skill to the shared catalog' })
  async create(@Body() body: { name: string; category?: 'software' | 'soft' }) {
    return {
      skill: await this.skillsService.create(body.name, body.category || 'software'),
    };
  }
}
