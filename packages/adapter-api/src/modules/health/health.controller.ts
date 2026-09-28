import { Controller, Get, Res, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Response } from 'express';

/**
 * Sonda de vida para el healthcheck del compose y para deploy.sh.
 *
 * Comprueba la base de datos, no solo que el proceso esté vivo: un
 * adapter-api que ha perdido Postgres acepta conexiones TCP y responde 500 a
 * todo, y desde fuera parece sano. Ese era justo el agujero de los
 * healthchecks anteriores (`docker ps ... "Up"`).
 *
 * Devuelve 503 si la base no responde, para que Docker lo marque unhealthy y
 * el despliegue no dé por bueno un servicio roto.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Version(VERSION_NEUTRAL)
  @Get()
  async check(@Res() res: Response) {
    let database = 'up';
    try {
      await this.dataSource.query('SELECT 1');
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
