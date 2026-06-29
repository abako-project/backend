import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, of } from 'rxjs';

export interface ProjectEventPayload {
  projectId: string;
  contractAddress?: string | null;
  state?: string;
  actor?: string;
  data?: Record<string, unknown>;
}

export interface ProjectEvent {
  id: string;
  type: string;
  timestamp: string;
  projectId?: string;
  data: ProjectEventPayload;
}

interface RoutedProjectEvent {
  event: ProjectEvent;
  userIds: Set<string>;
}

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<RoutedProjectEvent>();
  private sequence = 0;

  stream(userId: string): Observable<MessageEvent> {
    const connected: MessageEvent = {
      type: 'connected',
      data: {
        type: 'connected',
        timestamp: new Date().toISOString(),
      },
    };

    return merge(of(connected), this.events$.pipe(
      filter((routedEvent) => routedEvent.userIds.has(userId)),
      map(({ event }): MessageEvent => ({
        id: event.id,
        type: event.type,
        data: event,
      })),
    ));
  }

  publishProjectEvent(
    type: string,
    payload: ProjectEventPayload,
    userIds: Array<string | null | undefined>,
  ): ProjectEvent {
    const event: ProjectEvent = {
      id: `${Date.now()}-${++this.sequence}`,
      type,
      timestamp: new Date().toISOString(),
      projectId: payload.projectId,
      data: payload,
    };

    this.events$.next({
      event,
      userIds: new Set(userIds.map((userId) => userId?.trim()).filter(Boolean) as string[]),
    });
    return event;
  }
}
