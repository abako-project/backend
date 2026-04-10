import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DevelopersModule } from './modules/developers/developers.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { DaoModule } from './modules/dao/dao.module';
import { RampModule } from './modules/ramps/ramps.module';

dotenv.config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      serveRoot: '/',
      rootPath: join(process.cwd(), 'dist', 'static')
    }),
    ConfigModule,
    DatabaseModule,
    ApiDocsModule,
    ProjectsModule,
    CalendarModule,
    AuthModule,
    ClientsModule,
    DevelopersModule,
    RatingsModule,
    DaoModule,
    RampModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { }
} 