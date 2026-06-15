import { BadRequestException, Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  @ApiOperation({
    summary: 'Subscribe to backend events',
    description: 'Server-Sent Events stream for updates affecting one wallet address.',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'Wallet address receiving affected-user events',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream',
  })
  stream(@Query('userId') userId?: string): Observable<MessageEvent> {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      throw new BadRequestException('userId is required');
    }
    return this.eventsService.stream(normalizedUserId);
  }
}
