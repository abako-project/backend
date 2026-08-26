import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

/**
 * Sonda de vida para el healthcheck del compose.
 * Comprueba la base, no solo que el proceso escuche.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response) {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    const healthy = database === 'up';
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'error',
      database,
      uptime: Math.round(process.uptime()),
    });
  }
}
