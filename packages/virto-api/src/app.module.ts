import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { VosMockModule } from './modules/vos-mock/vos-mock.module';
import { ConfigModule } from './config/config.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { StorageMiddleware } from './modules/vos-mock/storage.middleware';

dotenv.config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      serveRoot: '/',
      rootPath: join(process.cwd(), 'dist', 'static')
    }),
    VosMockModule,
    ConfigModule,
    ApiDocsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(StorageMiddleware)
      .forRoutes(
        'api/attestation',
        'api/register',
        'api/assertion',
        'api/connect',
        'api/check-user-registered',
        'api/get-user-address',
        'api/add-member',
      );
  }
} 