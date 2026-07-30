import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { ConfigModule } from '../../config/config.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
