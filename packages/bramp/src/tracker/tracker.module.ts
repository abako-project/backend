import { Module } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { PapiModule } from '../papi/papi.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PapiModule, PrismaModule],
  providers: [TrackerService],
})
export class TrackerModule { }
