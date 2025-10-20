import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { ConfigService } from './config/config.service';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getPort();
  
  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(morgan('dev'));
  
  // Swagger UI
  setupSwagger(app);
  
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API documentation UI: http://localhost:${port}/api-docs`);
  console.log(`API JSON schema: http://localhost:${port}/api-docs/json`);
}

bootstrap();