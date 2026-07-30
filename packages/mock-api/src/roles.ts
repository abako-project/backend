import { registryDatabase } from "./registry-database.js";

export const COORDINATOR_ROLE_ID = 1;

export interface Role {
  id: number;
  name: string;
  selectable: boolean;
}

export class RoleError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RoleError(400, "name is required");
  }
  return value.trim().toLowerCase();
}

export class RoleRegistry {
  private readonly db = registryDatabase;

  constructor() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        selectable INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL,
        role_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, role_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
      );
    `);
    this.seed();
  }

  listRoles(): Role[] {
    return this.db.prepare(
      "SELECT id, name, selectable FROM roles ORDER BY id",
    ).all().map(this.toRole);
  }

  getRole(id: number): Role {
    const row = this.db.prepare(
      "SELECT id, name, selectable FROM roles WHERE id = ?",
    ).get(id) as { id: number; name: string; selectable: number } | undefined;
    if (!row) throw new RoleError(404, "Role not found");
    return this.toRole(row);
  }

  createRole(value: unknown): Role {
    const name = normalizeName(value);
    try {
      const result = this.db.prepare(
        "INSERT INTO roles (name, selectable) VALUES (?, 1)",
      ).run(name);
      return this.getRole(Number(result.lastInsertRowid));
    } catch (error: any) {
      if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new RoleError(409, "Role already exists");
      }
      throw error;
    }
  }

  updateRole(id: number, value: unknown): Role {
    if (id === COORDINATOR_ROLE_ID) {
      throw new RoleError(409, "Coordinator role is reserved");
    }
    this.getRole(id);
    const name = normalizeName(value);
    try {
      this.db.prepare("UPDATE roles SET name = ? WHERE id = ?").run(name, id);
      return this.getRole(id);
    } catch (error: any) {
      if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new RoleError(409, "Role already exists");
      }
      throw error;
    }
  }

  deleteRole(id: number): void {
    if (id === COORDINATOR_ROLE_ID) {
      throw new RoleError(409, "Coordinator role is reserved");
    }
    this.getRole(id);
    const assigned = this.db.prepare(
      "SELECT 1 FROM user_roles WHERE role_id = ? LIMIT 1",
    ).get(id);
    if (assigned) throw new RoleError(409, "Role is assigned to users");
    const assignedToSkill = this.db.prepare(
      "SELECT 1 FROM skill_roles WHERE role_id = ? LIMIT 1",
    ).get(id);
    if (assignedToSkill) throw new RoleError(409, "Role is assigned to skills");
    this.db.prepare("DELETE FROM roles WHERE id = ?").run(id);
  }

  setRegistrationRoles(userId: string, value: unknown): Role[] {
    const roles = this.validateSelectableRoles(value);
    const transaction = this.db.transaction(() => {
      this.db.prepare(
        "DELETE FROM user_roles WHERE user_id = ? AND role_id != ?",
      ).run(userId, COORDINATOR_ROLE_ID);
      const insert = this.db.prepare(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
      );
      for (const role of roles) insert.run(userId, role.id);
    });
    transaction();
    return this.getUserRoles(userId);
  }

  setCoordinator(userId: string, enabled: boolean): Role[] {
    if (enabled) {
      this.db.prepare(
        "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)",
      ).run(userId, COORDINATOR_ROLE_ID);
    } else {
      this.db.prepare(
        "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
      ).run(userId, COORDINATOR_ROLE_ID);
    }
    return this.getUserRoles(userId);
  }

  getUserRoles(userId: string): Role[] {
    return this.db.prepare(`
      SELECT roles.id, roles.name, roles.selectable
      FROM roles
      JOIN user_roles ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = ?
      ORDER BY roles.id
    `).all(userId).map(this.toRole);
  }

  hasRole(userId: string | null, roleId: number): boolean {
    if (!userId) return false;
    return Boolean(this.db.prepare(
      "SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?",
    ).get(userId, roleId));
  }

  private validateSelectableRoles(value: unknown): Role[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new RoleError(400, "roleIds must contain at least one role");
    }
    if (!value.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0)) {
      throw new RoleError(400, "roleIds must contain positive integers");
    }
    if (new Set(value).size !== value.length) {
      throw new RoleError(400, "roleIds must not contain duplicates");
    }
    let roles: Role[];
    try {
      roles = value.map((id) => this.getRole(id));
    } catch (error) {
      if (error instanceof RoleError && error.status === 404) {
        throw new RoleError(400, "roleIds contains an unknown role");
      }
      throw error;
    }
    if (roles.some((role) => !role.selectable)) {
      throw new RoleError(400, "roleIds contains a non-selectable role");
    }
    return roles;
  }

  private seed(): void {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO roles (id, name, selectable) VALUES (?, ?, ?)",
    );
    const transaction = this.db.transaction(() => {
      [
        [1, "coordinator", 0],
        [2, "frontend", 1],
        [3, "backend", 1],
        [4, "fullstack", 1],
        [5, "designer", 1],
        [6, "qa", 1],
        [7, "architect", 1],
        [8, "embedded", 1],
        [9, "devops", 1],
      ].forEach((role) => insert.run(...role));
    });
    transaction();
  }

  private toRole(row: any): Role {
    return { id: row.id, name: row.name, selectable: Boolean(row.selectable) };
  }
}

export const roleRegistry = new RoleRegistry();
