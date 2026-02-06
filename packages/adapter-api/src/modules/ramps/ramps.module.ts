import { Module } from '@nestjs/common';
import { RampService } from './ramps.service';
import { RampController } from './ramps.controller';
import { ConfigModule } from '../../config/config.module';

@Module({
    imports: [ConfigModule],
    controllers: [RampController],
    providers: [RampService],
    exports: [RampService],
})
export class RampModule { }
