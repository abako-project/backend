import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { ServerSDK } from '@virtonetwork/sdk';
import {
  AttestationData,
  PreparedRegistrationData,
  SignRequest,
  AuthResponse,
  CheckRegistrationResponse,
} from './types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private serverSdk: ServerSDK | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    // Don't initialize immediately - do it lazily on first use
  }

  private async ensureServerSDK(): Promise<void> {
    if (this.serverSdk) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeServerSDK();
    return this.initPromise;
  }

  private async initializeServerSDK(): Promise<void> {
    try {
      this.serverSdk = new ServerSDK({
        federate_server: this.configService.getFederateServer(),
        provider_url: this.configService.getProviderUrl(),
        config: {
          jwt: {
            secret: this.configService.getJwtSecret(),
            expiresIn: this.configService.getJwtExpiresIn(),
          },
        },
      });
      this.logger.log('ServerSDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ServerSDK:', error);
      this.initPromise = null; // Allow retry
      throw error;
    }
  }

  async checkRegistration(userId: string): Promise<CheckRegistrationResponse> {
    try {
      await this.ensureServerSDK();
      const isRegistered = await this.serverSdk!.auth.isRegistered(userId);
      return {
        userId,
        isRegistered,
      };
    } catch (error) {
      this.logger.error('Error checking registration:', error);
      throw new Error(
        `Error checking if the user is registered: ${error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async register(preparedData: PreparedRegistrationData): Promise<AuthResponse> {
    try {
      await this.ensureServerSDK();
      this.logger.log('Data received from client:', JSON.stringify(preparedData, null, 2));
      this.logger.log('Calling completeRegistration...');

      const result = await this.serverSdk!.auth.completeRegistration(
        preparedData.attestation,
        preparedData.hashedUserId,
        preparedData.credentialId,
        preparedData.userId,
        preparedData.passAccountAddress,
      );

      this.logger.log('Registration completed, result:', result);
      this.logger.log('Adding member...');

      const membership = await this.serverSdk!.auth.addMember(preparedData.userId);
      this.logger.log('Membership result:', membership);

      return {
        success: true,
        message: 'Registration completed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Error in registration process:', error);
      this.logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      return {
        success: false,
        error: 'Error completing registration',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async connect(userId: string): Promise<AuthResponse> {
    try {
      await this.ensureServerSDK();
      const response = await this.serverSdk!.auth.completeConnection(userId);
      this.logger.log('Connect response on server side SDK:', response);

      return {
        ...response,
        success: true,
      };
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
    await this.ensureServerSDK();
    const decodedToken = await this.serverSdk!.auth.decodeToken(token);
    // @ts-ignore
    const address = decodedToken.address;
    return address;
  }

  async getUserIdFromToken(token: string): Promise<string> {
    await this.ensureServerSDK();
    const decodedToken = await this.serverSdk!.auth.decodeToken(token);
    // @ts-ignore
    const userId = decodedToken.userId;
    return userId;
  }

  /**
   * Forward a JSON request to the federate-server. Used by the password
   * endpoints — these are thin pass-throughs because all the protocol-level
   * crypto (argon2id, ed25519, signing) lives on the client. The
   * federate-server is the verifier; adapter-api just relays.
   *
   * Returns the parsed body plus the upstream HTTP status so the controller
   * can rethrow it as-is (401 stays 401, 410 stays 410, etc.).
   */
  private async forwardToFederate(
    path: string,
    body: unknown,
    bearer?: string,
  ): Promise<{ status: number; body: any }> {
    const url = `${this.configService.getFederateServer()}${path}`;
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

  async getCurrentUser(token: string): Promise<{ id: string; address: string; displayName: string }> {
    await this.ensureServerSDK();
    const decoded = await this.serverSdk!.auth.decodeToken(token);
    // @ts-ignore
    const userId = decoded.userId as string;
    // @ts-ignore
    const address = decoded.address as string;
    const local = userId?.split('@')[0] || userId || '';
    return {
      id: userId,
      address,
      displayName: local.charAt(0).toUpperCase() + local.slice(1),
    };
  }

  async sign(token: string, signRequest: SignRequest): Promise<AuthResponse> {
    try {
      await this.ensureServerSDK();
      if (!signRequest.extrinsic) {
        return {
          success: false,
          error: 'No extrinsic provided',
        };
      }

      this.logger.log(`Attempting to sign extrinsic with token: ${token.substring(0, 20)}...`);
      this.logger.log(`Extrinsic to sign: ${signRequest.extrinsic.substring(0, 50)}...`);

      const signResult = await this.serverSdk!.auth.signWithToken(token, signRequest.extrinsic);

      if (!signResult.ok) {
        throw new Error("Signing failed");
      }

      this.logger.log('Sign result:', signResult);

      return {
        ...signResult,
        success: true,
      };
    } catch (error: any) {
      this.logger.error('Error signing the command:', error);
      this.logger.error('Error code:', error.code);
      this.logger.error('Error message:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error.code === 'E_JWT_EXPIRED') {
        return {
          success: false,
          error: 'Token has expired, please reconnect',
          code: error.code,
        };
      } else if (error.code === 'E_JWT_INVALID') {
        return {
          success: false,
          error: 'Invalid token',
          code: error.code,
        };
      } else if (error.code === 'E_SESSION_NOT_FOUND') {
        return {
          success: false,
          error: 'Session not found, please reconnect',
          code: error.code,
        };
      } else if (error.code === 'E_ADDRESS_MISMATCH') {
        return {
          success: false,
          error: 'Token address does not match session address',
          code: error.code,
        };
      }

      return {
        success: false,
        error: 'Error signing the command',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: error.code,
      };
    }
  }
}
