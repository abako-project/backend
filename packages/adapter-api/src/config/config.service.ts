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
    // El entorno del proceso manda sobre el fichero .env. Al revés, un .env
    // que se colara en la imagen anularía en silencio lo que inyecta el
    // compose, y el servicio arrancaría con la configuración de otro entorno.
    const hello = process.env[key] ?? this.envConfig[key];

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
    return process.env['FEDERATE_SERVER'] || this.envConfig['FEDERATE_SERVER'] || 'http://localhost:3000/api';
  }

  getProviderUrl(): string {
    return process.env['PROVIDER_URL'] || this.envConfig['PROVIDER_URL'] || 'ws://localhost:21000';
  }

  getJwtSecret(): string {
    const secret = process.env['JWT_SECRET'] || this.envConfig['JWT_SECRET'];
    if (secret) return secret;

    // El fallback es una constante pública que está en git. Con NODE_ENV=production
    // firmaría tokens que cualquiera puede falsificar, así que ahí no arranca.
    if (this.getNodeEnv() === 'production') {
      throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV=production.');
    }
    return 'virto-server-example-secret-key-change-in-production';
  }

  getJwtExpiresIn(): number {
    const raw = process.env['JWT_EXPIRES_IN'] || this.envConfig['JWT_EXPIRES_IN'] || '3600';
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

  getCorsOrigin(): string {
    return process.env['CORS_ORIGIN'] || this.envConfig['CORS_ORIGIN'] || '';
  }

  getDerivePath(): string {
    return process.env['DERIVE_PATH'] || this.envConfig['DERIVE_PATH'] || '//Alice';
  }

  getSqlitePath(): string {
    return process.env['SQLITE_PATH'] || this.envConfig['SQLITE_PATH'] || './data/abako.sqlite';
  }

  getDaoAddress(): string {
    return process.env['DAO_ADDRESS'] || this.envConfig['DAO_ADDRESS'] || '';
  }

  getBrampServiceUrl(): string {
    return process.env['BRAMP_SERVICE_URL'] || this.envConfig['BRAMP_SERVICE_URL'] || 'http://localhost:3001';
  }
}
