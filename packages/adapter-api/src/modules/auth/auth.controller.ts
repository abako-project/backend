import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  PreparedRegistrationData,
  SignRequest,
  AuthResponse,
  CheckRegistrationResponse,
} from './types';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('password-register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register a user with userId + password',
    description:
      "Registers a password-derived ed25519 pubKey. The body is forwarded to the federate-server (mock or real) — adapter-api does no ed25519 math itself. The client computes the keypair locally; see mock-api/src/password.ts and password-vectors.ts.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'alice' },
        pubKey: { type: 'string', description: 'hex32 ed25519 pubKey' },
        blockHash: { type: 'string', description: 'recent block hash from chain' },
        clientNonce: { type: 'string', description: 'hex16+ random nonce' },
        signature: { type: 'string', description: 'hex64 ed25519 sig over the canonical register message' },
        address: { type: 'string', nullable: true },
      },
      required: ['userId', 'pubKey', 'blockHash', 'clientNonce', 'signature'],
    },
  })
  @ApiResponse({ status: 200, description: 'Registered' })
  @ApiResponse({ status: 400, description: 'Malformed' })
  @ApiResponse({ status: 401, description: 'Signature does not verify' })
  @ApiResponse({ status: 409, description: 'User already has password credentials' })
  @ApiResponse({ status: 410, description: 'blockHash outside the freshness window' })
  async passwordRegister(@Body() body: any) {
    const r = await this.authService.passwordRegister(body);
    if (r.status >= 400) throw new HttpException(r.body, r.status);
    return r.body;
  }

  @Post('password-connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with userId + password',
    description:
      'Verifies an ed25519 signature against the stored pubKey and mints a JWT with the same shape as the WebAuthn flow.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'alice' },
        blockHash: { type: 'string' },
        clientNonce: { type: 'string' },
        signature: { type: 'string', description: 'hex64' },
      },
      required: ['userId', 'blockHash', 'clientNonce', 'signature'],
    },
  })
  @ApiResponse({ status: 200, description: 'Authenticated; returns { token, publicKey, ... }' })
  @ApiResponse({ status: 400, description: 'Malformed' })
  @ApiResponse({ status: 401, description: 'Invalid credentials (opaque)' })
  @ApiResponse({ status: 410, description: 'blockHash outside the freshness window' })
  async passwordConnect(@Body() body: any) {
    const r = await this.authService.passwordConnect(body);
    if (r.status >= 400) throw new HttpException(r.body, r.status);
    return r.body;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change a user password',
    description:
      'Bearer-authenticated. Both signatures (oldSignature with the current key, newSignature with the new key) bind to newPubKey via the canonical message so the operation is atomic.',
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token from password-connect',
    required: true,
    schema: { type: 'string', example: 'Bearer <jwt>' },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        blockHash: { type: 'string' },
        clientNonce: { type: 'string' },
        oldSignature: { type: 'string', description: 'hex64, signed with the current privKey' },
        newPubKey: { type: 'string', description: 'hex32 new ed25519 pubKey' },
        newSignature: { type: 'string', description: 'hex64, signed with the new privKey' },
      },
      required: ['blockHash', 'clientNonce', 'oldSignature', 'newPubKey', 'newSignature'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Invalid token or signature' })
  @ApiResponse({ status: 410, description: 'blockHash outside the freshness window' })
  async changePassword(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HttpException({ error: 'Missing bearer token' }, HttpStatus.UNAUTHORIZED);
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const r = await this.authService.changePassword(token, body);
    if (r.status >= 400) throw new HttpException(r.body, r.status);
    return r.body;
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the user identified by the session token. Replaces the pattern of caching login data in localStorage.',
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: { type: 'string', example: 'Bearer <your-jwt-token>' },
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        address: { type: 'string' },
        displayName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getMe(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException({ error: 'Unauthenticated' }, HttpStatus.UNAUTHORIZED);
    }
    const token = authHeader.split(' ')[1];
    try {
      return await this.authService.getCurrentUser(token);
    } catch {
      throw new HttpException({ error: 'Invalid token' }, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('check-registered/:userId')
  @ApiOperation({ 
    summary: 'Check if user is registered',
    description: 'Verifies if a user with the given ID is already registered in the system'
  })
  @ApiParam({ 
    name: 'userId', 
    description: 'The unique identifier of the user to check',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration status retrieved successfully',
    type: CheckRegistrationResponse
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        details: { type: 'string' }
      }
    }
  })
  async checkRegistered(@Param('userId') userId: string): Promise<CheckRegistrationResponse> {
    try {
      return await this.authService.checkRegistration(userId);
    } catch (error) {
      throw new HttpException(
        {
          error: 'Error checking if the user is registered',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('custom-register')
  @ApiOperation({ 
    summary: 'Register a new user',
    description: 'Registers a new user with WebAuthn attestation data and account information'
  })
  @ApiBody({ 
    type: PreparedRegistrationData,
    description: 'User registration data including attestation and account details'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User registered successfully',
    type: AuthResponse
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Registration failed',
    type: AuthResponse
  })
  async register(@Body() preparedData: PreparedRegistrationData): Promise<AuthResponse> {
    const result = await this.authService.register(preparedData);

    if (!result.success) {
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  @Post('custom-connect')
  @ApiOperation({ 
    summary: 'Connect existing user',
    description: 'Connects an existing user to the system using their user ID'
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string',
          description: 'The unique identifier of the user to connect'
        }
      },
      required: ['userId']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User connected successfully',
    type: AuthResponse
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Connection failed',
    type: AuthResponse
  })
  async connect(@Body() body: { userId: string }): Promise<AuthResponse> {
    const result = await this.authService.connect(body.userId);

    if (!result.success) {
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  @Post('sign')
  @ApiOperation({ 
    summary: 'Sign transaction',
    description: 'Signs a transaction using the provided JWT token and extrinsic data'
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer <your-jwt-token>'
    }
  })
  @ApiBody({ 
    type: SignRequest,
    description: 'Transaction signing request with extrinsic data'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction signed successfully',
    type: AuthResponse
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or expired token',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string' },
        code: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Session not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string' },
        code: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    type: AuthResponse
  })
  async sign(
    @Headers('authorization') authHeader: string,
    @Body() signRequest: SignRequest,
  ): Promise<AuthResponse> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException(
        {
          success: false,
          error: 'No token provided or invalid format',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.split(' ')[1];
    const result = await this.authService.sign(token, signRequest);

    if (!result.success) {
      const statusCode = result.code === 'E_JWT_EXPIRED' ||
        result.code === 'E_JWT_INVALID' ||
        result.code === 'E_ADDRESS_MISMATCH'
        ? HttpStatus.UNAUTHORIZED
        : result.code === 'E_SESSION_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(result, statusCode);
    }

    return result;
  }
}
