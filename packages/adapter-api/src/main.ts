import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType } from '@nestjs/common';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { ConfigService } from './config/config.service';
import { setupSwagger } from './config/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Ensure SQLite data directory exists
  const dbPath = process.env.SQLITE_PATH || './data/abako.sqlite';
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const configService = app.get(ConfigService);
  const port = configService.getPort();
  
  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  
  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(morgan('dev'));
  
  // Swagger UI
  setupSwagger(app);
  
  await app.listen(port);
  console.log(`
  Adapter API :${port}
  Docs     http://localhost:${port}/api-docs
`);
}

bootstrap();