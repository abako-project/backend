// Mock routes for contracts-api endpoints (projects, calendar, ratings)
// Behavior mirrors the ink! smart contracts in ../../../contracts/
import { Router } from "express";
import { randomInt } from "node:crypto";
import {
  store,
  MockAssignment,
  MockMilestone,
  MockProjectInfo,
  MockRequirement,
  MockTask,
  MockTeamMember,
} from "./store.js";
import { SkillError, workerRegistry } from "./worker-registry.js";
import { DEFAULT_ASSET_ID, ledger } from "./ledger.js";
import { payments } from "./payments.js";
import { COORDINATOR_ROLE_ID, RoleError, roleRegistry } from "./roles.js";
import { registryDatabase } from "./registry-database.js";

export const contractsRouter = Router();

function normalizedSkillIds(skillIds: unknown): number[] {
  if (!Array.isArray(skillIds)) return [];
  return [...new Set(
    skillIds.map(Number).filter((id) => Number.isInteger(id) && id > 0),
  )].sort((a, b) => a - b);
}

function requiredRoleId(value: unknown): number {
  const roleId = Number(value);
  if (!Number.isInteger(roleId) || roleId <= 0) throw new Error("role_id must be a positive integer");
  roleRegistry.getRole(roleId);
  return roleId;
}

function unixTimestamp(): number {
  return Math.floor(Date.now() / 1_000);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 0xffffffff) {
    throw new Error(`${field} must be a positive u32 integer`);
  }
  return parsed;
}

function parseMilestones(value: unknown): Array<Omit<MockMilestone, "task_storage">> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("A proposal requires at least one milestone");
  }
  return value.map((milestone: any, milestoneIndex) => {
    const title = String(milestone?.title || "").trim();
    const description = String(milestone?.description || "");
    if (!title) throw new Error(`Milestone ${milestoneIndex} requires a title`);
    if (!Array.isArray(milestone?.requirements) || milestone.requirements.length === 0) {
      throw new Error(`Milestone ${milestoneIndex} requires at least one position`);
    }
    const requirements: MockRequirement[] = milestone.requirements.map((requirement: any) => {
      const assignmentKey = String(requirement?.assignment_key || "").trim().toLowerCase();
      const skillIds = normalizedSkillIds(requirement?.skill_ids);
      if (!assignmentKey) throw new Error(`Milestone ${milestoneIndex} has an invalid assignment key`);
      if (skillIds.length === 0) {
        throw new Error(`Milestone ${milestoneIndex} requirements must contain skill IDs`);
      }
      return {
        assignment_key: assignmentKey,
        role_id: requiredRoleId(requirement?.role_id),
        hours: positiveInteger(requirement?.hours, "hours"),
        skill_ids: skillIds,
      };
    });
    const assignmentKeys = requirements.map((requirement) => requirement.assignment_key);
    if (new Set(assignmentKeys).size !== assignmentKeys.length) {
      throw new Error(`Milestone ${milestoneIndex} contains duplicate assignment keys`);
    }
    return {
      title,
      description,
      budget: positiveInteger(milestone?.budget, "budget"),
      delivery_time_hours: positiveInteger(
        milestone?.delivery_time_hours,
        "delivery_time_hours",
      ),
      requirements,
    };
  });
}

function proposalFields(data: any) {
  const advancePaymentPercentage = Number(data?.advance_payment_percentage);
  if (
    !Number.isInteger(advancePaymentPercentage) ||
    advancePaymentPercentage < 0 ||
    advancePaymentPercentage > 100
  ) {
    throw new Error("advance_payment_percentage must be an integer from 0 to 100");
  }
  const documentHash = String(data?.document_hash || "").trim();
  if (!documentHash) throw new Error("document_hash is required");
  const milestones = parseMilestones(data?.milestones);
  return { advancePaymentPercentage, documentHash, milestones };
}

