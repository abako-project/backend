import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
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
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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