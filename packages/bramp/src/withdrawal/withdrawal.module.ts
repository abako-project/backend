import { Module } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import { PapiModule } from '../papi/papi.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PapiModule, PrismaModule],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
})
export class WithdrawalModule { }
