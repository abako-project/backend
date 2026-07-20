import { ApiProperty } from '@nestjs/swagger';

export class AttestationData {
  @ApiProperty({
    description: 'Authenticator data from WebAuthn',
    example: '0x1234567890abcdef...'
  })
  authenticator_data: string;

  @ApiProperty({
    description: 'Client data from WebAuthn',
    example: '0xabcdef1234567890...'
  })
  client_data: string;

  @ApiProperty({
    description: 'Public key from WebAuthn',
    example: '0x9876543210fedcba...'
  })
  public_key: string;

  @ApiProperty({
    description: 'Metadata about the attestation',
    type: 'object',
    properties: {
      deviceId: { type: 'string', example: 'device-123' },
      context: { type: 'number', example: 1 },
      authority_id: { type: 'string', example: 'auth-456' }
    }
  })
  meta: {
    deviceId: string;
    context: number;
    authority_id: string;
  };
}

export class PreparedRegistrationData {
  @ApiProperty({
    description: 'WebAuthn attestation data',
    type: AttestationData
  })
  attestation: AttestationData;

  @ApiProperty({
    description: 'Hashed user ID for security',
    example: '0xabcdef1234567890...'
  })
  hashedUserId: string;

  @ApiProperty({
    description: 'Credential ID from WebAuthn',
    example: 'cred-123456'
  })
  credentialId: string;

  @ApiProperty({
    description: 'User identifier',
    example: 'user-123'
  })
  userId: string;

  @ApiProperty({
    description: 'Pass account address',
    example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
  })
  passAccountAddress: string;

  @ApiProperty({
    description: 'Selectable mock role IDs assigned during registration',
    type: [Number],
    example: [2, 3],
  })
  roleIds: number[];
}

export class SignRequest {
  @ApiProperty({
    description: 'Extrinsic data to be signed',
    example: { method: 'transfer', params: { to: '0x...', value: '1000' } }
  })
  extrinsic: any;
}

export class AuthResponse {
  @ApiProperty({
    description: 'Indicates if the operation was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Operation completed successfully',
    required: false
  })
  message?: string;

  @ApiProperty({
    description: 'Response data',
    required: false
  })
  data?: any;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid credentials',
    required: false
  })
  error?: string;

  @ApiProperty({
    description: 'Additional error details',
    example: 'Token has expired',
    required: false
  })
  details?: string;

  @ApiProperty({
    description: 'Error code',
    example: 'E_JWT_EXPIRED',
    required: false
  })
  code?: string;
}

export class CheckRegistrationResponse {
  @ApiProperty({
    description: 'User identifier',
    example: 'user-123'
  })
  userId: string;

  @ApiProperty({
    description: 'Whether the user is registered',
    example: true
  })
  isRegistered: boolean;
}
