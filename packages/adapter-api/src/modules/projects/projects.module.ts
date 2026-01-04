import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ConfigModule } from '../../config/config.module';
import { AuthModule } from '../auth/auth.module';
import { DevelopersModule } from '../developers/developers.module';
import { ClientsModule } from '../clients/clients.module';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    DevelopersModule,
    ClientsModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
