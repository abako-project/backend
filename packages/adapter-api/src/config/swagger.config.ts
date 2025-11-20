import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export let document: OpenAPIObject;

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Abako Adapter API')
    .setDescription(`
      The Abako Adapter API documentation
      
      ## API Versioning
      This API uses URI versioning. All endpoints are prefixed with /v{version}/.
      
      Example: \`/v1/clients\`, \`/v1/projects\`
      
      Current version: v1
    `)
    .setVersion('1.0')
    .addTag('Authentication', 'User authentication and registration endpoints')
    .addTag('clients', 'Client profile management')
    .addTag('developers', 'Developer profile management')
    .addTag('Projects', 'Project and milestone management')
    .addTag('Calendar', 'Calendar and availability management')
    .addBearerAuth()
    .addServer('/v1', 'API Version 1')
    .build();
  
  document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api-docs', app, document);
  
  return document;
}
