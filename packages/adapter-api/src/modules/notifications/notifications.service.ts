import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { EventsService } from '../events/events.service';

export type NotificationStatus = 'unread' | 'read' | 'all';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly eventsService: EventsService,
  ) {}

  async list(recipientAddress: string, status: NotificationStatus = 'all'): Promise<Notification[]> {
    const where: any = { recipientAddress };
    if (status === 'unread') {
      where.readAt = IsNull();
    } else if (status === 'read') {
      where.readAt = Not(IsNull());
    } else if (status !== 'all') {
      throw new BadRequestException('Invalid notification status');
    }

    return this.notificationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(recipientAddress: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id, recipientAddress },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.readAt) {
      return notification;
    }

    notification.readAt = new Date();
    const saved = await this.notificationRepo.save(notification);
    this.eventsService.publishNotificationRead(recipientAddress, saved.id, saved.readAt!);
    return saved;
  }

  async markAllRead(recipientAddress: string): Promise<{ ids: string[]; readAt: string; count: number }> {
    const notifications = await this.notificationRepo.find({
      where: { recipientAddress, readAt: IsNull() },
    });
    const readAt = new Date();
    const ids = notifications.map((notification) => notification.id);

    if (notifications.length > 0) {
      for (const notification of notifications) {
        notification.readAt = readAt;
      }
      await this.notificationRepo.save(notifications);
      this.eventsService.publishNotificationsReadAll(recipientAddress, ids, readAt);
    }

    return {
      ids,
      readAt: readAt.toISOString(),
      count: ids.length,
    };
  }
}
