import { NotFoundException } from '@nestjs/common';
import { Notification } from '../src/database/entities/notification.entity';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('notifications', () => {
  it('lists notifications only for the authenticated wallet', async () => {
    const notificationRepo = {
      find: jest.fn(async () => []),
    };
    const service = new NotificationsService(notificationRepo as any, {} as any);

    await service.list('wallet-1', 'unread');

    expect(notificationRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recipientAddress: 'wallet-1' }),
      order: { createdAt: 'DESC' },
    }));
  });

  it('marks one own notification as read and broadcasts it', async () => {
    const notification: Notification = {
      id: 'notification-1',
      eventId: 'event-1',
      recipientAddress: 'wallet-1',
      type: 'project.scope_proposed',
      projectId: 'project-1',
      data: {},
      readAt: null,
      createdAt: new Date(),
    };
    const notificationRepo = {
      findOne: jest.fn(async ({ where }) => where.recipientAddress === 'wallet-1' ? notification : null),
      save: jest.fn(async (saved) => saved),
    };
    const eventsService = {
      publishNotificationRead: jest.fn(),
    };
    const service = new NotificationsService(notificationRepo as any, eventsService as any);

    const saved = await service.markRead('wallet-1', 'notification-1');

    expect(saved.readAt).toBeInstanceOf(Date);
    expect(eventsService.publishNotificationRead)
      .toHaveBeenCalledWith('wallet-1', 'notification-1', saved.readAt);
    await expect(service.markRead('wallet-2', 'notification-1')).rejects.toThrow(NotFoundException);
  });

  it('marks all own unread notifications as read and broadcasts changed ids', async () => {
    const notifications = [
      { id: 'notification-1', readAt: null },
      { id: 'notification-2', readAt: null },
    ] as Notification[];
    const notificationRepo = {
      find: jest.fn(async () => notifications),
      save: jest.fn(async (saved) => saved),
    };
    const eventsService = {
      publishNotificationsReadAll: jest.fn(),
    };
    const service = new NotificationsService(notificationRepo as any, eventsService as any);

    const result = await service.markAllRead('wallet-1');

    expect(result).toEqual(expect.objectContaining({
      ids: ['notification-1', 'notification-2'],
      count: 2,
    }));
    expect(notificationRepo.save).toHaveBeenCalledWith(notifications);
    expect(eventsService.publishNotificationsReadAll)
      .toHaveBeenCalledWith('wallet-1', ['notification-1', 'notification-2'], expect.any(Date));
  });
});
