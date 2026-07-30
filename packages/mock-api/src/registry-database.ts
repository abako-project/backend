import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const configured = process.env.MOCK_SQLITE_PATH || "./data/mock-registry.sqlite";
const databasePath = configured === ":memory:" ? configured : resolve(configured);

if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });

export const registryDatabase = new Database(databasePath);
registryDatabase.pragma("foreign_keys = ON");
