import { Injectable } from '@nestjs/common';
import { document } from '../../config/swagger.config';
import { OpenAPIObject } from '@nestjs/swagger';

@Injectable()
export class ApiDocsService {
  getOpenAPIDocument(): OpenAPIObject {
    return document;
  }

} 