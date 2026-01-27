import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DaoController } from './dao.controller';
import { DaoService } from './dao.service';
import { ConfigModule } from '../../config/config.module';

@Module({
    imports: [AuthModule, ConfigModule],
    controllers: [DaoController],
    providers: [DaoService],
})
export class DaoModule { }
