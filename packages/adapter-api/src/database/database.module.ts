import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '../config/config.service';
import { buildDataSourceOptions } from './database.options';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(process.env, configService.getSqlitePath(), true),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
