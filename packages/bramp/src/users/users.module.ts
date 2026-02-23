import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { PrismaModule } from '../prisma/prisma.module';
import { PapiModule } from '../papi/papi.module';

@Module({
  imports: [PrismaModule, PapiModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }
