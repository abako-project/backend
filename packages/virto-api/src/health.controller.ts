import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Sonda de vida para el healthcheck del compose.
 *
 * Comprueba que el directorio de vos-mock sea escribible, no solo que el
 * proceso escuche: ahí vive el mapeo passkey -> dirección de wallet, y si el
 * volumen no está montado el servicio responde pero pierde identidades.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(@Res() res: Response) {
    const dataDir = process.env.VOS_DATA_PATH || path.join(process.cwd(), 'data');

    let storage = 'up';
    try {
      fs.accessSync(dataDir, fs.constants.W_OK);
    } catch {
      storage = 'down';
    }

    const healthy = storage === 'up';
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'error',
      storage,
      uptime: Math.round(process.uptime()),
    });
  }
}
