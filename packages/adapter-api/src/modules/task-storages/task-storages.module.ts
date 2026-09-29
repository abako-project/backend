import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../../config/config.module';
import { TaskStoragesController } from './task-storages.controller';
import { TaskStoragesService } from './task-storages.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [TaskStoragesController],
  providers: [TaskStoragesService],
})
export class TaskStoragesModule {}
