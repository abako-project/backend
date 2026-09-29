import { Request, Response, Router } from "express";
import {
  store,
  TaskPriority,
  TaskStorage,
  TaskStorageStatus,
  TaskStorageTask,
  TaskType,
} from "./store.js";

export const taskStorageRouter = Router();

const taskTypes: TaskType[] = ["Feature", "Bug", "Task", "Epic", "Story"];
const priorities: TaskPriority[] = ["Lowest", "Low", "Medium", "High", "Highest", "Blocker"];
const statuses: TaskStorageStatus[] = ["To Do", "Open", "In Progress", "In Review", "Done", "Closed"];
const coordinatorFields = new Set([
  "title",
  "description",
  "type",
  "priority",
  "status",
  "assignees",
  "estimatedMinutes",
  "loggedMinutes",
  "dueDate",
]);
const assigneeFields = new Set(["status", "loggedMinutes"]);
const providerFields = new Set(["id", "taskId", "reporter", "createdAt", "updatedAt"]);

function caller(req: Request): string | null {
  return req.header("X-Task-Storage-Caller")?.trim() || null;
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1_000);
}

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function isU32(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
}

function isUnix(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isTask(value: any): value is Omit<TaskStorageTask, "reporter" | "createdAt" | "updatedAt"> {
  return (
    value &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.description === "string" &&
    isChoice(value.type, taskTypes) &&
    isChoice(value.priority, priorities) &&
    isChoice(value.status, statuses) &&
    Array.isArray(value.assignees) &&
    value.assignees.every((item: unknown) => typeof item === "string" && item.trim().length > 0) &&
    isU32(value.estimatedMinutes) &&
    isU32(value.loggedMinutes) &&
    isUnix(value.dueDate)
  );
}

function serialize(storage: TaskStorage) {
  return {
    hash: storage.hash,
    project: storage.attachedProject,
    milestoneIndex: storage.milestoneIndex,
    tasks: [...storage.tasks].map(([taskId, task]) => ({ taskId, task })),
  };
}

function projectFor(storage: TaskStorage) {
  return storage.attachedProject
    ? store.contracts.get(storage.attachedProject)?.projectInfo
    : undefined;
}

function canRead(storage: TaskStorage, account: string): boolean {
  const project = projectFor(storage);
  return (
    storage.creator === account ||
    project?.client === account ||
    [...storage.tasks.values()].some((task) => task.assignees.includes(account))
  );
}

function ensureMutable(storage: TaskStorage, res: Response): boolean {
  if (projectFor(storage)?.scope?.state === "Cancelled") {
    fail(res, 409, "Tasks cannot be modified after proposal cancellation");
    return false;
  }
  return true;
}

function storageAndCaller(req: Request, res: Response): { storage: TaskStorage; account: string } | null {
  const storage = store.taskStorages.get(String(req.params.hash));
  if (!storage) {
    fail(res, 404, "Task storage not found");
    return null;
  }
  const account = caller(req);
  if (!account) {
    fail(res, 401, "Missing task storage caller");
    return null;
  }
  return { storage, account };
}

taskStorageRouter.get("/task-storages/:hash", (req, res) => {
  const context = storageAndCaller(req, res);
  if (!context) return;
  if (!canRead(context.storage, context.account)) return fail(res, 403, "Task storage access denied");
  res.json({ storage: serialize(context.storage) });
});

taskStorageRouter.get("/task-storages/:hash/tasks/:taskId", (req, res) => {
  const context = storageAndCaller(req, res);
  if (!context) return;
  if (!canRead(context.storage, context.account)) return fail(res, 403, "Task storage access denied");
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId) || taskId < 1 || taskId > 0xffffffff) {
    return fail(res, 400, "Invalid task ID");
  }
  const task = context.storage.tasks.get(taskId);
  if (!task) return fail(res, 404, "Task not found");
  res.json({ taskId, task });
});

taskStorageRouter.post("/task-storages/:hash/tasks", (req, res) => {
  const context = storageAndCaller(req, res);
  if (!context) return;
  if (context.storage.creator !== context.account) {
    return fail(res, 403, "Only the project coordinator can create tasks");
  }
  if (!ensureMutable(context.storage, res)) return;
  if (context.storage.tasks.size >= 0xffffffff) {
    return fail(res, 409, "Task storage has reached its u32 task limit");
  }
  if (
    Object.keys(req.body || {}).some((key) => providerFields.has(key)) ||
    !isTask(req.body)
  ) {
    return fail(res, 400, "Invalid task");
  }
  const timestamp = nowUnix();
  const taskId = context.storage.tasks.size + 1;
  const task: TaskStorageTask = {
    ...req.body,
    title: req.body.title.trim(),
    assignees: [...new Set<string>(req.body.assignees)],
    reporter: context.account,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  context.storage.tasks.set(taskId, task);
  res.status(201).json({ taskId, task });
});

taskStorageRouter.patch("/task-storages/:hash/tasks/:taskId", (req, res) => {
  const context = storageAndCaller(req, res);
  if (!context) return;
  if (!ensureMutable(context.storage, res)) return;
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId) || taskId < 1 || taskId > 0xffffffff) {
    return fail(res, 400, "Invalid task ID");
  }
  const task = context.storage.tasks.get(taskId);
  if (!task) return fail(res, 404, "Task not found");

  const fields = Object.keys(req.body || {});
  const isCoordinator = context.storage.creator === context.account;
  const isAssignee = task.assignees.includes(context.account);
  const allowed = isCoordinator ? coordinatorFields : isAssignee ? assigneeFields : null;
  if (!allowed || fields.length === 0 || fields.some((field) => !allowed.has(field))) {
    return fail(res, 403, "Task update is not allowed");
  }

  const candidate = { ...task, ...req.body };
  if (!isTask(candidate)) return fail(res, 400, "Invalid task");
  const updated: TaskStorageTask = {
    ...candidate,
    title: candidate.title.trim(),
    assignees: [...new Set(candidate.assignees)],
    reporter: task.reporter,
    createdAt: task.createdAt,
    updatedAt: nowUnix(),
  };
  context.storage.tasks.set(taskId, updated);
  res.json({ taskId, task: updated });
});
