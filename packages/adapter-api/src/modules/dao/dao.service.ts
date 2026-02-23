import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class DaoService {
    private readonly logger = new Logger(DaoService.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    async submitRemarkReferendum(remark: string, token: string): Promise<any> {
        try {
            const address = await this.authService.getAddress(token);
            this.logger.log(`Submitting remark referendum for address: ${address}`);

            const virtoApiUrl = this.configService.getFederateServer();
            const response = await fetch(`${virtoApiUrl}/memberships/governance/submit-remark`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    remark,
                    origin: address,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to get extrinsic from virto-api: ${response.statusText}`);
            }

            const apiResponse = await response.json() as { callData: string };
            const callData = apiResponse.callData;
            this.logger.log(`Received call data from virto-api: ${callData}`);

            const result = await this.authService.sign(token, {
                extrinsic: callData,
            });

            return result;
        } catch (error) {
            this.logger.error('Error submitting remark referendum:', error);
            throw error;
        }
    }
}
