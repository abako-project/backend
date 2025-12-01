import { Module } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { Developer, DeveloperSchemaFactory } from '../../database/schemas/developer.schema';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';
import { Milestone, MilestoneSchema } from '../../database/schemas/milestone.schema';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Developer.name,
        inject: [getConnectionToken()],
        useFactory: (connection: Connection) => {
          return DeveloperSchemaFactory(connection);
        },
      },
    ]),

    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Milestone.name, schema: MilestoneSchema },
    ]),
  ],
  controllers: [DevelopersController],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}