function milestoneTasks(milestones: MockMilestone[]): MockTask[] {
  return milestones.map((milestone, index) => ({
    id: index + 1,
    complexity: { type: "Hours", value: milestone.delivery_time_hours },
    cost: String(milestone.budget),
    dependencies: [],
    completed: false,
    status: { Pending: null },
    assigned_to: null,
    assignments: [],
    requirements: milestone.requirements,
  }));
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function ensureFunds(address: string, amount: number): void {
  if (amount <= 0) return;
  if (BigInt(ledger.getBalance(address, DEFAULT_ASSET_ID)) < BigInt(amount)) {
    throw new Error(`Insufficient KVN balance for ${address}`);
  }
}

function workerMatches(
  worker: ReturnType<typeof workerRegistry.listWorkers>[number],
  requirement: MockRequirement,
): boolean {
  const skills = new Set(worker.skillIds);
  return roleRegistry.hasRole(worker.userId, requirement.role_id) &&
    requirement.skill_ids.every((skillId) => skills.has(skillId));
}

function selectCandidate(
  candidates: ReturnType<typeof workerRegistry.listWorkers>,
  requirement: MockRequirement,
  excluded: Set<string>,
) {
  const eligible = candidates.filter((worker) => (
    !excluded.has(worker.walletAddress) && workerMatches(worker, requirement)
  ));
  return eligible.length > 0 ? randomItem(eligible) : null;
}

function planTeamForApprovedTasks(info: MockProjectInfo): {
  team: MockTeamMember[];
  assignments: Array<{ taskId: number; assignments: MockAssignment[] }>;
} {
  const registered = store.getRegisteredWorkers(info.calendar_contract);
  const approvedTasks = info.tasks.filter((task) => "Approved" in task.status);
  const excludedProjectAccounts = new Set([info.client, info.coordinator].filter(Boolean) as string[]);
  const workers = workerRegistry
    .listWorkers(registered)
    .filter((worker) => !excludedProjectAccounts.has(worker.walletAddress))
    .filter((worker) => worker.totalHours > 0);
  const assignmentsByKey = new Map<string, string>();
  const projectTeam = new Set<string>();
  const assignments: Array<{ taskId: number; assignments: MockAssignment[] }> = [];

  for (const task of approvedTasks) {
    if (task.requirements.length === 0) {
      throw new Error(`Task ${task.id} has no assignment requirements`);
    }
    const usedInMilestone = new Set<string>();
    const taskAssignments: MockAssignment[] = [];
    for (const requirement of task.requirements) {
      const previousAccount = assignmentsByKey.get(requirement.assignment_key);
      const previousWorker = previousAccount
        ? workers.find((worker) => worker.walletAddress === previousAccount)
        : undefined;

      let selected = previousWorker &&
        !usedInMilestone.has(previousWorker.walletAddress) &&
        workerMatches(previousWorker, requirement)
        ? previousWorker
        : null;

      if (!selected) {
        const existingTeam = workers.filter((worker) => projectTeam.has(worker.walletAddress));
        selected = selectCandidate(existingTeam, requirement, usedInMilestone);
      }
      if (!selected) {
        selected = selectCandidate(workers, requirement, usedInMilestone);
      }
      if (!selected) {
        throw new Error(
          `No worker covers ${requirement.assignment_key} for task ${task.id}`,
        );
      }

      usedInMilestone.add(selected.walletAddress);
      projectTeam.add(selected.walletAddress);
      assignmentsByKey.set(requirement.assignment_key, selected.walletAddress);
      taskAssignments.push({
        ...requirement,
        account_id: selected.walletAddress,
      });
    }
    assignments.push({
      taskId: task.id,
      assignments: taskAssignments,
    });
  }

  const uniqueWorkers = [...projectTeam];
  const team = uniqueWorkers.map((accountId): MockTeamMember => ({
    account_id: accountId,
    rating: null,
  }));
  for (const assignment of assignments) {
    const task = info.tasks.find((item) => item.id === assignment.taskId);
    if (!task) continue;
    task.assignments = assignment.assignments;
    task.assigned_to = assignment.assignments[0]?.account_id || null;
  }
  info.team = team;
  info.state = "TeamAssigned";
  return { team, assignments };
}

function activateTask(info: MockProjectInfo, task: MockTask): void {
  const registered = store.getRegisteredWorkers(info.calendar_contract);
  const globalWorkers = workerRegistry
    .listWorkers(registered)
    .filter((worker) => worker.walletAddress !== info.client)
    .filter((worker) => worker.walletAddress !== info.coordinator);
  const existingTeamAccounts = new Set(info.team.map((member) => member.account_id));
  const used = new Set<string>();
  const activatedAssignments: MockAssignment[] = [];

  for (const assignment of task.assignments) {
    const currentWorker = globalWorkers.find(
      (worker) => worker.walletAddress === assignment.account_id,
    );
    let selected = currentWorker &&
      !used.has(currentWorker.walletAddress) &&
      workerMatches(currentWorker, assignment) &&
      currentWorker.totalHours >= assignment.hours
      ? currentWorker
      : null;

    if (!selected) {
      const existingTeam = globalWorkers.filter((worker) => (
        existingTeamAccounts.has(worker.walletAddress) &&
        worker.totalHours >= assignment.hours
      ));
      selected = selectCandidate(existingTeam, assignment, used);
    }
    if (!selected) {
      const availableGlobal = globalWorkers.filter(
        (worker) => worker.totalHours >= assignment.hours,
      );
      selected = selectCandidate(availableGlobal, assignment, used);
    }
    if (!selected) {
      throw new Error(
        `No available worker for ${assignment.assignment_key}; try activation later`,
      );
    }

    used.add(selected.walletAddress);
    activatedAssignments.push({
      ...assignment,
      account_id: selected.walletAddress,
    });
  }

  workerRegistry.reserveAssignments(activatedAssignments.map((assignment) => ({
    walletAddress: assignment.account_id,
    hours: assignment.hours,
  })));
  task.assignments = activatedAssignments;
  task.assigned_to = activatedAssignments[0]?.account_id || null;
  task.status = { Active: store.nextBlockNumber() };

  for (const assignment of activatedAssignments) {
    if (!existingTeamAccounts.has(assignment.account_id)) {
      info.team.push({ account_id: assignment.account_id, rating: null });
      existingTeamAccounts.add(assignment.account_id);
    }
  }
}

function nextIncompleteTask(info: MockProjectInfo, afterTaskId?: number): MockTask | null {
  const ordered = info.tasks.filter((task) => !("Rejected" in task.status));
  const startIndex = afterTaskId == null
    ? 0
    : ordered.findIndex((task) => task.id === afterTaskId) + 1;
  return ordered.slice(Math.max(startIndex, 0)).find((task) => !task.completed) || null;
}

// --- Health ---
contractsRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "contracts-api (mock-api)",
    timestamp: new Date().toISOString(),
  });
});

