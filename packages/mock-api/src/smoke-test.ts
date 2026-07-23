// Smoke test: starts mock-api, hits every endpoint, reports pass/fail
import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";
import { appRouter } from "./app-mock.js";
import { PasswordAuthClient, PasswordAuthError } from "./password-client.js";
import { seedStore } from "./seed.js";
import { SEED, SEED_SKILLS } from "./seed.js";
import { registryDatabase } from "./registry-database.js";
import { store } from "./store.js";

const app = express();
app.use(express.json());
app.use("/api", virtoRouter);
app.use("/", contractsRouter);
app.use("/", appRouter);
seedStore();

const PORT = 0; // random available port
const server = app.listen(PORT, async () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") process.exit(1);
  const base = `http://127.0.0.1:${addr.port}`;

  let pass = 0;
  let fail = 0;

  async function test(
    name: string,
    method: string,
    path: string,
    body?: any,
    check?: (r: any, status: number) => boolean,
  ) {
    try {
      const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${base}${path}`, opts);
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (check && !check(json, res.status)) {
        throw new Error(`Unexpected ${res.status}: ${JSON.stringify(json)}`);
      }
      console.log(`  PASS  ${name}`);
      pass++;
      return json;
    } catch (e: any) {
      console.log(`  FAIL  ${name} - ${e.message}`);
      fail++;
      return null;
    }
  }

  async function expectPasswordRoleError(
    name: string,
    userId: string,
    roleIds: number[],
  ) {
    try {
      await new PasswordAuthClient(base).register(userId, "correct horse battery staple", roleIds);
      console.log(`  FAIL  ${name} - Expected status 400`);
      fail++;
    } catch (error) {
      if (error instanceof PasswordAuthError && error.status === 400) {
        console.log(`  PASS  ${name}`);
        pass++;
      } else {
        console.log(`  FAIL  ${name} - ${error instanceof Error ? error.message : String(error)}`);
        fail++;
      }
    }
  }

  function check(name: string, condition: boolean, detail: string): void {
    if (condition) {
      console.log(`  PASS  ${name}`);
      pass++;
    } else {
      console.log(`  FAIL  ${name} - ${detail}`);
      fail++;
    }
  }

  console.log("\nMock API smoke test\n");

  // Health
  console.log("Health:");
  await test("virto health", "GET", "/api/health", undefined, r => r.status === "ok");
  await test("contracts health", "GET", "/health", undefined, r => r.status === "ok");

  // Roles
  console.log("\nRoles:");
  const seededRoles = await test("list seeded roles", "GET", "/api/roles", undefined, (r, status) => (
    status === 200 &&
    JSON.stringify(r.roles) === JSON.stringify([
      { id: 1, name: "coordinator", selectable: false },
      { id: 2, name: "frontend", selectable: true },
      { id: 3, name: "backend", selectable: true },
      { id: 4, name: "fullstack", selectable: true },
      { id: 5, name: "designer", selectable: true },
      { id: 6, name: "qa", selectable: true },
      { id: 7, name: "architect", selectable: true },
      { id: 8, name: "embedded", selectable: true },
      { id: 9, name: "devops", selectable: true },
    ])
  ));
  const frontendRoleId = seededRoles?.roles?.find((role: any) => role.name === "frontend")?.id;
  const backendRoleId = seededRoles?.roles?.find((role: any) => role.name === "backend")?.id;
  await test("create role", "POST", "/api/roles", { name: "support" }, (r, status) => (
    status === 201 && r.role?.name === "support" && r.role?.selectable === true
  ));
  const temporaryRole = await test("create temporary role", "POST", "/api/roles", { name: "temporary" }, (r, status) => (
    status === 201 && Number.isInteger(r.role?.id)
  ));
  await test("read role", "GET", `/api/roles/${temporaryRole?.role?.id}`, undefined, (r, status) => (
    status === 200 && r.role?.name === "temporary"
  ));
  await test("rename role", "PATCH", `/api/roles/${temporaryRole?.role?.id}`, { name: "temporary-renamed" }, (r, status) => (
    status === 200 && r.role?.name === "temporary-renamed"
  ));
  await test("delete unused role", "DELETE", `/api/roles/${temporaryRole?.role?.id}`, undefined, (_r, status) => status === 204);
  await test("reject duplicate role", "POST", "/api/roles", { name: "BACKEND" }, (_r, status) => status === 409);
  await test("protect coordinator rename", "PATCH", "/api/roles/1", { name: "lead" }, (_r, status) => status === 409);
  await test("protect coordinator delete", "DELETE", "/api/roles/1", undefined, (_r, status) => status === 409);
  for (const userId of ["carol@example.com", "grace@example.com", "malik@example.com"]) {
    await test(`seed coordinator role for ${userId}`, "GET", `/api/users/${userId}/roles`, undefined, (r, status) => (
      status === 200 && r.roles?.some((role: any) => role.id === 1)
    ));
  }
  await test("seed worker roles", "GET", "/api/users/dave@example.com/roles", undefined, (r, status) => (
    status === 200 &&
    JSON.stringify(r.roles?.map((role: any) => role.id)) === JSON.stringify([2, 4])
  ));

  // Skills and role relationships
  console.log("\nSkills:");
  const skillRoleForeignKeys = registryDatabase.prepare(
    "PRAGMA foreign_key_list(skill_roles)",
  ).all() as Array<{ table: string; from: string; on_delete: string }>;
  check(
    "skill-role foreign keys",
    skillRoleForeignKeys.some((foreignKey) => (
      foreignKey.table === "skills" && foreignKey.from === "skill_id" && foreignKey.on_delete === "CASCADE"
    )) && skillRoleForeignKeys.some((foreignKey) => (
      foreignKey.table === "roles" && foreignKey.from === "role_id" && foreignKey.on_delete === "RESTRICT"
    )),
    JSON.stringify(skillRoleForeignKeys),
  );
  await test("list all seeded skill ids", "GET", "/mock/skills/ids", undefined, (r, status) => (
    status === 200 &&
    JSON.stringify(r.skillIds) === JSON.stringify(SEED_SKILLS.map((skill) => skill.id))
  ));
  for (let roleId = 1; roleId <= 9; roleId++) {
    const expected = SEED_SKILLS
      .filter((skill) => skill.roleIds.includes(roleId))
      .map((skill) => skill.id);
    await test(`complete skill seed for role ${roleId}`, "GET", `/mock/skills/ids?roleId=${roleId}`, undefined, (r, status) => (
      status === 200 && JSON.stringify(r.skillIds) === JSON.stringify(expected)
    ));
  }
  const accessibilitySkill = await test("create skill with roles", "POST", "/mock/skills", {
    name: "accessibility",
    category: "soft",
    roleIds: [2, 5],
  }, (r, status) => (
    status === 201 &&
    r.skill?.name === "accessibility" &&
    JSON.stringify(r.skill?.roleIds) === JSON.stringify([2, 5])
  ));
  await test("read skill name by id", "GET", `/mock/skills/${accessibilitySkill?.skill?.id}`, undefined, (r, status) => (
    status === 200 && r.skill?.name === "accessibility"
  ));
  await test("replace existing skill roles", "POST", "/mock/skills", {
    name: "accessibility",
    roleIds: [6],
  }, (r, status) => (
    status === 201 &&
    r.skill?.category === "soft" &&
    JSON.stringify(r.skill?.roleIds) === JSON.stringify([6])
  ));
  await test("filter skill ids after role replacement", "GET", "/mock/skills/ids?roleId=6", undefined, (r, status) => (
    status === 200 && r.skillIds?.includes(accessibilitySkill?.skill?.id)
  ));
  await test("reject duplicate skill roles", "POST", "/mock/skills", {
    name: "duplicate-role-skill",
    roleIds: [2, 2],
  }, (_r, status) => status === 400);
  await test("reject unknown skill role", "POST", "/mock/skills", {
    name: "unknown-role-skill",
    roleIds: [9999],
  }, (_r, status) => status === 400);
  const skillRole = await test("create role used by skill", "POST", "/api/roles", { name: "skill-role" }, (r, status) => (
    status === 201 && Number.isInteger(r.role?.id)
  ));
  await test("assign created role to skill", "POST", "/mock/skills", {
    name: "role-bound-skill",
    roleIds: [skillRole?.role?.id],
  }, (_r, status) => status === 201);
  await test("reject deleting role assigned to skill", "DELETE", `/api/roles/${skillRole?.role?.id}`, undefined, (_r, status) => (
    status === 409
  ));

  // Auth/Users
  console.log("\nAuth/Users:");
  await test("register user", "POST", "/api/register", {
    userId: "alice",
    roleIds: [frontendRoleId, backendRoleId],
  }, (r, status) => status === 200 && r.ok && r.roles?.length === 2);
  await test("reject registration without roles", "POST", "/api/register", { userId: "no-roles" }, (_r, status) => status === 400);
  await test("reject duplicate registration roles", "POST", "/api/register", {
    userId: "duplicate-roles",
    roleIds: [frontendRoleId, frontendRoleId],
  }, (_r, status) => status === 400);
  await test("reject coordinator during registration", "POST", "/api/register", {
    userId: "self-coordinator",
    roleIds: [1],
  }, (_r, status) => status === 400);
  await test("reject unknown registration role", "POST", "/api/register", {
    userId: "unknown-role",
    roleIds: [9999],
  }, (_r, status) => status === 400);
  const supportRoleId = (await test("read support role", "GET", "/api/roles", undefined, r => (
    r.roles?.some((role: any) => role.name === "support")
  )))?.roles?.find((role: any) => role.name === "support")?.id;
  await test("register user with shared role", "POST", "/api/register", {
    userId: "support-user",
    roleIds: [supportRoleId],
  }, (r, status) => status === 200 && r.roles?.[0]?.name === "support");
  await test("reject deleting assigned role", "DELETE", `/api/roles/${supportRoleId}`, undefined, (_r, status) => status === 409);
  await test("assign coordinator", "PATCH", "/api/users/alice/coordinator", { enabled: true }, (r, status) => (
    status === 200 && r.roles?.some((role: any) => role.id === 1)
  ));
  const typescriptSkillId = SEED_SKILLS.find(({ name }) => name === "typescript")?.id;
  const figmaSkillId = SEED_SKILLS.find(({ name }) => name === "figma")?.id;
  await test(
    "read seeded user qualifications",
    "GET",
    "/mock/users/carol@example.com/qualifications",
    undefined,
    (r, status) => (
      status === 200 &&
      r.skillIds?.includes(SEED_SKILLS.find(({ name }) => name === "rust")?.id) &&
      JSON.stringify(r.roleIds) === JSON.stringify([1, 3, 7])
    ),
  );
  await test(
    "replace user qualifications and preserve coordinator",
    "PUT",
    "/mock/users/alice/qualifications",
    { skillIds: [typescriptSkillId, figmaSkillId], roleIds: [frontendRoleId, 5] },
    (r, status) => (
      status === 200 &&
      JSON.stringify(r.skillIds) === JSON.stringify([typescriptSkillId, figmaSkillId]) &&
      JSON.stringify(r.roleIds) === JSON.stringify([1, frontendRoleId, 5])
    ),
  );
  const qualificationsBeforeInvalid = await test(
    "read replaced user qualifications",
    "GET",
    "/mock/users/alice/qualifications",
    undefined,
    (r, status) => (
      status === 200 &&
      JSON.stringify(r.skillIds) === JSON.stringify([typescriptSkillId, figmaSkillId]) &&
      JSON.stringify(r.roleIds) === JSON.stringify([1, frontendRoleId, 5])
    ),
  );
  await test(
    "reject invalid qualification replacement",
    "PUT",
    "/mock/users/alice/qualifications",
    { skillIds: [9999], roleIds: [backendRoleId] },
    (_r, status) => status === 400,
  );
  await test(
    "keep qualifications atomic after rejection",
    "GET",
    "/mock/users/alice/qualifications",
    undefined,
    (r, status) => status === 200 && JSON.stringify(r) === JSON.stringify(qualificationsBeforeInvalid),
  );
  await test(
    "reject duplicate qualification skills",
    "PUT",
    "/mock/users/alice/qualifications",
    { skillIds: [typescriptSkillId, typescriptSkillId], roleIds: [frontendRoleId] },
    (_r, status) => status === 400,
  );
  await test(
    "reject coordinator in selectable profile roles",
    "PUT",
    "/mock/users/alice/qualifications",
    { skillIds: [typescriptSkillId], roleIds: [1] },
    (_r, status) => status === 400,
  );
  await test(
    "reject unknown qualification user",
    "GET",
    "/mock/users/missing/qualifications",
    undefined,
    (_r, status) => status === 404,
  );
  const meResponse = await fetch(`${base}/auth/me`, { headers: { Authorization: "Bearer alice" } });
  const me = await meResponse.json() as any;
  if (meResponse.status === 200 && me.roles?.some((role: any) => role.id === 1)) {
    console.log("  PASS  return current roles from authenticated auth me");
    pass++;
  } else {
    console.log(`  FAIL  return current roles from authenticated auth me - Unexpected ${meResponse.status}: ${JSON.stringify(me)}`);
    fail++;
  }
  await test("remove coordinator", "PATCH", "/api/users/alice/coordinator", { enabled: false }, (r, status) => (
    status === 200 &&
    !r.roles?.some((role: any) => role.id === 1) &&
    r.roles?.length === 2
  ));
  await test("reject invalid coordinator flag", "PATCH", "/api/users/alice/coordinator", { enabled: "yes" }, (_r, status) => status === 400);
  await test("reject coordinator for unknown user", "PATCH", "/api/users/missing/coordinator", { enabled: true }, (_r, status) => status === 404);
  await test("check registered", "GET", "/api/check-user-registered?userId=alice", undefined, r => r.ok === true);
  await test("check not registered", "GET", "/api/check-user-registered?userId=unknown", undefined, r => r.ok === false);
  const userAddr = await test("get user address", "GET", "/api/get-user-address?userId=alice", undefined, r => !!r.address);
  await test("get user id by address", "GET", `/api/get-user-id-by-address?address=${userAddr?.address}`, undefined, r => r.userId === "alice");
  await test("attestation", "GET", "/api/attestation?id=alice&challenge=abc", undefined, r => !!r.publicKey);
  await test("assertion", "GET", "/api/assertion?userId=alice&challenge=abc", undefined, r => !!r.publicKey);
  const passwordRegistration = await new PasswordAuthClient(base).register(
    "password-user",
    "correct horse battery staple",
    [frontendRoleId, backendRoleId],
  );
  if (passwordRegistration.ok && passwordRegistration.roles?.length === 2) {
    console.log("  PASS  password registration stores roles");
    pass++;
  } else {
    console.log(`  FAIL  password registration stores roles - Unexpected: ${JSON.stringify(passwordRegistration)}`);
    fail++;
  }
  await expectPasswordRoleError("reject password registration without roles", "password-no-roles", []);
  await expectPasswordRoleError(
    "reject duplicate password registration roles",
    "password-duplicate-roles",
    [frontendRoleId, frontendRoleId],
  );
  await expectPasswordRoleError(
    "reject coordinator during password registration",
    "password-self-coordinator",
    [1],
  );
  await expectPasswordRoleError(
    "reject unknown password registration role",
    "password-unknown-role",
    [9999],
  );

  // Funding/Balance
  console.log("\nFunding/Balance:");
  await test("fund account", "POST", "/api/fund", { address: userAddr?.address }, r => r.ok);
  await test("get balance", "GET", `/api/balance?address=${userAddr?.address}&assetId=1`, undefined, r => BigInt(r.balance) >= 1000000n);

  // Membership
  console.log("\nMembership:");
  await test("add member", "POST", "/api/add-member", { userId: "alice" }, r => r.ok);
  await test("is member", "GET", `/api/is-member?address=${userAddr?.address}`, undefined, r => r.ok === true);
  await test("add community member", "POST", "/api/memberships/1/members", { memberAddress: userAddr?.address }, r => r.success);
  await test("list members", "GET", "/api/memberships/1/members", undefined, r => Array.isArray(r.members));
  await test("check community member", "GET", `/api/memberships/1/members/${userAddr?.address}/check`, undefined, r => r.isMember === true);
  await test("submit remark", "POST", "/api/memberships/governance/submit-remark", { remark: "test", origin: userAddr?.address }, r => r.success);

  // Projects
  console.log("\nProjects:");
  await test("constructors", "GET", "/projects/constructors", undefined, r => Array.isArray(r.constructors));
  const proj = await test("deploy v5", "POST", "/projects/deploy/v5", {
    name: "Test",
    client: userAddr?.address,
    calendar_contract: SEED.contracts.calendar,
  }, r => r.success && !!r.address);
  const pAddr = proj?.address;
  await test("query project info", "GET", `/projects/query/${pAddr}/get_project_info`, undefined, r => r.response?.name === "Test");
  for (const userId of ["carol@example.com", "grace@example.com", "malik@example.com"]) {
    await test(`remove seeded coordinator ${userId}`, "PATCH", `/api/users/${userId}/coordinator`, { enabled: false }, (_r, status) => status === 200);
  }
  await test("assign coordinator role to Dave", "PATCH", "/api/users/dave@example.com/coordinator", { enabled: true }, (r, status) => (
    status === 200 && r.roles?.some((role: any) => role.id === 1)
  ));
  await test("assign coordinator from role 1 only", "POST", `/projects/call/${pAddr}/assign_coordinator`, {}, r => (
    r.coordinator === SEED.users.dave.address
  ));
  await test("propose scope", "POST", `/projects/call/${pAddr}/propose_scope`, {
    data: {
      tasks: [[1, 1, 100, []], [2, 1, 100, [1]]],
      advance_payment_percentage: 10,
      assignment_requirements: [
        {
          task_id: 1,
          requirements: [{
            assignment_key: "developer-1",
            role_id: 2,
            hours: 10,
            skill_ids: [5],
          }, {
            assignment_key: "developer-2",
            role_id: 2,
            hours: 10,
            skill_ids: [5],
          }],
        },
        {
          task_id: 2,
          requirements: [{
            assignment_key: "developer-1",
            role_id: 2,
            hours: 20,
            skill_ids: [5],
          }],
        },
      ],
    },
  }, r => !!r.encodedData);
  const availabilityBefore = await test(
    "snapshot worker availability",
    "GET",
    `/calendar/query/${SEED.contracts.calendar}/get_all_workers_availability`,
    undefined,
    r => Array.isArray(r.response),
  );
  await test("approve scope and assign team", "POST", `/projects/call/${pAddr}/approve_scope`, {
    data: { approved_task_ids: [1, 2] },
  }, r => !!r.encodedData);
  await test("query team", "GET", `/projects/query/${pAddr}/get_team`, undefined, r => Array.isArray(r.response) && r.response.length === 2);
  const plannedTasks = await test(
    "query planned milestone assignments",
    "GET",
    `/projects/query/${pAddr}/get_all_tasks`,
    undefined,
    r => Array.isArray(r.response) &&
      r.response[0]?.assignments?.length === 2 &&
      r.response[1]?.assignments?.length === 1 &&
      "Active" in r.response[0].status &&
      "Approved" in r.response[1].status &&
      r.response[0].assignments.every((assignment: any) => assignment.role_id === 2) &&
      r.response[0].assignments[0].account_id === r.response[1].assignments[0].account_id,
  );
  const assignedAddress = plannedTasks?.response?.[0]?.assignments?.[0]?.account_id;
  const backupAddress = plannedTasks?.response?.[0]?.assignments?.[1]?.account_id;
  const previousHours = availabilityBefore?.response?.find(
    (worker: any) => worker.worker === assignedAddress,
  )?.total_hours;
  await test(
    "reserve milestone hours",
    "GET",
    `/calendar/query/${SEED.contracts.calendar}/get_availability_calendar?worker=${assignedAddress}`,
    undefined,
    r => Array.isArray(r.response) &&
      r.response.length === 12 &&
      r.response.reduce((sum: number, week: any) => sum + week.hours, 0) === previousHours - 10,
  );
  const backupHoursBefore = availabilityBefore?.response?.find(
    (worker: any) => worker.worker === backupAddress,
  )?.total_hours;
  await test("make planned worker unavailable", "POST", `/calendar/call/${SEED.contracts.calendar}/admin_set_worker_availability`, {
    data: { worker: assignedAddress, availability: 0 },
  }, r => r.success);
  await test("submit first milestone", "POST", `/projects/call/${pAddr}/submit_task_for_review`, {
    data: { task_id: 1 },
  }, r => !!r.encodedData);
  await test("accept first milestone and activate second", "POST", `/projects/call/${pAddr}/complete_task`, {
    data: { task_id: 1 },
  }, r => !!r.encodedData);
  await test("worker paid after milestone acceptance", "GET", `/api/balance?address=${assignedAddress}&assetId=1`, undefined, r => BigInt(r.balance) >= 100n);
  await test("reassign active slot from existing project team", "GET", `/projects/query/${pAddr}/get_all_tasks`, undefined, r => (
    r.response?.[1]?.assignments?.[0]?.account_id === backupAddress &&
    "Active" in r.response[1].status
  ));
  await test("reserve second milestone only after activation", "GET", `/calendar/query/${SEED.contracts.calendar}/get_availability_calendar?worker=${backupAddress}`, undefined, r => (
    Array.isArray(r.response) &&
    r.response.reduce((sum: number, week: any) => sum + week.hours, 0) === backupHoursBefore - 30
  ));

  const mismatchProject = await test("deploy role mismatch project", "POST", "/projects/deploy/v5", {
    name: "Role mismatch",
    client: userAddr?.address,
    calendar_contract: SEED.contracts.calendar,
  }, r => r.success && !!r.address);
  await test("assign role mismatch coordinator", "POST", `/projects/call/${mismatchProject?.address}/assign_coordinator`, {}, r => (
    !!r.coordinator
  ));
  await test("reject scope requirement without role", "POST", `/projects/call/${mismatchProject?.address}/propose_scope`, {
    data: {
      tasks: [[1, 1, 100, []]],
      assignment_requirements: [{
        task_id: 1,
        requirements: [{ assignment_key: "designer", hours: 10, skill_ids: [7] }],
      }],
    },
  }, (_r, status) => status === 400);
  await test("propose mismatched role and skill", "POST", `/projects/call/${mismatchProject?.address}/propose_scope`, {
    data: {
      tasks: [[1, 1, 100, []]],
      assignment_requirements: [{
        task_id: 1,
        requirements: [
          { assignment_key: "frontend", role_id: 2, hours: 10, skill_ids: [5] },
          { assignment_key: "designer", role_id: 5, hours: 10, skill_ids: [7] },
        ],
      }],
    },
  }, r => !!r.encodedData);
  const availabilityBeforeMismatch = await test(
    "snapshot availability before failed matching",
    "GET",
    "/mock/workers",
    undefined,
    (r, status) => status === 200 && Array.isArray(r.workers),
  );
  await test("reject worker with skill but wrong role", "POST", `/projects/call/${mismatchProject?.address}/approve_scope`, {
    data: { approved_task_ids: [1] },
  }, (_r, status) => status === 400);
  await test("keep failed role-aware assignment atomic", "GET", `/projects/query/${mismatchProject?.address}/get_team`, undefined, r => (
    Array.isArray(r.response) && r.response.length === 0
  ));
  await test("keep failed task assignments empty", "GET", `/projects/query/${mismatchProject?.address}/get_all_tasks`, undefined, r => (
    Array.isArray(r.response) && r.response.every((task: any) => task.assignments?.length === 0)
  ));
  await test("keep failed availability reservations atomic", "GET", "/mock/workers", undefined, r => (
    JSON.stringify(r.workers?.map((worker: any) => [worker.walletAddress, worker.totalHours])) ===
    JSON.stringify(availabilityBeforeMismatch?.workers?.map((worker: any) => [worker.walletAddress, worker.totalHours]))
  ));

  const crossRoleProject = await test("deploy cross-role skill project", "POST", "/projects/deploy/v5", {
    name: "Cross-role skill",
    client: userAddr?.address,
    calendar_contract: SEED.contracts.calendar,
  }, r => r.success && !!r.address);
  await test("assign cross-role coordinator", "POST", `/projects/call/${crossRoleProject?.address}/assign_coordinator`, {}, r => (
    !!r.coordinator
  ));
  await test("confirm react is not categorized as designer", "GET", "/mock/skills/ids?roleId=5", undefined, r => (
    Array.isArray(r.skillIds) && !r.skillIds.includes(8)
  ));
  await test("propose skill outside role taxonomy", "POST", `/projects/call/${crossRoleProject?.address}/propose_scope`, {
    data: {
      tasks: [[1, 1, 100, []]],
      assignment_requirements: [{
        task_id: 1,
        requirements: [{ assignment_key: "designer", role_id: 5, hours: 10, skill_ids: [8] }],
      }],
    },
  }, r => !!r.encodedData);
  await test("assign worker by owned role and skill", "POST", `/projects/call/${crossRoleProject?.address}/approve_scope`, {
    data: { approved_task_ids: [1] },
  }, (_r, status) => status === 200);

  const atomicAssignProject = await test("deploy direct assignment atomicity project", "POST", "/projects/deploy/v5", {
    name: "Direct assignment atomicity",
    client: userAddr?.address,
    calendar_contract: SEED.contracts.calendar,
  }, r => r.success && !!r.address);
  await test("assign direct assignment coordinator", "POST", `/projects/call/${atomicAssignProject?.address}/assign_coordinator`, {}, r => (
    !!r.coordinator
  ));
  await test("propose under-capacity direct assignment", "POST", `/projects/call/${atomicAssignProject?.address}/propose_scope`, {
    data: {
      tasks: [[1, 1, 100, []]],
      assignment_requirements: [{
        task_id: 1,
        requirements: [{
          assignment_key: "frontend",
          role_id: 2,
          hours: 10000,
          skill_ids: [typescriptSkillId],
        }],
      }],
    },
  }, r => !!r.encodedData);
  const atomicAssignInfo = store.contracts.get(atomicAssignProject?.address)?.projectInfo;
  if (atomicAssignInfo?.tasks[0]) {
    atomicAssignInfo.tasks[0].status = { Approved: null };
    atomicAssignInfo.state = "ScopeAccepted";
  }
  await test("reject direct assignment without enough availability", "POST", `/projects/call/${atomicAssignProject?.address}/assign_team`, {
    data: {},
  }, (_r, status) => status === 400);
  await test("keep failed direct assignment team atomic", "GET", `/projects/query/${atomicAssignProject?.address}/get_team`, undefined, r => (
    Array.isArray(r.response) && r.response.length === 0
  ));
  await test("keep failed direct assignment tasks atomic", "GET", `/projects/query/${atomicAssignProject?.address}/get_all_tasks`, undefined, r => (
    Array.isArray(r.response) &&
    r.response[0]?.assignments?.length === 0 &&
    r.response[0]?.assigned_to === null
  ));

  // Calendar
  console.log("\nCalendar:");
  const cal = await test("deploy calendar", "POST", "/calendar/deploy/v5", {}, r => r.success && !!r.address);
  const cAddr = cal?.address;
  await test(
    "register qualified worker without overwriting qualifications",
    "POST",
    `/calendar/call/${cAddr}/register_worker`,
    { data: { worker: SEED.users.alice.address, skill_ids: [] } },
    r => r.success,
  );
  await test(
    "preserve qualifications after calendar registration",
    "GET",
    "/mock/users/alice/qualifications",
    undefined,
    (r, status) => (
      status === 200 &&
      JSON.stringify(r.skillIds) === JSON.stringify([typescriptSkillId, figmaSkillId]) &&
      JSON.stringify(r.roleIds) === JSON.stringify([frontendRoleId, 5])
    ),
  );
  await test("register worker", "POST", `/calendar/call/${cAddr}/register_worker`, { data: { worker: "w1" } }, r => r.success);
  await test("set availability", "POST", `/calendar/call/${cAddr}/set_availability`, { caller: "w1", data: { availability: 40 } }, r => !!r.encodedData);
  await test("query availability", "GET", `/calendar/query/${cAddr}/get_availability_hours?worker=w1`, undefined, r => r.response === 40);
  await test("query 12-week calendar", "GET", `/calendar/query/${cAddr}/get_availability_calendar?worker=w1`, undefined, r => r.response?.length === 12);
  await test("reject availability over weekly cap", "POST", `/calendar/call/${cAddr}/set_availability`, { caller: "w1", data: { availability: 61 } }, r => r.success === false);
  await test("query workers", "GET", `/calendar/query/${cAddr}/get_registered_workers`, undefined, r => Array.isArray(r.response));
  await test("workers omit coordinator flag", "GET", "/mock/workers", undefined, r => (
    Array.isArray(r.workers) && r.workers.every((worker: any) => !("isCoordinator" in worker))
  ));

  // Ratings
  console.log("\nRatings:");
  await test("deploy ratings", "POST", "/ratings/deploy/v5", {}, r => r.success);

  // Payments
  console.log("\nPayments:");
  const payment = await test("create payment", "POST", "/api/payments/create", {
    senderAddress: userAddr?.address,
    recipientAddress: "addr1",
    amount: "100",
    assetId: 1,
  }, r => !!r.paymentId);
  await test("get payment", "GET", `/api/payments/get?paymentId=${payment?.paymentId}`, undefined, r => r.payment?.state === "Created");
  await test("release payment", "POST", "/api/payments/release", { paymentId: payment?.paymentId }, r => r.success);

  const requestPayment = await test("request payment", "POST", "/api/payments/request-payment", {
    senderAddress: userAddr?.address,
    recipientAddress: "addr2",
    amount: "50",
    assetId: 1,
  }, r => !!r.paymentId);
  await test("accept and pay", "POST", "/api/payments/accept-and-pay", { paymentId: requestPayment?.paymentId }, r => r.success);

  const refundPayment = await test("create refundable payment", "POST", "/api/payments/create", {
    senderAddress: userAddr?.address,
    recipientAddress: "addr3",
    amount: "25",
    assetId: 1,
  }, r => !!r.paymentId);
  await test("request refund", "POST", "/api/payments/request-refund", { paymentId: refundPayment?.paymentId }, r => r.success);
  await test("cancel refund", "POST", "/api/payments/cancel", { paymentId: refundPayment?.paymentId }, r => r.success);

  const disputedPayment = await test("create disputed payment", "POST", "/api/payments/create", {
    senderAddress: userAddr?.address,
    recipientAddress: "addr4",
    amount: "25",
    assetId: 1,
  }, r => !!r.paymentId);
  await test("request disputed refund", "POST", "/api/payments/request-refund", { paymentId: disputedPayment?.paymentId }, r => r.success);
  await test("dispute refund", "POST", "/api/payments/dispute-refund", { paymentId: disputedPayment?.paymentId }, r => r.success);
  await test("resolve dispute", "POST", "/api/payments/resolve-dispute", {
    paymentId: disputedPayment?.paymentId,
    percentBeneficiary: 40,
  }, r => r.success);
  await test("reject insufficient funds", "POST", "/api/payments/create", {
    senderAddress: "empty-account",
    recipientAddress: "addr5",
    amount: "1",
    assetId: 1,
  }, r => r.success === false);

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  console.log(`${"=".repeat(40)}\n`);

  server.close();
  process.exit(fail > 0 ? 1 : 0);
});
