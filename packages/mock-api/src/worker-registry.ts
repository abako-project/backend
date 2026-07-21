import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const AVAILABILITY_WEEKS = 12;
export const MAX_WEEKLY_HOURS = 60;

export type SkillCategory = "software" | "soft";

export interface WorkerSeed {
  walletAddress: string;
  userId: string;
  name: string;
  skillIds: number[];
  weeklyHours?: number[];
  permanentWeeklyHours?: number | null;
}

export interface WorkerRecord {
  walletAddress: string;
  userId: string | null;
  name: string | null;
  skillIds: number[];
  availability: Array<{ weekStart: string; hours: number }>;
  totalHours: number;
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function validateHours(hours: unknown): number {
  const parsed = Number(hours);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_WEEKLY_HOURS) {
    throw new Error(`Weekly availability must be an integer from 0 to ${MAX_WEEKLY_HOURS}`);
  }
  return parsed;
}

function mondayUtc(date = new Date()): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function weekStartAt(offset: number): string {
  const date = mondayUtc();
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return date.toISOString().slice(0, 10);
}

function resolveDatabasePath(): string {
  const configured = process.env.MOCK_SQLITE_PATH || "./data/mock-registry.sqlite";
  if (configured === ":memory:") return configured;
  const absolute = resolve(configured);
  mkdirSync(dirname(absolute), { recursive: true });
  return absolute;
}

class WorkerRegistry {
  private readonly db = new Database(resolveDatabasePath());

