import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { Developer } from '../../database/entities/developer.entity';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { MilestoneAssignment } from '../../database/entities/milestone-assignment.entity';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Developer, Project, Milestone, MilestoneAssignment]),
    SkillsModule,
    AuthModule,
  ],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}
