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

export interface ProjectEventFilter {
  projectId?: string;
  type?: string;
}

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<ProjectEvent>();
  private sequence = 0;

  stream(filterOptions: ProjectEventFilter = {}): Observable<MessageEvent> {
    const connected: MessageEvent = {
      type: 'connected',
      data: {
        type: 'connected',
        timestamp: new Date().toISOString(),
      },
    };

    return merge(of(connected), this.events$.pipe(
      filter((event) => this.matchesFilter(event, filterOptions)),
      map((event): MessageEvent => ({
        id: event.id,
        type: event.type,
        data: event,
      })),
    ));
  }

  publishProjectEvent(type: string, payload: ProjectEventPayload): ProjectEvent {
    const event: ProjectEvent = {
      id: `${Date.now()}-${++this.sequence}`,
      type,
      timestamp: new Date().toISOString(),
      projectId: payload.projectId,
      data: payload,
    };

    this.events$.next(event);
    return event;
  }

  private matchesFilter(event: ProjectEvent, filterOptions: ProjectEventFilter): boolean {
    if (filterOptions.projectId && event.projectId !== filterOptions.projectId) return false;
    if (filterOptions.type && event.type !== filterOptions.type) return false;
    return true;
  }
}
