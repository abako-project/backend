import request from 'supertest';
import * as crypto from 'crypto';

/**
 * Helper to replace @virtonetwork/sdk in tests.
 * Provides auth registration and connection flows using direct HTTP calls
 * to the adapter-api (which in turn talks to mock-api).
 */
export class MockAuthHelper {
  private prefix: string;

  /**
   * @param httpServer - NestJS HTTP server from app.getHttpServer()
   * @param prefix - URL prefix (e.g., '/v1' when versioning is enabled, '' otherwise)
   */
  constructor(private httpServer: any, prefix: string = '/v1') {
    this.prefix = prefix;
  }

  /**
   * Register a user and return the registration result.
   */
  async registerUser(userId: string): Promise<{ success: boolean; passAccountAddress: string }> {
    const passAccountAddress = this.generateAddress();

    const preparedData = {
      attestation: {
        authenticator_data: '0x' + crypto.randomBytes(32).toString('hex'),
        client_data: '0x' + crypto.randomBytes(32).toString('hex'),
        public_key: '0x' + crypto.randomBytes(33).toString('hex'),
        meta: {
          deviceId: `device-${Date.now()}`,
          context: 1,
          authority_id: `auth-${Date.now()}`,
        },
      },
      hashedUserId: '0x' + crypto.createHash('sha256').update(userId).digest('hex'),
      credentialId: `cred_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      passAccountAddress,
    };

    const response = await request(this.httpServer)
      .post(`${this.prefix}/auth/custom-register`)
      .send(preparedData);

    return {
      success: response.body.success,
      passAccountAddress,
    };
  }

  /**
   * Connect a user and return the auth token.
   */
  async connectUser(userId: string): Promise<string> {
    const response = await request(this.httpServer)
      .post(`${this.prefix}/auth/custom-connect`)
      .send({ userId });

    if (!response.body.success || !response.body.token) {
      throw new Error(`Connection failed for ${userId}: ${JSON.stringify(response.body)}`);
    }

    return response.body.token;
  }

  /**
   * Register + connect a user in one call. Returns { token, accountId }.
   */
  async registerAndConnect(userId: string): Promise<{ token: string; accountId: string }> {
    const reg = await this.registerUser(userId);
    if (!reg.success) {
      throw new Error(`Registration failed for ${userId}`);
    }
    const token = await this.connectUser(userId);
    return { token, accountId: reg.passAccountAddress };
  }

  private generateAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let addr = '5';
    for (let i = 0; i < 47; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr;
  }
}
