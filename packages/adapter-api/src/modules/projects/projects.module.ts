import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ConfigModule } from '../../config/config.module';
import { AuthModule } from '../auth/auth.module';
import { DevelopersModule } from '../developers/developers.module';
import { ClientsModule } from '../clients/clients.module';
import { RatingsModule } from '../ratings/ratings.module';
import { EventsModule } from '../events/events.module';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    DevelopersModule,
    ClientsModule,
    RatingsModule,
    EventsModule,
    TypeOrmModule.forFeature([Project, Milestone]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
