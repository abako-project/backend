/**
 * Selección de driver y tipos de columna que no son portables entre motores.
 *
 * Módulo aparte y sin dependencias a propósito: lo importan tanto las entidades
 * como database.options.ts, y si viviera en cualquiera de los dos habría ciclo.
 *
 * Los tipos se resuelven al cargar el módulo, es decir cuando se evalúan los
 * decoradores @Column. DB_TYPE tiene que estar en el entorno antes de arrancar
 * el proceso — que es como llega, desde el .env del compose.
 */
export function isPostgres(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.DB_TYPE ?? 'sqlite').toLowerCase() === 'postgres';
}

/** SQLite: blob. Postgres no lo conoce; su equivalente es bytea. */
export const BINARY_COLUMN = isPostgres() ? 'bytea' : 'blob';

/** SQLite: datetime. En Postgres, timestamp. */
export const DATETIME_COLUMN = isPostgres() ? 'timestamp' : 'datetime';

/**
 * Columnas que guardan epoch en milisegundos (Date.now()).
 *
 * El INTEGER de SQLite ocupa hasta 8 bytes y traga 1.78e12 sin pestañear; el
 * de Postgres son 4 bytes y desborda a partir de 2147483647. De ahí bigint.
 *
 * Postgres devuelve bigint como string para no perder precisión, así que el
 * transformer lo vuelve a number y el resto del código no se entera de en qué
 * motor está. Es seguro hasta 2^53: un epoch-ms no se acerca ni de lejos.
 *
 * ponytail: budget y deliveryTime siguen siendo integer porque hoy son
 * importes y duraciones pequeños (15000, 20). Si budget pasa a ser plancks
 * on-chain, desborda igual y toca traerlo aquí.
 */
export const EPOCH_MS_COLUMN = isPostgres() ? 'bigint' : 'integer';

export const epochMsTransformer = {
  to: (value: number | null) => value,
  from: (value: string | number | null) => (value === null ? null : Number(value)),
};