contractsRouter.get("/mock/skills", (_req, res) => {
  res.json({ skills: workerRegistry.listSkills() });
});

contractsRouter.get("/mock/skills/ids", (req, res) => {
  try {
    const roleId = req.query.roleId === undefined ? undefined : Number(req.query.roleId);
    res.json({ skillIds: workerRegistry.listSkillIds(roleId) });
  } catch (error) {
    const status = error instanceof SkillError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Skill lookup failed" });
  }
});

contractsRouter.get("/mock/skills/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new SkillError(400, "Invalid skill id");
    res.json({ skill: workerRegistry.getSkill(id) });
  } catch (error) {
    const status = error instanceof SkillError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Skill lookup failed" });
  }
});

contractsRouter.post("/mock/skills", (req, res) => {
  try {
    const skill = workerRegistry.createSkill(req.body?.name, req.body?.category, req.body?.roleIds);
    res.status(201).json({ skill });
  } catch (error) {
    const status = error instanceof SkillError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Skill creation failed" });
  }
});

contractsRouter.get("/mock/users/:userId/qualifications", (req, res) => {
  const user = store.users.get(req.params.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    skillIds: workerRegistry.getWorker(user.address)?.skillIds ?? [],
    roleIds: roleRegistry.getUserRoles(user.userId).map(({ id }) => id),
  });
});

contractsRouter.put("/mock/users/:userId/qualifications", (req, res) => {
  const user = store.users.get(req.params.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  try {
    const replace = registryDatabase.transaction(() => {
      const roles = roleRegistry.setRegistrationRoles(user.userId, req.body?.roleIds);
      workerRegistry.upsertWorker({ walletAddress: user.address, userId: user.userId });
      const skillIds = workerRegistry.setWorkerSkills(user.address, req.body?.skillIds);
      return { skillIds, roleIds: roles.map(({ id }) => id) };
    });
    res.json(replace());
  } catch (error) {
    const status = error instanceof SkillError || error instanceof RoleError ? error.status : 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : "Qualification update failed",
    });
  }
});

contractsRouter.get("/mock/workers", (_req, res) => {
  res.json({ workers: workerRegistry.listWorkers() });
});

// ===================== PROJECTS =====================

contractsRouter.get("/projects/constructors", (_req, res) => {
  res.json({ success: true, constructors: ["new"], count: 1 });
});

