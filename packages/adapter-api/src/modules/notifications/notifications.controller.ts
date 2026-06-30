import { Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { NotificationStatus, NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List authenticated wallet notifications' })
  @ApiBearerAuth()
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer token for authentication' })
  @ApiQuery({ name: 'status', required: false, enum: ['unread', 'read', 'all'] })
  @ApiResponse({ status: 200, description: 'Notifications for the authenticated wallet' })
  async list(
    @Headers('authorization') authHeader: string,
    @Query('status') status?: NotificationStatus,
  ) {
    const recipientAddress = await this.getRecipientAddress(authHeader);
    return this.notificationsService.list(recipientAddress, status ?? 'all');
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all authenticated wallet notifications as read' })
  @ApiBearerAuth()
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer token for authentication' })
  @ApiResponse({ status: 200, description: 'Read-all result' })
  async markAllRead(@Headers('authorization') authHeader: string) {
    const recipientAddress = await this.getRecipientAddress(authHeader);
    return this.notificationsService.markAllRead(recipientAddress);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one authenticated wallet notification as read' })
  @ApiBearerAuth()
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer token for authentication' })
  @ApiResponse({ status: 200, description: 'Updated notification' })
  async markRead(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const recipientAddress = await this.getRecipientAddress(authHeader);
    return this.notificationsService.markRead(recipientAddress, id);
  }

  private async getRecipientAddress(authHeader: string | undefined): Promise<string> {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    return this.authService.getAddress(token);
  }
}