  constructor() {
    this.db.pragma("foreign_keys = ON");
    const existingSkillColumns = this.db.prepare("PRAGMA table_info(skills)").all() as Array<{
      name: string;
    }>;
    if (existingSkillColumns.length > 0 && !existingSkillColumns.some((column) => column.name === "id")) {
      this.db.exec("DROP TABLE IF EXISTS worker_skills; DROP TABLE IF EXISTS skills;");
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL CHECK (category IN ('software', 'soft'))
      );

      CREATE TABLE IF NOT EXISTS workers (
        wallet_address TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        name TEXT,
        permanent_weekly_hours INTEGER
          CHECK (permanent_weekly_hours IS NULL OR permanent_weekly_hours BETWEEN 0 AND 60)
      );

      CREATE TABLE IF NOT EXISTS worker_skills (
        wallet_address TEXT NOT NULL,
        skill_id INTEGER NOT NULL,
        PRIMARY KEY (wallet_address, skill_id),
        FOREIGN KEY (wallet_address) REFERENCES workers(wallet_address) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS worker_availability (
        wallet_address TEXT NOT NULL,
        week_start TEXT NOT NULL,
        hours INTEGER NOT NULL CHECK (hours BETWEEN 0 AND 60),
        PRIMARY KEY (wallet_address, week_start),
        FOREIGN KEY (wallet_address) REFERENCES workers(wallet_address) ON DELETE CASCADE
      );
    `);
  }

  addSkill(id: number, name: string, category: SkillCategory = "software"): number {
    const normalized = normalizeSkill(name);
    if (!normalized) throw new Error("Skill name cannot be empty");
    this.db.prepare(`
      INSERT INTO skills (id, name, category) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category
    `).run(id, normalized, category);
    return id;
  }

  listSkills(): Array<{ id: number; name: string; category: SkillCategory }> {
    return this.db.prepare("SELECT id, name, category FROM skills ORDER BY id").all() as Array<{
      id: number;
      name: string;
      category: SkillCategory;
    }>;
  }

  upsertWorker(worker: Omit<WorkerSeed, "skillIds" | "weeklyHours"> & { skillIds?: number[] }): void {
    const permanent = worker.permanentWeeklyHours == null
      ? null
      : validateHours(worker.permanentWeeklyHours);

    this.db.prepare(`
      INSERT INTO workers (wallet_address, user_id, name, permanent_weekly_hours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, workers.user_id),
        name = COALESCE(excluded.name, workers.name),
        permanent_weekly_hours = COALESCE(excluded.permanent_weekly_hours, workers.permanent_weekly_hours)
    `).run(
      worker.walletAddress,
      worker.userId || null,
      worker.name || null,
      permanent,
    );

    if (worker.skillIds) this.setWorkerSkills(worker.walletAddress, worker.skillIds);
    this.ensureAvailabilityWindow(worker.walletAddress);
  }

  setWorkerSkills(walletAddress: string, skillIds: number[]): number[] {
    const normalized = [...new Set(skillIds.filter((id) => Number.isInteger(id) && id > 0))];
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM worker_skills WHERE wallet_address = ?").run(walletAddress);
      for (const skillId of normalized) {
        this.db.prepare(
          "INSERT OR IGNORE INTO worker_skills (wallet_address, skill_id) VALUES (?, ?)",
        ).run(walletAddress, skillId);
      }
    });
    transaction();
    return normalized;
  }

  setAvailability(
    walletAddress: string,
    input: unknown,
  ): Array<{ weekStart: string; hours: number }> {
    this.db.prepare(
      "INSERT OR IGNORE INTO workers (wallet_address) VALUES (?)",
    ).run(walletAddress);

    let weeks: number[];
    let permanent: number | null | undefined;
    const value = input as any;

    if (Array.isArray(value?.weeks)) {
      if (value.weeks.length !== AVAILABILITY_WEEKS) {
        throw new Error(`Availability must contain exactly ${AVAILABILITY_WEEKS} weeks`);
      }
      weeks = value.weeks.map(validateHours);
      permanent = value.permanentWeeklyHours == null
        ? undefined
        : validateHours(value.permanentWeeklyHours);
    } else if (value?.PermanentWeeklyHours != null || value?.type === "PermanentWeeklyHours") {
      permanent = validateHours(value.PermanentWeeklyHours ?? value.value);
      weeks = Array(AVAILABILITY_WEEKS).fill(permanent);
    } else if (value === "FullTime" || value?.type === "FullTime") {
      permanent = 40;
      weeks = Array(AVAILABILITY_WEEKS).fill(40);
    } else {
      const weekly = value?.WeeklyHours ?? (value?.type === "WeeklyHours" ? value.value : value);
      const hours = validateHours(weekly);
      weeks = Array(AVAILABILITY_WEEKS).fill(hours);
    }

    const transaction = this.db.transaction(() => {
      if (permanent !== undefined) {
        this.db.prepare(
          "UPDATE workers SET permanent_weekly_hours = ? WHERE wallet_address = ?",
        ).run(permanent, walletAddress);
      }
      this.db.prepare("DELETE FROM worker_availability WHERE wallet_address = ?").run(walletAddress);
      const insert = this.db.prepare(
        "INSERT INTO worker_availability (wallet_address, week_start, hours) VALUES (?, ?, ?)",
      );
      weeks.forEach((hours, index) => insert.run(walletAddress, weekStartAt(index), hours));
    });
    transaction();
    return this.getAvailability(walletAddress);
  }

  ensureAvailabilityWindow(walletAddress: string): void {
    const worker = this.db.prepare(
      "SELECT permanent_weekly_hours FROM workers WHERE wallet_address = ?",
    ).get(walletAddress) as { permanent_weekly_hours: number | null } | undefined;
    if (!worker) return;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO worker_availability (wallet_address, week_start, hours)
      VALUES (?, ?, ?)
    `);
    for (let index = 0; index < AVAILABILITY_WEEKS; index += 1) {
      insert.run(walletAddress, weekStartAt(index), worker.permanent_weekly_hours ?? 0);
    }
  }

  getAvailability(walletAddress: string): Array<{ weekStart: string; hours: number }> {
    this.ensureAvailabilityWindow(walletAddress);
    return this.db.prepare(`
      SELECT week_start AS weekStart, hours
      FROM worker_availability
      WHERE wallet_address = ? AND week_start >= ?
      ORDER BY week_start
      LIMIT ?
    `).all(walletAddress, weekStartAt(0), AVAILABILITY_WEEKS) as Array<{
      weekStart: string;
      hours: number;
    }>;
  }

