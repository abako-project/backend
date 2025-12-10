import { Module } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ConfigModule } from '../../config/config.module';
import { AuthModule } from '../auth/auth.module';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';
import { Milestone, MilestoneSchema, MilestoneSchemaFactory } from '../../database/schemas/milestone.schema';
import { Connection } from 'mongoose';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    MongooseModule.forFeatureAsync([
      {
        name: Milestone.name,
        inject: [getConnectionToken()],
        useFactory: (connection: Connection) => {
          return MilestoneSchemaFactory(connection);
        },
      },
    ]),
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
