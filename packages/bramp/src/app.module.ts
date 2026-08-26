import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PapiModule } from './papi/papi.module';
import { TrackerModule } from './tracker/tracker.module';
import { DepositModule } from './deposit/deposit.module';
import { WithdrawalModule } from './withdrawal/withdrawal.module';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PapiModule,
    TrackerModule,
    DepositModule,
    WithdrawalModule
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule { }
