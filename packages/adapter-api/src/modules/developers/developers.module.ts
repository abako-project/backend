import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { Developer, DeveloperSchema } from '../../database/schemas/developer.schema';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';
import { Milestone, MilestoneSchema } from '../../database/schemas/milestone.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Developer.name, schema: DeveloperSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Milestone.name, schema: MilestoneSchema },
    ]),
  ],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}

