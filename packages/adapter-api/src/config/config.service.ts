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

  getSigningServiceUrl(): string {
    return this.get('SIGNING_SERVICE_URL');
  }

  getFederateServer(): string {
    return this.envConfig['FEDERATE_SERVER'] || process.env['FEDERATE_SERVER'] || 'http://localhost:3000/api';
  }

  getProviderUrl(): string {
    return this.envConfig['PROVIDER_URL'] || process.env['PROVIDER_URL'] || 'ws://localhost:21000';
  }

  getJwtSecret(): string {
    return this.envConfig['JWT_SECRET'] || process.env['JWT_SECRET'] || 'virto-server-example-secret-key-change-in-production';
  }

  getJwtExpiresIn(): number {
    const raw = this.envConfig['JWT_EXPIRES_IN'] || process.env['JWT_EXPIRES_IN'] || '3600';
    const match = raw.match(/^(\d+)\s*(s|m|h|d)?$/i);
    if (!match) return 3600;
    const value = parseInt(match[1], 10);
    switch (match[2]?.toLowerCase()) {
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default:  return value; // seconds or bare number
    }
  }

  getDerivePath(): string {
    return this.envConfig['DERIVE_PATH'] || process.env['DERIVE_PATH'] || '//Alice';
  }

  getSqlitePath(): string {
    return process.env['SQLITE_PATH'] || this.envConfig['SQLITE_PATH'] || './data/abako.sqlite';
  }

  getDaoAddress(): string {
    return this.envConfig['DAO_ADDRESS'] || process.env['DAO_ADDRESS'] || '';
  }

  getBrampServiceUrl(): string {
    return this.envConfig['BRAMP_SERVICE_URL'] || process.env['BRAMP_SERVICE_URL'] || 'http://localhost:3001';
  }
}
