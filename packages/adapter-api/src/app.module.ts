import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { SchemasModule } from './database/schemas/schemas.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DevelopersModule } from './modules/developers/developers.module';

dotenv.config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      serveRoot: '/',
      rootPath: join(process.cwd(), 'dist', 'static')
    }),
    ConfigModule,
    DatabaseModule,
    SchemasModule,
    ApiDocsModule,
    ProjectsModule,
    CalendarModule,
    AuthModule,
    ClientsModule,
    DevelopersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {}
} 