// Deploy projects contract
contractsRouter.post("/projects/deploy/:version", (req, res) => {
  const version = req.params.version;
  const { name, client, dao_address, calendar_contract, ratings_contract } = req.body;
  const contract = store.deployContract("projects", version, {
    name,
    client,
    dao_address,
    calendar_contract,
    ratings_contract,
  });

  res.json({
    success: true,
    address: contract.address,
    inkVersion: version === "v6" ? "6" : "5",
    contractType: "projects",
  });
});

// Query projects contract – mirrors lib.rs query messages
contractsRouter.get("/projects/query/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);

  if (!contract || contract.type !== "projects") {
    res.json({
      success: true,
      method: methodName,
      contractAddress,
      response: null,
    });
    return;
  }

  const info = contract.projectInfo!;
  let response: any = null;

  switch (methodName) {
    case "get_project_info":
      // Mirrors: (name, client, dao, coordinator, status, total_cost, paid_amount)
      response = {
        name: info.name,
        client: info.client,
        dao_address: info.dao_address,
        coordinator: info.coordinator,
        state: info.state,
        calendar_contract: info.calendar_contract,
        ratings_contract: info.ratings_contract,
        total_cost: info.total_cost,
        paid_amount: info.paid_amount,
      };
      break;

    case "get_team":
      // Mock assignment team members are identified only by account.
      response = info.team;
      break;

    case "get_scope_info":
      if (info.scope) {
        const approvedTaskIds = info.tasks
          .filter((t) => "Approved" in t.status || "PendingReview" in t.status || t.completed)
          .map((t) => t.id);
        response = {
          state: info.scope.state,
          task_ids: approvedTaskIds,
          advance_payment_percentage: info.scope.advance_payment_percentage,
          document_hash: info.scope.document_hash,
          change_request_url: info.scope.change_request_url || null,
          milestones: info.scope.milestones || [],
          created_at: info.scope.created_at,
          updated_at: info.scope.updated_at,
          total_cost: info.total_cost,
          paid_amount: info.paid_amount,
          team_size: info.scope.team_size,
        };
      }
      break;

    case "get_all_tasks":
      // Mirrors: Vec<Task { id, complexity, cost, dependencies, completed, status, assigned_to }>
      response = info.tasks.map(serializeTask);
      break;

    case "get_task": {
      const taskId = parseInt(String(req.query.task_id || "0"));
      const task = info.tasks.find((t) => t.id === taskId);
      response = task ? serializeTask(task) : null;
      break;
    }

    case "get_task_completion_status": {
      const taskId = parseInt(String(req.query.task_id || "0"));
      const task = info.tasks.find((t) => t.id === taskId);
      response = task ? task.completed : false;
      break;
    }
  }

  res.json({
    success: true,
    method: methodName,
    contractAddress,
    response,
  });
});

/** Serialize a MockTask for JSON responses (flatten status enum) */
function serializeTask(t: MockTask): any {
  return {
    id: t.id,
    complexity: t.complexity,
    cost: t.cost,
    dependencies: t.dependencies,
    completed: t.completed,
    status: t.status,
    assigned_to: t.assigned_to,
    assignments: t.assignments,
    requirements: t.requirements,
  };
}

