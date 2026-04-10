import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client } from '../../database/entities/client.entity';
import { Project } from '../../database/entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Project]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
