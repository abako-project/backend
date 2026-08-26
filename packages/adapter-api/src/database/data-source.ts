import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options';

dotenv.config();

/**
 * DataSource para la CLI de TypeORM (generar y aplicar migraciones).
 *
 * Se ejecuta siempre contra el binario compilado (dist/), no vía ts-node: la
 * CLI resuelve un data-source.ts como ESM y revienta con
 * "Directory import ... is not supported" pese al tsconfig CommonJS.
 * Compilar primero cuesta unos segundos y evita esa pelea entera.
 *
 * Ver los scripts migration:* del package.json.
 */
export default new DataSource(buildDataSourceOptions());
