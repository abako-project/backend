import { Controller, Headers, HttpCode, HttpStatus, MessageEvent, Post, Res, Sse, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { EventsService } from './events.service';

const SSE_COOKIE_NAME = 'abako_sse_token';

@ApiTags('Events')
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly authService: AuthService,
  ) {}

  @Post('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Create a one-use SSE session cookie',
    description: 'Validates the bearer JWT and sets an HttpOnly cookie used only to open the SSE stream.',
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'Bearer token for authentication',
  })
  @ApiResponse({ status: 204, description: 'SSE session cookie created' })
  @ApiResponse({ status: 401, description: 'Invalid or missing bearer token' })
  async createSession(
    @Headers('authorization') authHeader: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.extractBearerToken(authHeader);
    const recipientAddress = await this.authService.getAddress(token);
    const sseToken = this.eventsService.createSseSession(recipientAddress);
    response.setHeader('Set-Cookie', this.serializeSseCookie(sseToken, 60));
  }

  @Sse()
  @ApiOperation({
    summary: 'Subscribe to backend events',
    description: 'Server-Sent Events stream for updates affecting the wallet authenticated by the SSE cookie.',
  })
  @ApiHeader({ name: 'Cookie', required: true, description: `${SSE_COOKIE_NAME}=<one-use-token>` })
  @ApiResponse({
    status: 200,
    description: 'SSE stream',
  })
  stream(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Observable<MessageEvent> {
    const sseToken = this.getCookie(cookieHeader, SSE_COOKIE_NAME);
    if (!sseToken) {
      throw new UnauthorizedException('SSE session cookie is required');
    }
    const recipientAddress = this.eventsService.consumeSseSession(sseToken);
    response.setHeader('Set-Cookie', this.serializeSseCookie('', 0));
    return this.eventsService.stream(recipientAddress);
  }

  private extractBearerToken(authHeader: string | undefined): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return authHeader.slice('Bearer '.length).trim();
  }

  private getCookie(cookieHeader: string | undefined, name: string): string | null {
    const cookies = cookieHeader?.split(';') ?? [];
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return null;
  }

  private serializeSseCookie(value: string, maxAge: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SSE_COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/v1/events; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  }
}