// Call projects contract methods – mirrors lib.rs messages
contractsRouter.post("/projects/call/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);
  const info = contract?.projectInfo;

  // Methods that return encodedData (for adapter-api signing flow)
  const encodedMethods = [
    "assign_team",
    "set_calendar_contract",
    "set_ratings_contract",
    "propose_scope",
    "update_scope",
    "submit_scope",
    "request_scope_changes",
    "cancel_scope",
    "approve_scope",
    "submit_task_for_review",
    "complete_task",
    "mark_completed",
    "submit_coordinator_ratings",
    "submit_developer_rating",
  ];

  // ── assign_coordinator (pre-signed, called by DAO) ──────────────
  if (methodName === "assign_coordinator") {
    if (!info) {
      res.status(400).json({ success: false, error: "Contract not found" });
      return;
    }

    const registered = store.getRegisteredWorkers(info.calendar_contract);
    const candidates = workerRegistry
      .listWorkers(registered)
      .filter((worker) => roleRegistry.hasRole(worker.userId, COORDINATOR_ROLE_ID))
      .filter((worker) => worker.walletAddress !== info.client)
      .filter((worker) => worker.totalHours > 0);
    if (candidates.length === 0) {
      res.status(400).json({ success: false, error: "No available coordinator" });
      return;
    }
    const coordinatorAddress = randomItem(candidates).walletAddress;

    info.coordinator = coordinatorAddress;
    info.state = "CoordinatorAssigned";

    res.json({
      method: "assign_coordinator",
      success: true,
      coordinator: coordinatorAddress,
      transactionHash: store.generateTxHash(),
      blockHash: store.generateTxHash(),
      blockNumber: store.nextBlockNumber(),
    });
    return;
  }

  if (encodedMethods.includes(methodName)) {
    // Apply side effects to in-memory state (mirrors contract behavior)
    if (info) {
      try {
        switch (methodName) {
        // ── assign_team ────────────────────────────────────────────
        case "assign_team": {
          if (info.state === "TeamAssigned" && info.team.length > 0) break;
          const previousState = info.state;
          const previousTeam = [...info.team];
          const previousTaskState = info.tasks.map((task) => ({
            assignments: [...task.assignments],
            assignedTo: task.assigned_to,
            status: task.status,
          }));
          try {
            registryDatabase.transaction(() => {
              planTeamForApprovedTasks(info);
              const firstTask = nextIncompleteTask(info);
              if (firstTask) activateTask(info, firstTask);
            })();
          } catch (error) {
            info.state = previousState;
            info.team = previousTeam;
            info.tasks.forEach((task, index) => {
              task.assignments = previousTaskState[index].assignments;
              task.assigned_to = previousTaskState[index].assignedTo;
              task.status = previousTaskState[index].status;
            });
            throw error;
          }
          break;
        }

        // ── propose_scope ──────────────────────────────────────────
        case "propose_scope": {
          if (req.body.caller !== info.coordinator) throw new Error("Only the project coordinator can propose scope");
          if (info.scope) throw new Error("The project already has a proposal");
          const fields = proposalFields(req.body.data);
          const timestamp = unixTimestamp();
          const milestones: MockMilestone[] = fields.milestones.map((milestone, index) => ({
            ...milestone,
            task_storage: store.createTaskStorage(
              info.coordinator!,
              contractAddress,
              index,
            ).hash,
          }));
          info.tasks = milestoneTasks(milestones);
          info.scope = {
            tasks: info.tasks.map((task) => [
              task.id,
              task.complexity,
              task.cost,
              task.dependencies,
            ]),
            milestones,
            advance_payment_percentage: fields.advancePaymentPercentage,
            document_hash: fields.documentHash,
            change_request_url: null,
            state: "Draft",
            team_size: Math.max(...milestones.map((milestone) => milestone.requirements.length)),
            task_storages: milestones.map((milestone, index) => ({
              task_id: index + 1,
              task_storage: milestone.task_storage,
            })),
            created_at: timestamp,
            updated_at: timestamp,
          };
          info.state = "ScopeProposalInProgress";
          break;
        }

        case "update_scope": {
          if (req.body.caller !== info.coordinator) throw new Error("Only the project coordinator can update scope");
          if (!info.scope || info.scope.state !== "Draft" || !info.scope.milestones) {
            throw new Error("Only a draft proposal can be updated");
          }
          const fields = proposalFields(req.body.data);
          if (fields.milestones.length !== info.scope.milestones.length) {
            throw new Error("Draft updates must preserve the milestone count");
          }
          const milestones: MockMilestone[] = fields.milestones.map((milestone, index) => ({
            ...milestone,
            task_storage: info.scope!.milestones![index].task_storage,
          }));
          info.tasks = milestoneTasks(milestones);
          info.scope.tasks = info.tasks.map((task) => [
            task.id,
            task.complexity,
            task.cost,
            task.dependencies,
          ]);
          info.scope.milestones = milestones;
          info.scope.advance_payment_percentage = fields.advancePaymentPercentage;
          info.scope.document_hash = fields.documentHash;
          info.scope.team_size = Math.max(...milestones.map((milestone) => milestone.requirements.length));
          info.scope.updated_at = unixTimestamp();
          break;
        }

        case "submit_scope": {
          if (req.body.caller !== info.coordinator) throw new Error("Only the project coordinator can submit scope");
          if (!info.scope || info.scope.state !== "Draft" || !info.scope.milestones) {
            throw new Error("Only a draft proposal can be submitted");
          }
          const emptyStorage = info.scope.milestones.find((milestone) => (
            store.taskStorages.get(milestone.task_storage)?.tasks.size === 0
          ));
          if (emptyStorage) throw new Error("Every milestone requires at least one task before submission");
          info.scope.state = "PendingApproval";
          info.scope.updated_at = unixTimestamp();
          info.state = "ScopePendingClientApproval";
          break;
        }

        case "request_scope_changes": {
          if (req.body.caller !== info.client) throw new Error("Only the project client can request scope changes");
          if (!info.scope || info.scope.state !== "PendingApproval") {
            throw new Error("Only a pending proposal can receive change requests");
          }
          const changeRequestUrl = String(req.body.data?.change_request_url || "").trim();
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(changeRequestUrl);
          } catch {
            throw new Error("change_request_url must be a valid HTTPS URL");
          }
          if (parsedUrl.protocol !== "https:") {
            throw new Error("change_request_url must be a valid HTTPS URL");
          }
          info.scope.change_request_url = changeRequestUrl;
          info.scope.state = "Draft";
          info.scope.updated_at = unixTimestamp();
          info.state = "ScopeProposalInProgress";
          break;
        }

        case "cancel_scope": {
          if (req.body.caller !== info.client) throw new Error("Only the project client can cancel scope");
          if (!info.scope || info.scope.state !== "PendingApproval") {
            throw new Error("Only a pending proposal can be cancelled");
          }
          info.scope.state = "Cancelled";
          info.scope.updated_at = unixTimestamp();
          info.state = "ScopeCancelled";
          break;
        }

        // ── approve_scope ──────────────────────────────────────────
        case "approve_scope": {
          if (req.body.caller !== info.client) throw new Error("Only the project client can approve scope");
          if (!info.scope || info.scope.state !== "PendingApproval") {
            throw new Error("Only a pending proposal can be approved");
          }
          const blockNum = store.nextBlockNumber();
          const previousStatuses = info.tasks.map((task) => task.status);
          const previousState = info.state;
          const previousTotalCost = info.total_cost;
          const previousPaidAmount = info.paid_amount;
          const previousScopeState = info.scope?.state;
          const previousScopeUpdatedAt = info.scope?.updated_at;
          const previousTeam = [...info.team];
          const previousAssignments = info.tasks.map((task) => [...task.assignments]);
          const previousAssignedTo = info.tasks.map((task) => task.assigned_to);

          try {
            for (const task of info.tasks) {
              task.status = { Approved: blockNum };
            }

            info.total_cost = info.tasks
              .filter((t) => "Approved" in t.status)
              .reduce((sum, t) => sum + parseInt(t.cost || "0"), 0);

            const advancePct = info.scope?.advance_payment_percentage || 0;
            info.paid_amount = Math.floor(info.total_cost * advancePct / 100);
            ensureFunds(info.client, info.paid_amount);

            info.scope.state = "Approved";
            info.scope.updated_at = unixTimestamp();
            info.state = "ScopeAccepted";
            planTeamForApprovedTasks(info);
            const firstTask = nextIncompleteTask(info);
            if (firstTask) activateTask(info, firstTask);
            if (info.paid_amount > 0) {
              payments.createPayment({
                from: info.client,
                to: contractAddress,
                assetId: DEFAULT_ASSET_ID,
                amount: info.paid_amount,
                kind: "advance",
                projectContract: contractAddress,
              });
            }
          } catch (error) {
            info.tasks.forEach((task, index) => {
              task.status = previousStatuses[index];
              task.assignments = previousAssignments[index];
              task.assigned_to = previousAssignedTo[index];
            });
            info.team = previousTeam;
            info.state = previousState;
            info.total_cost = previousTotalCost;
            info.paid_amount = previousPaidAmount;
            if (info.scope && previousScopeState) {
              info.scope.state = previousScopeState;
              info.scope.updated_at = previousScopeUpdatedAt;
            }
            throw error;
          }
          break;
        }

        // ── submit_task_for_review ─────────────────────────────────
        case "submit_task_for_review": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t) => t.id === taskId);
          if (!task || task.completed || !("Active" in task.status)) {
            throw new Error(`Task ${taskId} is not active`);
          }
          const depsCompleted = task.dependencies.every((depId) => {
            const dep = info.tasks.find((t) => t.id === depId);
            return dep?.completed === true;
          });
          if (!depsCompleted) {
            throw new Error(`Task ${taskId} dependencies are not completed`);
          }
          task.status = { PendingReview: store.nextBlockNumber() };
          break;
        }

        // ── complete_task ──────────────────────────────────────────
        case "complete_task": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t) => t.id === taskId);
          if (!task || task.completed || !("PendingReview" in task.status)) {
            throw new Error(`Task ${taskId} is not awaiting client acceptance`);
          }
          if (!task.assigned_to) throw new Error(`Task ${taskId} has no assigned worker`);
          const taskCost = parseInt(task.cost || "0");
          ensureFunds(info.client, taskCost);
          const nextTask = nextIncompleteTask(info, task.id);
          if (nextTask) activateTask(info, nextTask);
          if (taskCost > 0) {
            const payment = payments.createPayment({
              from: info.client,
              to: task.assigned_to,
              assetId: DEFAULT_ASSET_ID,
              amount: taskCost,
              kind: "milestone",
              projectContract: contractAddress,
              taskId: task.id,
            });
            payments.releasePayment(payment.paymentId);
            info.paid_amount = Math.min(info.total_cost, info.paid_amount + taskCost);
          }
          task.completed = true;
          break;
        }

        // ── mark_completed ─────────────────────────────────────────
        case "mark_completed": {
          const ratings: Array<[string, number]> = req.body.data?.ratings || [];
          // Apply ratings to team members (mirrors real contract)
          for (const [accountId, rating] of ratings) {
            const member = info.team.find((m) => m.account_id === accountId);
            if (member) member.rating = rating;
          }

          // Update paid_amount to total_cost (final payment)
          info.paid_amount = info.total_cost;
          info.state = "Completed";
          break;
        }

        // ── set_calendar_contract ──────────────────────────────────
        case "set_calendar_contract": {
          info.calendar_contract = req.body.data?.calendar_contract || null;
          break;
        }

        // ── set_ratings_contract ───────────────────────────────────
        case "set_ratings_contract": {
          info.ratings_contract = req.body.data?.ratings_contract || null;
          break;
        }
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          method: methodName,
          error: error instanceof Error ? error.message : "Contract call failed",
        });
        return;
      }
    }

    // Return mock encoded data for the adapter-api signing flow
    res.json({
      method: methodName,
      success: true,
      encodedData: "0x" + "ab".repeat(64),
    });
    return;
  }

  // Fallback: generic transaction response
  res.json({
    method: methodName,
    success: true,
    transactionHash: store.generateTxHash(),
    blockHash: store.generateTxHash(),
    blockNumber: store.nextBlockNumber(),
  });
});

