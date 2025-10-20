import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export let document: OpenAPIObject;

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Virto API')
    .setDescription('The Virto API documentation')
    .setVersion('1.0')
    .addTag('vos-mock', 'VOS mock authentication API')
    .addBearerAuth()
    .build();
  
  document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api-docs', app, document);
  
  return document;
}
