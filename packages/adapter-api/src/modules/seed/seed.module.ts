import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Client } from '../../database/entities/client.entity';
import { Developer } from '../../database/entities/developer.entity';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { Rating } from '../../database/entities/rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Developer, Project, Milestone, Rating]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
