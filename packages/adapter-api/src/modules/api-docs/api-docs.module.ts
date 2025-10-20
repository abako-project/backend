import { Module } from '@nestjs/common';
import { ApiDocsService } from './api-docs.service';
import { ApiDocsController } from './api-docs.controller';

@Module({
  providers: [ApiDocsService],
  controllers: [ApiDocsController],
  exports: [ApiDocsService]
})
export class ApiDocsModule {} 