// ===================== CALENDAR =====================

contractsRouter.get("/calendar/constructors", (_req, res) => {
  res.json({ success: true, constructors: ["new"], count: 1 });
});

contractsRouter.post("/calendar/deploy/v5", (_req, res) => {
  const contract = store.deployContract("calendar", "5");
  res.json({
    success: true,
    address: contract.address,
    inkVersion: "5",
    contractType: "calendar",
  });
});

// Query calendar contract – mirrors calendar/lib.rs query messages
contractsRouter.get("/calendar/query/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);
  const cal = contract?.calendarInfo;

  let response: any = null;

  if (cal) {
    switch (methodName) {
      case "get_availability_hours": {
        const worker = String(req.query.worker || "");
        response = workerRegistry.getWorker(worker)?.availability[0]?.hours ?? 0;
        break;
      }
      case "get_availability_calendar": {
        const worker = String(req.query.worker || "");
        response = workerRegistry.getAvailability(worker);
        break;
      }
      case "is_available": {
        const worker = String(req.query.worker || "");
        const minHours = req.query.min_hours != null
          ? parseInt(String(req.query.min_hours))
          : null;
        const hours = workerRegistry.getWorker(worker)?.availability[0]?.hours ?? 0;
        response = minHours != null ? hours >= minHours : hours > 0;
        break;
      }
      case "get_available_workers": {
        const minHours = req.query.min_hours != null
          ? parseInt(String(req.query.min_hours))
          : null;
        response = workerRegistry
          .listWorkers(cal.workers)
          .filter((worker) => {
            const currentWeekHours = worker.availability[0]?.hours ?? 0;
            return minHours != null ? currentWeekHours >= minHours : worker.totalHours > 0;
          })
          .map((worker) => ({
            worker: worker.walletAddress,
            hours: worker.availability[0]?.hours ?? 0,
            total_hours: worker.totalHours,
            weeks: worker.availability,
          }));
        response.sort((a: any, b: any) => b.hours - a.hours);
        break;
      }
      case "get_registered_workers":
        response = Array.from(cal.workers);
        break;
      case "get_all_workers_availability":
        response = workerRegistry.listWorkers(cal.workers).map((worker) => ({
          worker: worker.walletAddress,
          hours: worker.availability[0]?.hours ?? 0,
          total_hours: worker.totalHours,
          weeks: worker.availability,
        }));
        response.sort((a: any, b: any) => b.hours - a.hours);
        break;
    }
  }

  res.json({
    success: true,
    method: methodName,
    contractAddress,
    response,
  });
});

