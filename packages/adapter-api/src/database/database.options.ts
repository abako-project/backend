import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities/all';
import { isPostgres } from './driver';

export { isPostgres };

/**
 * Driver dual (ADR-002, enmienda 1):
 *
 *   - SQLite  → desarrollo local y gate de CI. `synchronize` activo: la base es
 *               desechable y así `pnpm test:mock` no necesita infraestructura.
 *   - Postgres → las VPS. `synchronize` desactivado y migraciones explícitas,
 *               porque ahí los datos importan.
 *
 * El interruptor es DB_TYPE. Por omisión SQLite, que es el caso de quien clona
 * el repo y quiere arrancar sin Docker.
 */
function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`DB_TYPE=postgres requiere la variable ${key}.`);
  }
  return value;
}

export function buildDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
  sqlitePath = './data/abako.sqlite',
  /**
   * Solo la app arranca aplicando migraciones. La CLI tiene que abrir la
   * conexión sin tocar el esquema: si no, `migration:generate` aplica lo
   * pendiente antes de diffear y calcula la diferencia contra el esquema
   * equivocado.
   */
  migrationsRun = false,
): DataSourceOptions {
  if (!isPostgres(env)) {
    return {
      type: 'better-sqlite3',
      database: sqlitePath,
      entities: ENTITIES,
      synchronize: true,
    };
  }

  return {
    type: 'postgres',
    host: required(env, 'POSTGRES_HOST'),
    port: parseInt(env.POSTGRES_PORT ?? '5432', 10),
    username: required(env, 'POSTGRES_USER'),
    password: required(env, 'POSTGRES_PASSWORD'),
    database: required(env, 'POSTGRES_DB'),
    entities: ENTITIES,
    synchronize: false,
    migrationsRun,
    // Se resuelve desde dist/ en runtime y desde src/ bajo ts-node.
    migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
  };
}
