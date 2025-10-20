import { Controller, Post, Body, HttpException, HttpStatus, Req, Get, Query } from '@nestjs/common';
import { VosMockService } from './vos-mock.service';
import { BaseProfile, User } from './types';
import { Request } from 'express';
import { SQLiteSessionStorage } from './storage';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';


@ApiTags('vos-mock')
@Controller('api')
@ApiTags('vos-mock')
@Controller('api')
export class VosMockController {
  constructor(private readonly vosMockService: VosMockService) {}

  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2023-09-28T12:00:00Z' },
        service: { type: 'string', example: 'vos-mock' }
      }
    }
  })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @Get('health')
  async healthCheck() {
    try {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'vos-mock'
      };
    } catch (error) {
      throw new HttpException('Service is unhealthy', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @ApiOperation({ summary: 'Initialize WebAuthn registration process' })
  @ApiQuery({ name: 'id', required: true, type: String, description: 'User ID', example: 'test' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'User display name (defaults to id if not provided)', example: 'Test' })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration initialization successful, returns attestation options',
    schema: {
      type: 'object',
      properties: {
        publicKey: {
          type: 'object',
          properties: {
            rp: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Example RP' }
              }
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: 'Hashed user ID as byte array',
                  example: [240, 228, 194, 247, 108, 88, 145, 110, 194, 88, 242, 70, 133, 27, 234, 9, 29, 20, 212, 36, 122, 47, 195, 225, 134, 148, 70, 27, 24, 22, 225, 59]
                },
                name: { type: 'string', example: 'test' },
                displayName: { type: 'string', example: 'test' }
              }
            },
            challenge: {
              type: 'string',
              example: '0x01d3f2ddb53e97c40a6b849f9c9258438fa40df3df34aa9028e5667e8a73721c'
            },
            pubKeyCredParams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'public-key' },
                  alg: { type: 'integer', example: -7 }
                }
              }
            },
            authenticatorSelection: {
              type: 'object',
              properties: {
                userVerification: { type: 'string', example: 'preferred' }
              }
            },
            timeout: { type: 'number', example: 60000 },
            attestation: { type: 'string', example: 'none' }
          }
        },
        blockNumber: {
          type: 'number',
          description: 'Blockchain block number when the challenge was generated',
          example: 1107519
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid or missing user data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get('attestation')
  async attestation(@Query('id') id: string, @Query('name') name: string, @Query('challenge') challenge: string, @Req() req: Request) {
    if (!id) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!challenge) {
      throw new HttpException('Challenge is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const storage = req.storage as SQLiteSessionStorage;
      
      // Create a user object from query parameters
      const user: User<BaseProfile> = {
        profile: {
          id: id,
          name: name || id,
          displayName: name || id
        }
      };
      
      const attestationOptions = await this.vosMockService.attestation(user, challenge);
      return attestationOptions;
    } catch (error) {
      console.error('Attestation error:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to prepare registration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiOperation({ summary: 'Complete WebAuthn registration process' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID', example: 'test' },
        attestationResponse: { 
          type: 'object', 
          description: 'WebAuthn attestation response',
          properties: {
            id: { type: 'string', description: 'Credential ID as base64url string', example: 'yLbgoD7WL6UXBHpj5SZIOQw35XNk6z4Bz3BLSquG2HI' },
            rawId: { type: 'string', description: 'Raw credential ID as base64url string', example: 'yLbgoD7WL6UXBHpj5SZIOQw35XNk6z4Bz3BLSquG2HI' },
            type: { type: 'string', description: 'Type of credential', example: 'public-key' },
            response: {
              type: 'object',
              properties: {
                authenticatorData: { type: 'string', description: 'Base64url encoded authenticator data', example: 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NBAAAAAQAAAAAAAAAAAAAAAAAAAAAAIMi24KA-1i-lFwR6Y-UmSDkMN-VzZOs-Ac9wS0qrhthypQECAyYgASFYID57cUySgqw4bWodA5jLfVWGG55NfoHZ4_kc6rypYr1WIlgg_DAzXqVKpUTg95LctxL7274k4V7k31yuTKYSCjEGRhE' },
                clientDataJSON: { type: 'string', description: 'Base64url encoded client data JSON', example: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiQWRQeTNiVS1sOFFLYTRTZm5KSllRNC1rRGZQZk5LcVFLT1ZtZm9wemNodyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4NSIsImNyb3NzT3JpZ2luIjpmYWxzZX0' },
                publicKey: { type: 'string', description: 'Base64url encoded public key', example: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPntxTJKCrDhtah0DmMt9VYYbnk1-gdnj-RzqvKlivVb8MDNepUqlROD3kty3EvvbviThXuTfXK5MphIKMQZGEQ' }
              }
            }
          }
        },
        blockNumber: { type: 'number', description: 'Blockchain block number from the attestation request', example: 1107519 }
      },
      required: ['userId', 'attestationResponse', 'blockNumber']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration completed successfully',
    schema: {
      type: 'object',
      properties: {
        ext: { type: 'string', description: 'Extrinsic data as hex string', example: '0xd107040600f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b006b726569766f5f700000000000000000000000000000000000000000000000000e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a83fe61000910249960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97634100000001000000000000000000000000000000000020c8b6e0a03ed62fa517047a63e52648390c37e57364eb3e01cf704b4aab86d872a50102032620012158203e7b714c9282ac386d6a1d0398cb7d55861b9e4d7e81d9e3f91ceabca962bd56225820fc30335ea54aa544e0f792dcb712fbdbbe24e15ee4df5cae4ca6120a3106461125027b2274797065223a22776562617574686e2e637265617465222c226368616c6c656e6765223a22416450793362552d6c38514b613453666e4a4a5951342d6b446650664e4b71514b4f566d666f707a636877222c226f726967696e223a22687474703a2f2f6c6f63616c686f73743a38303835222c2263726f73734f726967696e223a66616c73657d3059301306072a8648ce3d020106082a8648ce3d030107034200043e7b714c9282ac386d6a1d0398cb7d55861b9e4d7e81d9e3f91ceabca962bd56fc30335ea54aa544e0f792dcb712fbdbbe24e15ee4df5cae4ca6120a31064611' },
        address: { type: 'string', description: 'Address associated with the registration', example: 'alsdkfjalsdjkf' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Post('register')
  async register(@Body() body: { userId: string; hashedUserId: string; credentialId: string; address: string; attestationResponse: any }, @Req() req: Request) {
    const { userId, hashedUserId, credentialId, address, attestationResponse } = body;

    console.log(userId, hashedUserId, credentialId, address, attestationResponse);
    
    if (!userId || !attestationResponse) {
      throw new HttpException('User ID and attestation response are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const storage = req.storage as SQLiteSessionStorage;
      
      const result = await this.vosMockService.register(userId, hashedUserId, credentialId, address, attestationResponse, storage);
      return result;
    } catch (error) {
      console.error('Register error:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed during registration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiOperation({ summary: 'Initialize WebAuthn authentication process' })
  @ApiQuery({ name: 'userId', required: true, type: String, description: 'User ID for which to generate authentication assertion', example: 'test' })
  @ApiResponse({ 
    status: 200, 
    description: 'Authentication initialization successful, returns assertion options',
    schema: {
      type: 'object',
      properties: {
        publicKey: {
          type: 'object',
          properties: {
            challenge: { 
              type: 'string', 
              description: 'Challenge as hex string',
              example: '0xd9c7d5339e935d1ef6b44949972ef5aaa373cd29ba16beb5edcc93acd9ce9667'
            },
            allowCredentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Credential ID', example: 'yLbgoD7WL6UXBHpj5SZIOQw35XNk6z4Bz3BLSquG2HI' },
                  type: { type: 'string', example: 'public-key' },
                  transports: { 
                    type: 'array', 
                    items: { type: 'string' },
                  }
                }
              }
            },
            userVerification: { type: 'string', example: 'preferred' },
            timeout: { type: 'number', example: 60000 }
          }
        },
        blockNumber: {
          type: 'number',
          description: 'Blockchain block number when the challenge was generated',
          example: 1107521
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - User ID is required or User data not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get('assertion')
  async assertion(@Query('userId') userId: string, @Query('challenge') challenge: string, @Req() req: Request) {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!challenge) {
      throw new HttpException('Challenge is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const storage = req.storage as SQLiteSessionStorage;
      const assertionOptions = await this.vosMockService.assertion(userId, challenge, storage);
      return assertionOptions;
    } catch (error) {
      console.error('Assertion error:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to prepare connection',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiOperation({ summary: 'Check if a user is registered with WebAuthn' })
  @ApiQuery({ name: 'userId', required: true, type: String, description: 'User ID to check if registered', example: 'test' })
  @ApiResponse({ 
    status: 200, 
    description: 'Check completed successfully',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', description: 'Indicates if the user is registered', example: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get('check-user-registered')
  async checkUserRegistered(@Query('userId') userId: string, @Req() req: Request) {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    console.log("checkUserRegistered", userId);

    try {
      const storage = req.storage as SQLiteSessionStorage;
      console.log("storage", storage);
      const storedData = await storage.get(userId);
      return { ok: !!storedData && !!storedData.credentialId };
    } catch (error) {
      console.error('Check user registered error:', error);
      throw new HttpException(
        'Failed to check user registration status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiOperation({ summary: 'Get user address by username' })
  @ApiQuery({ name: 'userId', required: true, type: String, description: 'User ID to get address for', example: 'test' })
  @ApiResponse({ 
    status: 200, 
    description: 'User address retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'User address', example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Missing required parameters' })
  @ApiResponse({ status: 404, description: 'User not found or not registered' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get('get-user-address')
  async getUserAddress(@Query('userId') userId: string, @Req() req: Request) {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    console.log("getUserAddress", userId);

    try {
      const storage = req.storage as SQLiteSessionStorage;
      const storedData = await storage.get(userId);
      
      if (!storedData || !storedData.address) {
        throw new HttpException('User not found or not registered', HttpStatus.NOT_FOUND);
      }

      return { address: storedData.address };
    } catch (error) {
      console.error('Get user address error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to get user address',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  @Post('add-member')
  async addMember(@Body() body: { userId: string }, @Req() req: Request) {
    const { userId } = body;

    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const storage = req.storage as SQLiteSessionStorage;
      const result = await this.vosMockService.addMember(userId, storage);
      return result;
    } catch (error) {
      console.error('Add member error:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to add member',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  @Get('is-member')
  async isMember(@Query('address') address: string, @Req() req: Request) {
    if (!address) {
      throw new HttpException('Address is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.vosMockService.isMember(address);
      return result;
    } catch (error) {
      console.error('Is member error:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to check if user is member',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}