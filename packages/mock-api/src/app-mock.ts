// Dashboard-level routes for the frontend:
//   GET /auth/me        – current user from session token
//   GET /projects       – lightweight list of the current user's projects
//   GET /projects/:id   – full project detail (team + milestones)
//
// These live alongside the contract-RPC routes in contracts-mock.ts.
// Mount this router AFTER contractsRouter in index.ts so the literal
// /projects/{constructors,deploy,query,call} paths resolve first.
import type { Request } from "express";
import { Router } from "express";
import { store, MockContract, MockProjectInfo, MockTask, MockUser } from "./store.js";

export const appRouter = Router();

// ───────────────── auth ─────────────────

/**
 * Mock auth: the session "token" is just the userId.
 * Accepted in priority order:
 *   1. Authorization: Bearer <userId>
 *   2. X-User-Id: <userId>
 *   3. ?userId=<userId>
 */
function resolveCurrentUser(req: Request): MockUser | null {
  const auth = req.headers.authorization;
  let userId: string | undefined;
  if (auth?.startsWith("Bearer ")) userId = auth.slice("Bearer ".length).trim() || undefined;
  if (!userId) {
    const header = req.headers["x-user-id"];
    if (typeof header === "string") userId = header;
  }
  if (!userId && typeof req.query.userId === "string") userId = req.query.userId;
  if (!userId) return null;
  return store.users.get(userId) ?? null;
}

function displayNameFor(userId: string): string {
  const local = userId.split("@")[0] || userId;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function userSummary(u: MockUser) {
  return {
    id: u.userId,
    address: u.address,
    displayName: displayNameFor(u.userId),
  };
}

function userSummaryByAddress(address: string | null | undefined) {
  if (!address) return null;
  const u = store.getUserByAddress(address);
  if (u) return userSummary(u);
  return { id: null, address, displayName: address.slice(0, 6) + "…" + address.slice(-4) };
}

appRouter.get("/auth/me", (req, res) => {
  const user = resolveCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  res.json({
    ...userSummary(user),
    isMember: user.isMember,
  });
});

// ───────────────── projects ─────────────────

type ProjectRole = "client" | "coordinator" | "team";

/** Relation between the current user and a project, or null if none. */
function projectRoleFor(info: MockProjectInfo, userAddress: string): ProjectRole | null {
  if (info.client === userAddress) return "client";
  if (info.coordinator === userAddress) return "coordinator";
  if (info.team.some((m) => m.account_id === userAddress)) return "team";
  return null;
}

/** Treat contract tasks as milestones for the Kanban stats. */
function milestoneStats(info: MockProjectInfo) {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  for (const t of info.tasks) {
    if (t.completed) completed += 1;
    else if ("PendingReview" in t.status || "Active" in t.status) inProgress += 1;
    else pending += 1;
  }
  return { total: info.tasks.length, completed, inProgress, pending };
}

function teamSummary(info: MockProjectInfo) {
  return {
    count: info.team.length,
    members: info.team.map((m) => ({
      ...(userSummaryByAddress(m.account_id) ?? { address: m.account_id, id: null, displayName: m.account_id }),
    })),
  };
}

function projectListEntry(contract: MockContract, role: ProjectRole) {
  const info = contract.projectInfo!;
  const counterpartAddress = role === "client" ? info.coordinator : info.client;
  return {
    id: contract.address,
    contractAddress: contract.address,
    name: info.name,
    status: info.state,
    role,
    counterpart: userSummaryByAddress(counterpartAddress),
    teamSummary: teamSummary(info),
    milestoneStats: milestoneStats(info),
    totals: { totalCost: info.total_cost, paidAmount: info.paid_amount },
  };
}

function serializeMilestone(t: MockTask) {
  // Flatten the status enum to a string tag + optional block number
  const statusKey = Object.keys(t.status)[0] as keyof typeof t.status;
  const statusBlock = (t.status as any)[statusKey];
  return {
    id: t.id,
    title: `Task ${t.id}`,
    status: statusKey,
    statusBlock: typeof statusBlock === "number" ? statusBlock : null,
    completed: t.completed,
    cost: t.cost,
    complexity: t.complexity,
    dependencies: t.dependencies,
    assignedTo: userSummaryByAddress(t.assigned_to),
  };
}

appRouter.get("/projects", (req, res) => {
  const user = resolveCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const roleFilter = typeof req.query.role === "string" ? req.query.role : "all";
  const statusFilter = typeof req.query.status === "string" ? req.query.status : null;

  const projects: ReturnType<typeof projectListEntry>[] = [];
  for (const contract of store.contracts.values()) {
    if (contract.type !== "projects" || !contract.projectInfo) continue;
    const role = projectRoleFor(contract.projectInfo, user.address);
    if (!role) continue;
    if (roleFilter !== "all" && roleFilter !== role) continue;
    if (statusFilter && contract.projectInfo.state !== statusFilter) continue;
    projects.push(projectListEntry(contract, role));
  }

  res.json({ projects, total: projects.length });
});

appRouter.get("/projects/:id", (req, res) => {
  const user = resolveCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const contract = store.contracts.get(req.params.id);
  if (!contract || contract.type !== "projects" || !contract.projectInfo) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const info = contract.projectInfo;
  const role = projectRoleFor(info, user.address);
  if (!role) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    id: contract.address,
    contractAddress: contract.address,
    name: info.name,
    status: info.state,
    role,
    client: userSummaryByAddress(info.client),
    coordinator: userSummaryByAddress(info.coordinator),
    daoAddress: info.dao_address,
    calendarContract: info.calendar_contract,
    ratingsContract: info.ratings_contract,
    scope: info.scope
      ? {
          state: info.scope.state,
          advancePaymentPercentage: info.scope.advance_payment_percentage,
          documentHash: info.scope.document_hash,
        }
      : null,
    totals: { totalCost: info.total_cost, paidAmount: info.paid_amount },
    team: info.team.map((m) => ({
      ...(userSummaryByAddress(m.account_id) ?? { address: m.account_id, id: null, displayName: m.account_id }),
      rating: m.rating,
    })),
    milestones: info.tasks.map(serializeMilestone),
  });
});
