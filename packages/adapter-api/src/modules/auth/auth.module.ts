import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MockAuthService } from './auth-mock.service';
import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: (configService: ConfigService) => {
        if (process.env.USE_MOCK_AUTH === 'true') {
          return new MockAuthService(configService);
        }
        return new AuthService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
