import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { contractsRouter } from "./contracts-mock.js";
import { store } from "./store.js";
import { taskStorageRouter } from "./task-storages.js";

const coordinator = "coordinator-wallet";
const client = "client-wallet";
const assignee = "assignee-wallet";
const reassignedWorker = "reassigned-worker-wallet";

const milestones = [
  {
    title: "Foundation",
    description: "Build the project foundation",
    budget: 5_000,
    delivery_time_hours: 80,
    requirements: [{
      assignment_key: "backend",
      role_id: 3,
      hours: 20,
      skill_ids: [1, 4],
    }],
  },
  {
    title: "Launch",
    description: "Prepare the release",
    budget: 3_000,
    delivery_time_hours: 48,
    requirements: [{
      assignment_key: "frontend",
      role_id: 2,
      hours: 10,
      skill_ids: [5],
    }],
  },
];

const newTask = {
  title: "Implement authentication",
  description: "Add JWT authentication and security middleware",
  type: "Feature",
  priority: "High",
  status: "To Do",
  assignees: [assignee],
  estimatedMinutes: 960,
  loggedMinutes: 0,
  dueDate: 1_800_000_000,
};

async function main() {
  const project = store.deployContract("projects", "5", { name: "Issue 68", client });
  project.projectInfo!.coordinator = coordinator;
  project.projectInfo!.state = "CoordinatorAssigned";

  const app = express();
  app.use(express.json());
  app.use(contractsRouter);
  app.use(taskStorageRouter);

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    caller?: string,
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(caller ? { "X-Task-Storage-Caller": caller } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: response.status, body: parsed };
  }

  const call = (method: string, caller: string, data: unknown = {}) => request(
    `/projects/call/${project.address}/${method}`,
    "POST",
    { caller, data },
  );
  const scope = () => request(`/projects/query/${project.address}/get_scope_info`);

  try {
    const beforeProposal = Math.floor(Date.now() / 1_000);
    const storageCount = store.taskStorages.size;
    assert.equal((await call("propose_scope", coordinator, {
      milestones: [
        milestones[0],
        { ...milestones[1], requirements: [] },
      ],
      advance_payment_percentage: 10,
      document_hash: "invalid-proposal",
    })).status, 400);
    assert.equal(store.taskStorages.size, storageCount);

    assert.equal((await call("propose_scope", coordinator, {
      milestones,
      advance_payment_percentage: 10,
      document_hash: "QmIssue68",
    })).status, 200);

    const draft = (await scope()).body.response;
    assert.equal(draft.state, "Draft");
    assert.equal(draft.milestones.length, 2);
    assert.equal(draft.milestones[0].delivery_time_hours, 80);
    assert.equal(draft.milestones[0].task_storage.length, 64);
    assert.notEqual(draft.milestones[0].task_storage, draft.milestones[1].task_storage);
    assert(draft.created_at >= beforeProposal);
    assert.equal(draft.created_at, draft.updated_at);

    const firstStorage = draft.milestones[0].task_storage;
    const secondStorage = draft.milestones[1].task_storage;
    assert.deepEqual((await request(`/task-storages/${firstStorage}`, "GET", undefined, coordinator)).body.storage.tasks, []);
    assert.equal((await request(`/task-storages/${firstStorage}`)).status, 401);

    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks`,
      "POST",
      { ...newTask, createdAt: 1 },
      coordinator,
    )).status, 400);

    const created = await request(
      `/task-storages/${firstStorage}/tasks`,
      "POST",
      newTask,
      coordinator,
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.taskId, 1);
    assert.equal("id" in created.body.task, false);
    assert.equal(created.body.task.reporter, coordinator);
    assert(created.body.task.createdAt >= beforeProposal);
    assert.equal(created.body.task.createdAt, created.body.task.updatedAt);

    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks`,
      "POST",
      newTask,
      client,
    )).status, 403);
    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "PATCH",
      { title: "Forbidden" },
      assignee,
    )).status, 403);

    const updated = await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "PATCH",
      { status: "In Progress", loggedMinutes: 30 },
      assignee,
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.task.status, "In Progress");
    assert.equal(updated.body.task.loggedMinutes, 30);
    assert(updated.body.task.updatedAt >= updated.body.task.createdAt);

    const clientRead = await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "GET",
      undefined,
      client,
    );
    assert.equal(clientRead.status, 200);
    assert.equal(clientRead.body.taskId, 1);
    assert.equal("id" in clientRead.body.task, false);

    const reassigned = await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "PATCH",
      { title: "Implement revised authentication", assignees: [reassignedWorker] },
      coordinator,
    );
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.task.title, "Implement revised authentication");
    assert.deepEqual(reassigned.body.task.assignees, [reassignedWorker]);
    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "PATCH",
      { loggedMinutes: 45 },
      assignee,
    )).status, 403);
    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "PATCH",
      { status: "In Review", loggedMinutes: 45 },
      reassignedWorker,
    )).status, 200);

    assert.equal((await call("submit_scope", coordinator)).status, 400);
    assert.equal((await request(
      `/task-storages/${secondStorage}/tasks`,
      "POST",
      { ...newTask, title: "Prepare release" },
      coordinator,
    )).status, 201);
    assert.equal((await call("submit_scope", coordinator)).status, 200);
    assert.equal((await scope()).body.response.state, "PendingApproval");

    assert.equal((await call("update_scope", coordinator, {
      milestones,
      advance_payment_percentage: 10,
      document_hash: "QmIssue68",
    })).status, 400);
    assert.equal((await call("request_scope_changes", client)).status, 400);
    assert.equal((await call("request_scope_changes", client, {
      change_request_url: "http://notes.example.com/issue-68",
    })).status, 400);
    assert.equal((await call("request_scope_changes", client, {
      change_request_url: "https://notes.example.com/issue-68",
    })).status, 200);

    const changesRequested = (await scope()).body.response;
    assert.equal(changesRequested.state, "Draft");
    assert.equal(changesRequested.change_request_url, "https://notes.example.com/issue-68");

    const revisedMilestones = milestones.map((milestone, index) => ({
      ...milestone,
      title: index === 0 ? "Revised foundation" : milestone.title,
    }));
    assert.equal((await call("update_scope", coordinator, {
      milestones: revisedMilestones,
      advance_payment_percentage: 10,
      document_hash: "QmIssue68Revision2",
    })).status, 200);
    const revised = (await scope()).body.response;
    assert.equal(revised.milestones[0].title, "Revised foundation");
    assert.equal(revised.milestones[0].task_storage, firstStorage);
    assert.equal(revised.milestones[1].task_storage, secondStorage);

    assert.equal((await call("submit_scope", coordinator)).status, 200);
    assert.equal((await call("cancel_scope", client)).status, 200);
    assert.equal((await scope()).body.response.state, "Cancelled");
    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks`,
      "POST",
      newTask,
      coordinator,
    )).status, 409);
    assert.equal((await request(
      `/task-storages/${firstStorage}/tasks/1`,
      "DELETE",
      undefined,
      coordinator,
    )).status, 404);

    console.log("PASS provider-owned proposal and task storage lifecycle");
  } finally {
    server.close();
    await once(server, "close");
  }
}

main();
