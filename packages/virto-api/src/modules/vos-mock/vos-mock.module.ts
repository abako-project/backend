import { Module } from '@nestjs/common';
import { VosMockController } from './vos-mock.controller';
import { VosMockService } from './vos-mock.service';
import { StorageMiddleware } from './storage.middleware';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [VosMockController],
  providers: [VosMockService, StorageMiddleware],
  exports: [VosMockService],
})
export class VosMockModule {} 