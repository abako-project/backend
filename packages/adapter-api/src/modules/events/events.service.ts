import { Injectable, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Observable, Subject, filter, map, merge, of } from 'rxjs';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';

export interface ProjectEventPayload {
  projectId: string;
  contractAddress?: string | null;
  state?: string;
  actor?: string;
  data?: Record<string, unknown>;
}

export interface BackendEvent {
  id: string;
  type: string;
  timestamp: string;
  projectId?: string;
  data: unknown;
}

export interface ProjectEvent extends BackendEvent {
  data: ProjectEventPayload;
}

interface RoutedBackendEvent {
  event: BackendEvent;
  userIds: Set<string>;
}

interface PendingSseToken {
  recipientAddress: string;
  expiresAt: number;
}

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<RoutedBackendEvent>();
  private readonly pendingSseTokens = new Map<string, PendingSseToken>();
  private sequence = 0;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

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

  async publishProjectEvent(
    type: string,
    payload: ProjectEventPayload,
    userIds: Array<string | null | undefined>,
  ): Promise<ProjectEvent> {
    const event: ProjectEvent = {
      id: `${Date.now()}-${++this.sequence}`,
      type,
      timestamp: new Date().toISOString(),
      projectId: payload.projectId,
      data: payload,
    };
    const recipients = this.normalizeUserIds(userIds);

    if (recipients.size > 0) {
      const notifications = this.notificationRepo.create([...recipients].map((recipientAddress) => ({
        eventId: event.id,
        recipientAddress,
        type: event.type,
        projectId: event.projectId ?? null,
        data: event.data,
        readAt: null,
      })));
      await this.notificationRepo.save(notifications);
    }

    this.events$.next({ event, userIds: recipients });
    return event;
  }

  publishNotificationRead(recipientAddress: string, notificationId: string, readAt: Date): void {
    this.events$.next({
      event: this.createControlEvent('notification.read', {
        id: notificationId,
        readAt: readAt.toISOString(),
      }),
      userIds: this.normalizeUserIds([recipientAddress]),
    });
  }

  publishNotificationsReadAll(recipientAddress: string, ids: string[], readAt: Date): void {
    this.events$.next({
      event: this.createControlEvent('notification.read_all', {
        ids,
        readAt: readAt.toISOString(),
      }),
      userIds: this.normalizeUserIds([recipientAddress]),
    });
  }

  createSseSession(recipientAddress: string): string {
    const normalizedAddress = recipientAddress.trim();
    if (!normalizedAddress) {
      throw new UnauthorizedException('Token does not include a wallet address');
    }

    this.cleanupExpiredSseTokens();
    const token = crypto.randomUUID();
    this.pendingSseTokens.set(token, {
      recipientAddress: normalizedAddress,
      expiresAt: Date.now() + 60_000,
    });
    return token;
  }

  consumeSseSession(token: string): string {
    this.cleanupExpiredSseTokens();
    const pending = this.pendingSseTokens.get(token);
    if (!pending) {
      throw new UnauthorizedException('SSE token has already been used or expired');
    }
    this.pendingSseTokens.delete(token);
    return pending.recipientAddress;
  }

  private createControlEvent(type: string, data: Record<string, unknown>): BackendEvent {
    return {
      id: `${Date.now()}-${++this.sequence}`,
      type,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private normalizeUserIds(userIds: Array<string | null | undefined>): Set<string> {
    return new Set(userIds.map((userId) => userId?.trim()).filter(Boolean) as string[]);
  }

  private cleanupExpiredSseTokens(): void {
    const now = Date.now();
    for (const [token, pending] of this.pendingSseTokens) {
      if (pending.expiresAt <= now) {
        this.pendingSseTokens.delete(token);
      }
    }
  }

}
