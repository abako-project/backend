import { UnauthorizedException } from '@nestjs/common';
import { EventsController } from '../src/modules/events/events.controller';
import { EventsService } from '../src/modules/events/events.service';

describe('user-scoped events', () => {
  const createNotificationRepo = () => ({
    create: jest.fn((rows) => rows),
    save: jest.fn(async (rows) => rows),
  });

  it('persists and routes events only to affected wallet addresses', async () => {
    const notificationRepo = createNotificationRepo();
    const service = new EventsService(notificationRepo as any);
    const walletEvents: any[] = [];
    const otherEvents: any[] = [];

    service.stream('wallet-1').subscribe((event) => walletEvents.push(event));
    service.stream('wallet-2').subscribe((event) => otherEvents.push(event));
    await service.publishProjectEvent(
      'project.scope_proposed',
      { projectId: 'project-1' },
      ['wallet-1', 'wallet-1'],
    );

    expect(notificationRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientAddress: 'wallet-1',
        type: 'project.scope_proposed',
        projectId: 'project-1',
      }),
    ]);
    expect(walletEvents).toHaveLength(2);
    expect(walletEvents[1].data).not.toHaveProperty('userIds');
    expect(otherEvents).toHaveLength(1);
  });

  it('creates one-use HttpOnly SSE cookies', async () => {
    const service = new EventsService(createNotificationRepo() as any);
    const authService = { getAddress: jest.fn(async () => 'wallet-1') };
    const controller = new EventsController(service, authService as any);
    const response = { setHeader: jest.fn() };

    await controller.createSession('Bearer login-token', response as any);

    const cookie = response.setHeader.mock.calls[0][1] as string;
    expect(cookie).toContain('abako_sse_token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/v1/events');
    expect(cookie).not.toContain('login-token');

    const sseToken = cookie.match(/abako_sse_token=([^;]+)/)?.[1];
    expect(sseToken).toBeTruthy();

    const streamResponse = { setHeader: jest.fn() };
    expect(controller.stream(`abako_sse_token=${sseToken}`, streamResponse as any)).toBeDefined();
    expect(streamResponse.setHeader.mock.calls[0][1]).toContain('Max-Age=0');
    expect(() => controller.stream(`abako_sse_token=${sseToken}`, streamResponse as any))
      .toThrow(UnauthorizedException);
  });

  it('rejects streams without the SSE cookie', () => {
    const service = new EventsService(createNotificationRepo() as any);
    const controller = new EventsController(service, { getAddress: jest.fn() } as any);
    expect(() => controller.stream(undefined, { setHeader: jest.fn() } as any))
      .toThrow(UnauthorizedException);
  });
});
