// Mock routes for contracts-api endpoints (projects, calendar, ratings)
import { Router } from "express";
import { store } from "./store.js";

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

// Query projects contract
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
      response = {
        name: info.name,
        client: info.client,
        coordinator: info.coordinator,
        state: info.state,
        calendar_contract: null,
        ratings_contract: null,
      };
      break;
    case "get_team":
      response = info.team;
      break;
    case "get_scope_info":
      response = info.scope;
      break;
    case "get_all_tasks":
      response = info.tasks;
      break;
    case "get_task": {
      const taskId = parseInt(String(req.query.task_id || "0"));
      response = info.tasks.find((t: any) => t.id === taskId) || null;
      break;
    }
    case "get_task_completion_status": {
      const taskId = parseInt(String(req.query.task_id || "0"));
      const task = info.tasks.find((t: any) => t.id === taskId);
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

// Call projects contract methods
contractsRouter.post("/projects/call/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);
  const info = contract?.projectInfo;

  // Methods that return encodedData (for signing)
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

  if (methodName === "assign_coordinator") {
    // Return a registered user's address if any exist, otherwise generate one
    let coordinatorAddress: string;
    const registeredUsers = Array.from(store.users.values());
    if (registeredUsers.length > 0) {
      // Pick the last registered user (likely a worker, not the client)
      const user = registeredUsers[registeredUsers.length - 1];
      coordinatorAddress = user.address;
    } else {
      coordinatorAddress = store.generateAddress();
    }
    if (info) {
      info.coordinator = coordinatorAddress;
      info.state = "CoordinatorAssigned";
    }

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
    // Apply side effects to in-memory state
    if (info) {
      switch (methodName) {
        case "assign_team": {
          const size = req.body.data?.ideal_team_size || 3;
          info.team = Array.from({ length: size }, (_, i) => ({
            account_id: store.generateAddress(),
            role: i === 0 ? "Lead" : "Member",
          }));
          info.state = "TeamAssigned";
          break;
        }
        case "propose_scope":
          info.scope = {
            tasks: req.body.data?.tasks || [],
            advance_payment_percentage: req.body.data?.advance_payment_percentage || 0,
            document_hash: req.body.data?.document_hash || "",
            state: "Proposed",
          };
          if (req.body.data?.tasks) {
            info.tasks = req.body.data.tasks.map((t: any, i: number) => ({
              id: t[0] ?? i,
              complexity: t[1],
              cost: t[2],
              dependencies: t[3] || [],
              completed: false,
              state: "Pending",
            }));
          }
          info.state = "ScopeProposed";
          break;
        case "approve_scope":
          if (info.scope) info.scope.state = "Approved";
          info.state = "ScopeApproved";
          break;
        case "submit_task_for_review": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t: any) => t.id === taskId);
          if (task) task.state = "InReview";
          break;
        }
        case "complete_task": {
          const taskId = req.body.data?.task_id;
          const task = info.tasks.find((t: any) => t.id === taskId);
          if (task) {
            task.state = "Completed";
            task.completed = true;
          }
          break;
        }
        case "mark_completed":
          info.state = "Completed";
          break;
      }
    }

    // Return mock encoded data for the adapter-api signing flow
    res.json({
      method: methodName,
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
        const minHours = parseInt(String(req.query.min_hours || "0"));
        const hours = cal.workers.get(worker) ?? 0;
        response = hours >= minHours;
        break;
      }
      case "get_available_workers": {
        const minHours = parseInt(String(req.query.min_hours || "0"));
        response = [];
        for (const [addr, hours] of cal.workers.entries()) {
          if (hours >= minHours) response.push({ worker: addr, hours });
        }
        break;
      }
      case "get_registered_workers":
        response = Array.from(cal.workers.keys());
        break;
      case "get_all_workers_availability":
        response = [];
        for (const [addr, hours] of cal.workers.entries()) {
          response.push({ worker: addr, hours });
        }
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

contractsRouter.post("/calendar/call/:contractAddress/:methodName", (req, res) => {
  const { contractAddress, methodName } = req.params;
  const contract = store.contracts.get(contractAddress);
  const cal = contract?.calendarInfo;

  if (methodName === "set_availability") {
    // Returns encoded data for signing
    const caller = req.body.caller;
    const availability = req.body.data?.availability ?? 0;
    if (cal && caller) {
      cal.workers.set(caller, availability);
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
      cal.workers.set(worker, 0);
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
      for (const w of workers) cal.workers.set(w, 0);
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
    if (cal && worker) {
      cal.workers.set(worker, availability);
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

const brampUsers: Array<{ id: number; email: string }> = [];
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
