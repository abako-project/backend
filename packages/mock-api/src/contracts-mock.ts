// Mock routes for contracts-api endpoints (projects, calendar, ratings)
// Behavior mirrors the ink! smart contracts in ../../../contracts/
import { Router } from "express";
import { store, MockTask, MockTeamMember } from "./store.js";

export const contractsRouter = Router();

// --- Health ---
contractsRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "contracts-api (mock-api)",
    timestamp: new Date().toISOString(),
  });
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
      // Mirrors: Vec<TeamMember { account_id, role, rating }>
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

    // Query calendar for available workers with 30+ hours (mirrors real contract)
    const available = store.getAvailableWorkers(info.calendar_contract, 30);
    let coordinatorAddress: string;

    if (available.length > 0) {
      // Pick first available worker (highest hours, excluding the client)
      const candidate = available.find((w) => w.worker !== info.client) || available[0];
      coordinatorAddress = candidate.worker;
    } else {
      // Fallback: pick any registered user that isn't the client
      const registeredUsers = Array.from(store.users.values());
      const nonClient = registeredUsers.find((u) => u.address !== info.client);
      coordinatorAddress = nonClient?.address || store.generateAddress();
    }

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
      switch (methodName) {
        // ── assign_team ────────────────────────────────────────────
        case "assign_team": {
          // Query calendar for workers with 15+ hours (mirrors real contract)
          const available = store.getAvailableWorkers(info.calendar_contract, 15);
          const idealSize = req.body.data?.ideal_team_size || req.body.data?._team_size || 3;

          // Filter out coordinator and client
          const candidates = available.filter(
            (w) => w.worker !== info.coordinator && w.worker !== info.client
          );

          // Take up to idealSize workers
          const teamWorkers = candidates.slice(0, idealSize);

          // Assign roles round-robin: Designer, Developer, Tester (mirrors real contract)
          const roles = ["Designer", "Developer", "Tester"];
          info.team = teamWorkers.map((w, i): MockTeamMember => ({
            account_id: w.worker,
            role: roles[i % roles.length],
            rating: null,
          }));

          // If no calendar workers available, generate placeholder team
          if (info.team.length === 0) {
            info.team = Array.from({ length: Math.min(idealSize, 3) }, (_, i): MockTeamMember => ({
              account_id: store.generateAddress(),
              role: roles[i % roles.length],
              rating: null,
            }));
          }

          // Assign approved tasks to team members round-robin (mirrors real contract)
          const approvedTasks = info.tasks.filter(
            (t) => "Approved" in t.status
          );
          approvedTasks.forEach((task, i) => {
            task.assigned_to = info.team[i % info.team.length].account_id;
          });

          info.state = "TeamAssigned";
          break;
        }

        // ── propose_scope ──────────────────────────────────────────
        case "propose_scope": {
          const rawTasks: any[] = req.body.data?.tasks || [];
          const advancePct = req.body.data?.advance_payment_percentage || 0;
          const docHash = req.body.data?.document_hash || "";

          info.tasks = rawTasks.map((t: any, i: number): MockTask => ({
            id: t[0] ?? i,
            complexity: typeof t[1] === "object" ? t[1] : { type: "Days", value: t[1] },
            cost: String(t[2]),
            dependencies: t[3] || [],
            completed: false,
            status: { Pending: null },
            assigned_to: null,
          }));

          info.scope = {
            tasks: rawTasks,
            advance_payment_percentage: advancePct,
            document_hash: docHash,
            state: "Proposed",
          };

          info.state = "ScopePendingClientApproval";
          break;
        }

        // ── approve_scope ──────────────────────────────────────────
        case "approve_scope": {
          const approvedIds: number[] = req.body.data?.approved_task_ids || [];
          const blockNum = store.nextBlockNumber();
          const approvedSet = new Set(approvedIds);

          // Set task statuses: Approved or Rejected (mirrors real contract)
          for (const task of info.tasks) {
            if (approvedSet.has(task.id)) {
              task.status = { Approved: blockNum };
            } else if ("Pending" in task.status) {
              task.status = { Rejected: blockNum };
            }
          }

          // Recalculate total_cost from approved tasks
          info.total_cost = info.tasks
            .filter((t) => "Approved" in t.status)
            .reduce((sum, t) => sum + parseInt(t.cost || "0"), 0);

          // Calculate advance payment
          const advancePct = info.scope?.advance_payment_percentage || 0;
          info.paid_amount = Math.floor(info.total_cost * advancePct / 100);

          if (info.scope) info.scope.state = "Approved";
          info.state = "ScopeAccepted";
          break;
        }

        // ── submit_task_for_review ─────────────────────────────────
        case "submit_task_for_review": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t) => t.id === taskId);
          if (task && !task.completed && "Approved" in task.status) {
            // Check dependencies are completed (mirrors real contract)
            const depsCompleted = task.dependencies.every((depId) => {
              const dep = info.tasks.find((t) => t.id === depId);
              return dep?.completed === true;
            });
            if (depsCompleted) {
              task.status = { PendingReview: store.nextBlockNumber() };
            }
          }
          break;
        }

        // ── complete_task ──────────────────────────────────────────
        case "complete_task": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t) => t.id === taskId);
          // Real contract: must be in PendingReview status
          if (task && !task.completed && "PendingReview" in task.status) {
            task.completed = true;
          }
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
        response = cal.workers.get(worker) ?? 0;
        break;
      }
      case "is_available": {
        const worker = String(req.query.worker || "");
        const minHours = req.query.min_hours != null
          ? parseInt(String(req.query.min_hours))
          : null;
        const hours = cal.workers.get(worker) ?? 0;
        response = minHours != null ? hours >= minHours : hours > 0;
        break;
      }
      case "get_available_workers": {
        const minHours = req.query.min_hours != null
          ? parseInt(String(req.query.min_hours))
          : null;
        // Mirrors real contract: Vec<WorkerAvailability>, sorted by hours desc
        response = [];
        for (const [addr, hours] of cal.workers.entries()) {
          if (minHours != null ? hours >= minHours : hours > 0) {
            response.push({ worker: addr, hours });
          }
        }
        response.sort((a: any, b: any) => b.hours - a.hours);
        break;
      }
      case "get_registered_workers":
        response = Array.from(cal.workers.keys());
        break;
      case "get_all_workers_availability":
        // Mirrors real contract: all workers including 0 hours, sorted desc
        response = [];
        for (const [addr, hours] of cal.workers.entries()) {
          response.push({ worker: addr, hours });
        }
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
    // Returns encoded data for signing (worker sets own availability)
    const caller = req.body.caller;
    const availability = req.body.data?.availability ?? 0;
    // Convert AvailabilityLevel to hours (mirrors real contract)
    const hours = typeof availability === "object"
      ? availability.WeeklyHours ?? 0
      : typeof availability === "string"
        ? availability === "FullTime" ? 40 : availability === "PartTime" ? 20 : 0
        : availability;
    if (cal && caller) {
      cal.workers.set(caller, hours);
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
      if (!cal.workers.has(worker)) {
        cal.workers.set(worker, 0);
      }
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
        if (!cal.workers.has(w)) cal.workers.set(w, 0);
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
    const hours = typeof availability === "object"
      ? availability.WeeklyHours ?? 0
      : typeof availability === "string"
        ? availability === "FullTime" ? 40 : availability === "PartTime" ? 20 : 0
        : availability;
    if (cal && worker) {
      cal.workers.set(worker, hours);
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
