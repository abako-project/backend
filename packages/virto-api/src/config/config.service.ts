import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor() {
    const envFilePath = '.env';
    const envFileExists = fs.existsSync(envFilePath);

    this.envConfig = dotenv.parse(envFileExists ? fs.readFileSync(envFilePath) : '');
    console.log(this.envConfig);
  }

  get(key: string): string {
    const hello = this.envConfig[key] ?? process.env[key];

    if (hello === "") {
      return hello;
    }
    
    if (!hello) {
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return hello;
  }

  getPort(): number {
    return parseInt(this.get('PORT') || '3000', 10);
  }

  getNodeEnv(): string {
    return this.get('NODE_ENV') || 'development';
  }

  getKreivoProvider(): string {
    return this.get('KREIVO_PROVIDER');
  }

  getPhrase(): string {
    return this.get('PHRASE');
  }

  getDerivePath(): string {
    return this.get('DERIVE_PATH') || "";
  }

  getPublicIp(): string {
    return this.get('PUBLIC_IP');
  }

  getRpName(): string {
    return this.get('RP_NAME');
  }

  getSigningServiceUrl(): string {
    return this.get('SIGNING_SERVICE_URL');
  }

  getCommunityId(): string {
    return this.get('COMMUNITY_ID');
  }
}
