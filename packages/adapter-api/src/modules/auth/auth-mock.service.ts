import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  PreparedRegistrationData,
  SignRequest,
  AuthResponse,
  CheckRegistrationResponse,
} from './types';
import * as crypto from 'crypto';

/**
 * Mock auth service for development without blockchain.
 * Replaces SDK calls with direct HTTP to federate server + simple JWT.
 * Activated with USE_MOCK_AUTH=true environment variable.
 */
@Injectable()
export class MockAuthService {
  private readonly logger = new Logger(MockAuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = this.configService.getJwtSecret();
    this.jwtExpiresIn = this.configService.getJwtExpiresIn();
    this.logger.log('MockAuthService initialized (no blockchain required)');
  }

  private get federateServer(): string {
    return this.configService.getFederateServer();
  }

  async checkRegistration(userId: string): Promise<CheckRegistrationResponse> {
    try {
      const url = `${this.federateServer}/check-user-registered?userId=${encodeURIComponent(userId)}`;
      const response = await fetch(url);
      const data = await response.json() as { ok: boolean };
      return { userId, isRegistered: data.ok };
    } catch (error) {
      this.logger.error('Error checking registration:', error);
      throw new Error(
        `Error checking if the user is registered: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async register(preparedData: PreparedRegistrationData): Promise<AuthResponse> {
    try {
      const registerResponse = await fetch(`${this.federateServer}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: preparedData.userId,
          credentialId: preparedData.credentialId,
          address: preparedData.passAccountAddress,
        }),
      });

      if (!registerResponse.ok) {
        throw new Error(`Registration failed: ${registerResponse.status}`);
      }

      const result = await registerResponse.json();

      await fetch(`${this.federateServer}/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: preparedData.userId }),
      });

      return {
        success: true,
        message: 'Registration completed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Error in registration process:', error);
      return {
        success: false,
        error: 'Error completing registration',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async connect(userId: string): Promise<AuthResponse> {
    try {
      const addressUrl = `${this.federateServer}/get-user-address?userId=${encodeURIComponent(userId)}`;
      const addressResponse = await fetch(addressUrl);

      if (!addressResponse.ok) {
        throw new Error(`Failed to get user address: ${addressResponse.status}`);
      }

      const { address } = await addressResponse.json() as { address: string };
      const token = this.createToken(userId, address);
      const extrinsic = '0x' + crypto.randomBytes(32).toString('hex');

      return {
        success: true,
        token,
        extrinsic,
      } as any;
    } catch (error) {
      this.logger.error('Error in connection process:', error);
      return {
        success: false,
        error: 'Error completing connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAddress(token: string): Promise<string> {
    return this.decodeToken(token).address;
  }

  async getUserIdFromToken(token: string): Promise<string> {
    return this.decodeToken(token).userId;
  }

  async sign(token: string, signRequest: SignRequest): Promise<AuthResponse> {
    try {
      if (!signRequest.extrinsic) {
        return { success: false, error: 'No extrinsic provided' };
      }

      this.decodeToken(token); // validates token

      return {
        success: true,
        ok: true,
        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 100000),
      } as any;
    } catch (error: any) {
      this.logger.error('Error signing the command:', error);
      if (error.message?.includes('expired')) {
        return { success: false, error: 'Token has expired, please reconnect', code: 'E_JWT_EXPIRED' };
      }
      return {
        success: false,
        error: 'Error signing the command',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCurrentUser(token: string): Promise<{ id: string; address: string; displayName: string }> {
    const { userId, address } = this.decodeToken(token);
    const local = userId?.split('@')[0] || userId || '';
    return {
      id: userId,
      address,
      displayName: local.charAt(0).toUpperCase() + local.slice(1),
    };
  }

  /** Thin pass-through to the federate-server (mock-api in dev). */
  private async forwardToFederate(
    path: string,
    body: unknown,
    bearer?: string,
  ): Promise<{ status: number; body: any }> {
    const url = `${this.federateServer}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { status: response.status, body: parsed };
  }

  passwordRegister(body: unknown): Promise<{ status: number; body: any }> {
    return this.forwardToFederate('/password-register', body);
  }

  passwordConnect(body: unknown): Promise<{ status: number; body: any }> {
    return this.forwardToFederate('/password-connect', body);
  }

  changePassword(token: string, body: unknown): Promise<{ status: number; body: any }> {
    return this.forwardToFederate('/change-password', body, token);
  }

  private createToken(userId: string, address: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      userId, address, iat: now, exp: now + this.jwtExpiresIn,
    })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  private decodeToken(token: string): { userId: string; address: string } {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return { userId: payload.userId, address: payload.address };
  }
}
