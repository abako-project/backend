import { BadRequestException } from '@nestjs/common';
import { EventsController } from '../src/modules/events/events.controller';
import { EventsService } from '../src/modules/events/events.service';

describe('user-scoped events', () => {
  it('routes events only to affected wallet addresses', () => {
    const service = new EventsService();
    const walletEvents: any[] = [];
    const otherEvents: any[] = [];

    service.stream('wallet-1').subscribe((event) => walletEvents.push(event));
    service.stream('wallet-2').subscribe((event) => otherEvents.push(event));
    service.publishProjectEvent(
      'project.scope_proposed',
      { projectId: 'project-1' },
      ['wallet-1', 'wallet-1'],
    );

    expect(walletEvents).toHaveLength(2);
    expect(walletEvents[1].data).not.toHaveProperty('userIds');
    expect(otherEvents).toHaveLength(1);
    expect(() => new EventsController(service).stream(' ')).toThrow(BadRequestException);
  });
});
