import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
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
    description: 'Server-Sent Events stream for project lifecycle updates. The current frontend does not consume this yet; it is exposed for future realtime UI updates.',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Optional project ID filter',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Optional event type filter, for example project.team_assigned',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream',
  })
  stream(
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
  ): Observable<MessageEvent> {
    return this.eventsService.stream({ projectId, type });
  }
}
