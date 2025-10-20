import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiDocsService } from './api-docs.service';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

@ApiExcludeController()
@Controller('api-docs')
export class ApiDocsController {
  constructor(private readonly apiDocsService: ApiDocsService) {}
  @Get('json')
  getOpenAPIJson(@Res() res: Response) {
    const document = this.apiDocsService.getOpenAPIDocument();
    return res.json(document);
  }
} 