  getWorker(walletAddress: string): WorkerRecord | null {
    const worker = this.db.prepare(`
      SELECT wallet_address AS walletAddress, user_id AS userId, name
      FROM workers WHERE wallet_address = ?
    `).get(walletAddress) as {
      walletAddress: string;
      userId: string | null;
      name: string | null;
    } | undefined;
    if (!worker) return null;

    const skillIds = this.db.prepare(`
      SELECT skill_id AS id FROM worker_skills
      WHERE wallet_address = ? ORDER BY skill_id
    `).all(walletAddress).map((row: any) => row.id as number);
    const availability = this.getAvailability(walletAddress);

    return {
      ...worker,
      skillIds,
      availability,
      totalHours: availability.reduce((total, week) => total + week.hours, 0),
    };
  }

  listWorkers(walletAddresses?: Iterable<string>): WorkerRecord[] {
    const allowed = walletAddresses ? new Set(walletAddresses) : null;
    const addresses = this.db.prepare(
      "SELECT wallet_address AS walletAddress FROM workers ORDER BY wallet_address",
    ).all() as Array<{ walletAddress: string }>;
    return addresses
      .filter(({ walletAddress }) => !allowed || allowed.has(walletAddress))
      .map(({ walletAddress }) => this.getWorker(walletAddress))
      .filter((worker): worker is WorkerRecord => worker !== null);
  }

  reserveHours(walletAddress: string, requiredHours: number): void {
    const hours = Number(requiredHours);
    if (!Number.isInteger(hours) || hours <= 0) {
      throw new Error("Assignment hours must be a positive integer");
    }

    const transaction = this.db.transaction(() => {
      const availability = this.getAvailability(walletAddress);
      const total = availability.reduce((sum, week) => sum + week.hours, 0);
      if (total < hours) throw new Error(`Worker ${walletAddress} lacks ${hours} available hours`);

      let remaining = hours;
      const update = this.db.prepare(`
        UPDATE worker_availability SET hours = ? WHERE wallet_address = ? AND week_start = ?
      `);
      for (const week of availability) {
        if (remaining === 0) break;
        const consumed = Math.min(week.hours, remaining);
        update.run(week.hours - consumed, walletAddress, week.weekStart);
        remaining -= consumed;
      }
    });
    transaction();
  }

  reserveAssignments(assignments: Array<{ walletAddress: string; hours: number }>): void {
    const totals = new Map<string, number>();
    for (const assignment of assignments) {
      if (!Number.isInteger(assignment.hours) || assignment.hours <= 0) {
        throw new Error("Assignment hours must be a positive integer");
      }
      totals.set(
        assignment.walletAddress,
        (totals.get(assignment.walletAddress) || 0) + assignment.hours,
      );
    }

    const transaction = this.db.transaction(() => {
      for (const [walletAddress, hours] of totals) {
        const totalAvailable = this.getAvailability(walletAddress)
          .reduce((sum, week) => sum + week.hours, 0);
        if (totalAvailable < hours) {
          throw new Error(`Worker ${walletAddress} lacks ${hours} available hours`);
        }
      }

      for (const assignment of assignments) {
        let remaining = assignment.hours;
        const availability = this.getAvailability(assignment.walletAddress);
        const update = this.db.prepare(`
          UPDATE worker_availability SET hours = ? WHERE wallet_address = ? AND week_start = ?
        `);
        for (const week of availability) {
          if (remaining === 0) break;
          const consumed = Math.min(week.hours, remaining);
          update.run(week.hours - consumed, assignment.walletAddress, week.weekStart);
          remaining -= consumed;
        }
      }
    });
    transaction();
  }

  seed(skills: Array<{ id: number; name: string; category: SkillCategory }>, workers: WorkerSeed[]): void {
    const transaction = this.db.transaction(() => {
      for (const skill of skills) this.addSkill(skill.id, skill.name, skill.category);
      for (const worker of workers) {
        this.upsertWorker(worker);
        if (worker.weeklyHours) this.setAvailability(worker.walletAddress, { weeks: worker.weeklyHours });
        else if (worker.permanentWeeklyHours != null) {
          this.setAvailability(worker.walletAddress, {
            PermanentWeeklyHours: worker.permanentWeeklyHours,
          });
        }
      }
    });
    transaction();
  }
}

export const workerRegistry = new WorkerRegistry();
