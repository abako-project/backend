import { Module } from '@nestjs/common';
import { PapiService } from './papi.service';

@Module({
  providers: [PapiService],
  exports: [PapiService],
})
export class PapiModule { }