// Call calendar contract methods – mirrors calendar/lib.rs messages
contractsRouter.post("/calendar/call/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);
  const cal = contract?.calendarInfo;

  if (methodName === "set_availability") {
    const caller = req.body.caller;
    const availability = req.body.data?.availability ?? 0;
    try {
      if (cal && caller) {
        cal.workers.add(caller);
        workerRegistry.setAvailability(caller, availability);
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid availability",
      });
      return;
    }
    res.json({
      method: "set_availability",
      encodedData: "0x" + "cd".repeat(64),
    });
    return;
  }

  if (methodName === "register_worker") {
    const worker = req.body.data?.worker;
    if (cal && worker) {
      cal.workers.add(worker);
      const user = store.getUserByAddress(worker);
      workerRegistry.upsertWorker({
        walletAddress: worker,
        userId: user?.userId,
      });
    }
    res.json({
      method: "register_worker",
      success: true,
      transactionHash: store.generateTxHash(),
      blockHash: store.generateTxHash(),
      blockNumber: store.nextBlockNumber(),
    });
    return;
  }

  if (methodName === "register_workers") {
    const workers: string[] = req.body.data?.workers || [];
    if (cal) {
      for (const w of workers) {
        cal.workers.add(w);
        const user = store.getUserByAddress(w);
        workerRegistry.upsertWorker({
          walletAddress: w,
          userId: user?.userId,
        });
      }
    }
    res.json({
      method: "register_workers",
      success: true,
      transactionHash: store.generateTxHash(),
      blockHash: store.generateTxHash(),
      blockNumber: store.nextBlockNumber(),
    });
    return;
  }

  if (methodName === "admin_set_worker_availability") {
    const worker = req.body.data?.worker;
    const availability = req.body.data?.availability ?? 0;
    try {
      if (cal && worker) {
        cal.workers.add(worker);
        workerRegistry.setAvailability(worker, availability);
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid availability",
      });
      return;
    }
    res.json({
      method: "admin_set_worker_availability",
      success: true,
      transactionHash: store.generateTxHash(),
      blockHash: store.generateTxHash(),
      blockNumber: store.nextBlockNumber(),
    });
    return;
  }

  // Fallback
  res.json({
    method: methodName,
    success: true,
    transactionHash: store.generateTxHash(),
    blockHash: store.generateTxHash(),
    blockNumber: store.nextBlockNumber(),
  });
});

