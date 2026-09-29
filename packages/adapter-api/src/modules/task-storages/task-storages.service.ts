import { HttpException, Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TaskStoragesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async get(hash: string, token: string) {
    return this.request(`/task-storages/${encodeURIComponent(hash)}`, token, { method: 'GET' });
  }

  async getTask(hash: string, taskId: string, token: string) {
    return this.request(
      `/task-storages/${encodeURIComponent(hash)}/tasks/${encodeURIComponent(taskId)}`,
      token,
      { method: 'GET' },
    );
  }

  async createTask(hash: string, body: Record<string, unknown>, token: string) {
    return this.request(`/task-storages/${encodeURIComponent(hash)}/tasks`, token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  async updateTask(hash: string, taskId: string, body: Record<string, unknown>, token: string) {
    return this.request(`/task-storages/${encodeURIComponent(hash)}/tasks/${encodeURIComponent(taskId)}`, token, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  private requireMockProvider(): void {
    if (process.env.USE_MOCK_AUTH !== 'true') {
      throw new NotImplementedException('Task storage provider is unavailable until the production smart contract is implemented');
    }
  }

  private async request(path: string, token: string, init: RequestInit) {
    this.requireMockProvider();
    const caller = await this.authService.getAddress(token);
    const response = await fetch(`${this.configService.getSigningServiceUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, 'X-Task-Storage-Caller': caller },
    });
    return this.handle(response);
  }

  private async handle(response: Response) {
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new HttpException(body.error || 'Task storage request failed', response.status);
    return body;
  }
}
