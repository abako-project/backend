import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MockUser } from "./store.js";

export const DEFAULT_ASSET_ID = 1;
export const DEFAULT_ASSET_SYMBOL = "KVN";
export const DEFAULT_INITIAL_BALANCE = "1000000";

function resolveDatabasePath(): string {
  const configured = process.env.MOCK_SQLITE_PATH || "./data/mock-registry.sqlite";
  if (configured === ":memory:") return configured;
  const absolute = resolve(configured);
  mkdirSync(dirname(absolute), { recursive: true });
  return absolute;
}

function parseAssetId(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_ASSET_ID);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("assetId must be a positive integer");
  return parsed;
}

export function parseAmount(value: unknown): bigint {
  if (typeof value === "bigint") {
    if (value <= 0n) throw new Error("amount must be positive");
    return value;
  }
  if (typeof value !== "string" && typeof value !== "number") throw new Error("amount must be positive");
  const text = String(value).trim();
  if (!/^[0-9]+$/.test(text)) throw new Error("amount must be a positive integer");
  const amount = BigInt(text);
  if (amount <= 0n) throw new Error("amount must be positive");
  return amount;
}

function parseBalance(value: unknown): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("balance cannot be negative");
    return value;
  }
  if (typeof value !== "string" && typeof value !== "number") throw new Error("balance cannot be negative");
  const text = String(value).trim();
  if (!/^[0-9]+$/.test(text)) throw new Error("balance cannot be negative");
  return BigInt(text);
}

class Ledger {
  private readonly db = new Database(resolveDatabasePath());

  constructor() {
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mock_assets (
        asset_id INTEGER PRIMARY KEY,
        symbol TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mock_balances (
        address TEXT NOT NULL,
        asset_id INTEGER NOT NULL,
        balance TEXT NOT NULL,
        PRIMARY KEY (address, asset_id),
        FOREIGN KEY (asset_id) REFERENCES mock_assets(asset_id)
      );

      CREATE TABLE IF NOT EXISTS mock_ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_address TEXT,
        to_address TEXT,
        asset_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at TEXT NOT NULL
      );
    `);
    this.seedAssets();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  seedAssets(): void {
    this.db.prepare(`
      INSERT INTO mock_assets (asset_id, symbol) VALUES (?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET symbol = excluded.symbol
    `).run(DEFAULT_ASSET_ID, DEFAULT_ASSET_SYMBOL);
  }

  seedInitialBalances(getOrCreateUser: (userId: string) => MockUser): void {
    const configured = process.env.MOCK_INITIAL_BALANCES_FILE || "./data/mock-balances.json";
    const absolute = resolve(configured);
    if (!existsSync(absolute)) return;

    const parsed = JSON.parse(readFileSync(absolute, "utf8")) as {
      fundedUsers?: string[];
    };
    for (const userId of parsed.fundedUsers || []) {
      if (typeof userId !== "string" || !userId.trim()) continue;
      const user = getOrCreateUser(userId);
      this.setBalance(user.address, DEFAULT_ASSET_ID, DEFAULT_INITIAL_BALANCE);
    }
  }

  setBalance(address: string, assetId: unknown, amount: unknown): void {
    const asset = parseAssetId(assetId);
    const balance = parseBalance(amount).toString();
    this.seedAssets();
    this.db.prepare(`
      INSERT INTO mock_balances (address, asset_id, balance) VALUES (?, ?, ?)
      ON CONFLICT(address, asset_id) DO UPDATE SET balance = excluded.balance
    `).run(address, asset, balance);
  }

  getBalance(address: string, assetId: unknown = DEFAULT_ASSET_ID): string {
    const asset = parseAssetId(assetId);
    const row = this.db.prepare(`
      SELECT balance FROM mock_balances WHERE address = ? AND asset_id = ?
    `).get(address, asset) as { balance: string } | undefined;
    return row?.balance || "0";
  }

  credit(address: string, assetId: unknown, amount: unknown, reason: string, ref?: string): void {
    const asset = parseAssetId(assetId);
    const delta = parseAmount(amount);
    const current = BigInt(this.getBalance(address, asset));
    this.setBalance(address, asset, current + delta);
    this.entry(null, address, asset, delta, reason, ref);
  }

  debit(address: string, assetId: unknown, amount: unknown, reason: string, ref?: string): void {
    const asset = parseAssetId(assetId);
    const delta = parseAmount(amount);
    const current = BigInt(this.getBalance(address, asset));
    if (current < delta) throw new Error(`Insufficient ${DEFAULT_ASSET_SYMBOL} balance`);
    this.setBalance(address, asset, current - delta);
    this.entry(address, null, asset, delta, reason, ref);
  }

  transfer(from: string, to: string, assetId: unknown, amount: unknown, reason: string, ref?: string): void {
    const asset = parseAssetId(assetId);
    const delta = parseAmount(amount);
    this.transaction(() => {
      const fromBalance = BigInt(this.getBalance(from, asset));
      if (fromBalance < delta) throw new Error(`Insufficient ${DEFAULT_ASSET_SYMBOL} balance`);
      const toBalance = BigInt(this.getBalance(to, asset));
      this.setBalance(from, asset, fromBalance - delta);
      this.setBalance(to, asset, toBalance + delta);
      this.entry(from, to, asset, delta, reason, ref);
    });
  }

  private entry(
    from: string | null,
    to: string | null,
    assetId: number,
    amount: bigint,
    reason: string,
    ref?: string,
  ): void {
    this.db.prepare(`
      INSERT INTO mock_ledger_entries
        (from_address, to_address, asset_id, amount, reason, ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(from, to, assetId, amount.toString(), reason, ref || null, new Date().toISOString());
  }
}

export const ledger = new Ledger();