// ===================== RATINGS =====================

contractsRouter.post("/ratings/deploy/v5", (_req, res) => {
  const contract = store.deployContract("ratings", "5");
  res.json({
    success: true,
    address: contract.address,
    inkVersion: "5",
    contractType: "ratings",
  });
});

// ===================== BRAMP (payment ramp mock) =====================

const brampUsers: Array<{ id: number; email: string; balance: string; depositAddress: { address: string } }> = [];
let brampUserCounter = 1;
let brampDepositCounter = 1;
let brampWithdrawalCounter = 1;

contractsRouter.post("/users", (req, res) => {
  const { email } = req.body;
  const user = {
    id: brampUserCounter++,
    email,
    balance: "0",
    depositAddress: { address: store.generateAddress() },
  };
  brampUsers.push(user);
  res.json(user);
});

contractsRouter.get("/users", (_req, res) => {
  res.json(brampUsers);
});

contractsRouter.post("/deposit", (req, res) => {
  const { userId, amount, toAddress } = req.body;
  const depositId = brampDepositCounter++;
  res.json({
    message: "Deposit request created",
    depositId,
    instructions: {
      amount,
      bankAccount: "MOCK-BANK-1234567890",
      reference: `DEP-${depositId}`,
    },
  });
});

contractsRouter.post("/deposit/:depositId/confirm", (req, res) => {
  const depositId = parseInt(req.params.depositId);
  res.json({
    message: "Deposit confirmed",
    depositId,
    txHash: store.generateTxHash(),
    status: "success",
  });
});

contractsRouter.post("/withdrawal", (req, res) => {
  const { userId, amount } = req.body;
  res.json({
    message: "Withdrawal created",
    withdrawalId: brampWithdrawalCounter++,
    userId,
    amount,
    status: "pending",
    depositAddress: store.generateAddress(),
  });
});
