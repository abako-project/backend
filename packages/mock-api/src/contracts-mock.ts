// Mock routes for contracts-api endpoints (projects, calendar, ratings)
// Behavior mirrors the ink! smart contracts in ../../../contracts/
import { Router } from "express";
import { randomInt } from "node:crypto";
import {
  store,
  MockAssignment,
  MockProjectInfo,
  MockRequirement,
  MockTask,
  MockTeamMember,
} from "./store.js";
import { workerRegistry } from "./worker-registry.js";

export const contractsRouter = Router();

function positiveIntegerOrDefault(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizedSkillIds(skillIds: unknown): number[] {
  if (!Array.isArray(skillIds)) return [];
  return [...new Set(
    skillIds.map(Number).filter((id) => Number.isInteger(id) && id > 0),
  )].sort((a, b) => a - b);
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function workerMatches(
  worker: ReturnType<typeof workerRegistry.listWorkers>[number],
  requirement: MockRequirement,
): boolean {
  const skills = new Set(worker.skillIds);
  return requirement.skill_ids.every((skillId) => skills.has(skillId));
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
      // Mirrors: Option<(task_ids, advance_pct, total_cost, paid_amount)>
      if (info.scope) {
        const approvedTaskIds = info.tasks
          .filter((t) => "Approved" in t.status || "PendingReview" in t.status || t.completed)
          .map((t) => t.id);
        response = {
          task_ids: approvedTaskIds,
          advance_payment_percentage: info.scope.advance_payment_percentage,
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
      .filter((worker) => worker.isCoordinator)
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
          planTeamForApprovedTasks(info);
          const firstTask = nextIncompleteTask(info);
          if (firstTask) activateTask(info, firstTask);
          break;
        }

        // ── propose_scope ──────────────────────────────────────────
        case "propose_scope": {
          const rawTasks: any[] = req.body.data?.tasks || [];
          const requirements = new Map<number, any>(
            (req.body.data?.assignment_requirements || []).map((requirement: any) => [
              Number(requirement.task_id),
              requirement,
            ]),
          );
          const advancePct = req.body.data?.advance_payment_percentage || 0;
          const docHash = req.body.data?.document_hash || "";

          info.tasks = rawTasks.map((t: any, i: number): MockTask => {
            const id = Number(t[0] ?? i);
            const requirementGroup = requirements.get(id) as any;
            const taskRequirements = Array.isArray(requirementGroup?.requirements)
              ? requirementGroup.requirements
              : [];
            const parsedRequirements: MockRequirement[] = taskRequirements.map((requirement: any) => ({
              assignment_key: String(requirement.assignment_key || "").trim().toLowerCase(),
              hours: positiveIntegerOrDefault(requirement.hours, 1),
              skill_ids: normalizedSkillIds(requirement.skill_ids),
            }));
            const keys = parsedRequirements.map((requirement) => requirement.assignment_key);
            if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
              throw new Error(`Task ${id} has invalid or duplicate assignment keys`);
            }
            if (parsedRequirements.some((requirement) => requirement.skill_ids.length === 0)) {
              throw new Error(`Task ${id} requirements must contain skill IDs`);
            }
            return {
              id,
              complexity: typeof t[1] === "object" ? t[1] : { type: "Days", value: t[1] },
              cost: String(t[2]),
              dependencies: t[3] || [],
              completed: false,
              status: { Pending: null },
              assigned_to: null,
              assignments: [],
              requirements: parsedRequirements,
            };
          });

          info.scope = {
            tasks: rawTasks,
            advance_payment_percentage: advancePct,
            document_hash: docHash,
            state: "Proposed",
            team_size: positiveIntegerOrDefault(req.body.data?.team_size, 1),
          };

          info.state = "ScopePendingClientApproval";
          break;
        }

        // ── approve_scope ──────────────────────────────────────────
        case "approve_scope": {
          const approvedIds: number[] = req.body.data?.approved_task_ids || [];
          const blockNum = store.nextBlockNumber();
          const approvedSet = new Set(approvedIds);
          const previousStatuses = info.tasks.map((task) => task.status);
          const previousState = info.state;
          const previousTotalCost = info.total_cost;
          const previousPaidAmount = info.paid_amount;
          const previousScopeState = info.scope?.state;
          const previousTeam = [...info.team];
          const previousAssignments = info.tasks.map((task) => [...task.assignments]);
          const previousAssignedTo = info.tasks.map((task) => task.assigned_to);

          try {
            for (const task of info.tasks) {
              if (approvedSet.has(task.id)) {
                task.status = { Approved: blockNum };
              } else if ("Pending" in task.status) {
                task.status = { Rejected: blockNum };
              }
            }

            info.total_cost = info.tasks
              .filter((t) => "Approved" in t.status)
              .reduce((sum, t) => sum + parseInt(t.cost || "0"), 0);

            const advancePct = info.scope?.advance_payment_percentage || 0;
            info.paid_amount = Math.floor(info.total_cost * advancePct / 100);

            if (info.scope) info.scope.state = "Approved";
            info.state = "ScopeAccepted";
            planTeamForApprovedTasks(info);
            const firstTask = nextIncompleteTask(info);
            if (firstTask) activateTask(info, firstTask);
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
            if (info.scope && previousScopeState) info.scope.state = previousScopeState;
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
          const nextTask = nextIncompleteTask(info, task.id);
          if (nextTask) activateTask(info, nextTask);
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
      workerRegistry.upsertWorker({
        walletAddress: worker,
        userId: req.body.data?.user_id || "",
        name: req.body.data?.name || "",
        isCoordinator: Boolean(req.body.data?.is_coordinator),
        skillIds: normalizedSkillIds(req.body.data?.skill_ids ?? req.body.data?.skills),
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
    const profiles = new Map(
      (req.body.data?.worker_profiles || []).map((profile: any) => [profile.worker, profile]),
    );
    if (cal) {
      for (const w of workers) {
        const profile = profiles.get(w) as any;
        cal.workers.add(w);
        workerRegistry.upsertWorker({
          walletAddress: w,
          userId: profile?.user_id || "",
          name: profile?.name || "",
          isCoordinator: Boolean(profile?.is_coordinator),
          skillIds: normalizedSkillIds(profile?.skill_ids ?? profile?.skills),
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
