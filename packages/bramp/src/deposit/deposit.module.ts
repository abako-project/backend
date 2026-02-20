import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PapiModule } from '../papi/papi.module';

@Module({
    imports: [PrismaModule, PapiModule],
    controllers: [DepositController],
    providers: [DepositService],
    exports: [DepositService],
})
export class DepositModule { }
