import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ConfigModule } from '../../config/config.module';
import { AuthModule } from '../auth/auth.module';
import { DevelopersModule } from '../developers/developers.module';
import { ClientsModule } from '../clients/clients.module';
import { RatingsModule } from '../ratings/ratings.module';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';
import { Milestone, MilestoneSchema } from '../../database/schemas/milestone.schema';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    DevelopersModule,
    ClientsModule,
    RatingsModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Milestone.name, schema: MilestoneSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
