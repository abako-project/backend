// Smoke test: starts mock-api, hits every endpoint, reports pass/fail
import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";
import { seedStore } from "./seed.js";

const app = express();
app.use(express.json());
app.use("/api", virtoRouter);
app.use("/", contractsRouter);
seedStore();

const PORT = 0; // random available port
const server = app.listen(PORT, async () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") process.exit(1);
  const base = `http://127.0.0.1:${addr.port}`;

  let pass = 0;
  let fail = 0;

  async function test(name: string, method: string, path: string, body?: any, check?: (r: any) => boolean) {
    try {
      const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${base}${path}`, opts);
      const json = await res.json();
      if (check && !check(json)) throw new Error(`Unexpected: ${JSON.stringify(json)}`);
      console.log(`  PASS  ${name}`);
      pass++;
      return json;
    } catch (e: any) {
      console.log(`  FAIL  ${name} - ${e.message}`);
      fail++;
      return null;
    }
  }

  console.log("\nMock API smoke test\n");

  // Health
  console.log("Health:");
  await test("virto health", "GET", "/api/health", undefined, r => r.status === "ok");
  await test("contracts health", "GET", "/health", undefined, r => r.status === "ok");

  // Auth/Users
  console.log("\nAuth/Users:");
  await test("register user", "POST", "/api/register", { userId: "alice" }, r => r.ok);
  await test("check registered", "GET", "/api/check-user-registered?userId=alice", undefined, r => r.ok === true);
  await test("check not registered", "GET", "/api/check-user-registered?userId=unknown", undefined, r => r.ok === false);
  const userAddr = await test("get user address", "GET", "/api/get-user-address?userId=alice", undefined, r => !!r.address);
  await test("get user id by address", "GET", `/api/get-user-id-by-address?address=${userAddr?.address}`, undefined, r => r.userId === "alice");
  await test("attestation", "GET", "/api/attestation?id=alice&challenge=abc", undefined, r => !!r.publicKey);
  await test("assertion", "GET", "/api/assertion?userId=alice&challenge=abc", undefined, r => !!r.publicKey);

  // Funding/Balance
  console.log("\nFunding/Balance:");
  await test("fund account", "POST", "/api/fund", { address: userAddr?.address }, r => r.ok);
  await test("get balance", "GET", `/api/balance?address=${userAddr?.address}&assetId=1`, undefined, r => !!r.balance);

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
  const proj = await test("deploy v5", "POST", "/projects/deploy/v5", { name: "Test", client: userAddr?.address }, r => r.success && !!r.address);
  const pAddr = proj?.address;
  await test("query project info", "GET", `/projects/query/${pAddr}/get_project_info`, undefined, r => r.response?.name === "Test");
  await test("assign coordinator", "POST", `/projects/call/${pAddr}/assign_coordinator`, {}, r => !!r.coordinator);
  await test("assign team", "POST", `/projects/call/${pAddr}/assign_team`, { data: { ideal_team_size: 2 } }, r => !!r.encodedData);
  await test("query team", "GET", `/projects/query/${pAddr}/get_team`, undefined, r => Array.isArray(r.response));
  await test("propose scope", "POST", `/projects/call/${pAddr}/propose_scope`, { data: { tasks: [[0, 1, 100, []]], advance_payment_percentage: 10 } }, r => !!r.encodedData);
  await test("query tasks", "GET", `/projects/query/${pAddr}/get_all_tasks`, undefined, r => Array.isArray(r.response));

  // Calendar
  console.log("\nCalendar:");
  const cal = await test("deploy calendar", "POST", "/calendar/deploy/v5", {}, r => r.success && !!r.address);
  const cAddr = cal?.address;
  await test("register worker", "POST", `/calendar/call/${cAddr}/register_worker`, { data: { worker: "w1" } }, r => r.success);
  await test("set availability", "POST", `/calendar/call/${cAddr}/set_availability`, { caller: "w1", data: { availability: 40 } }, r => !!r.encodedData);
  await test("query availability", "GET", `/calendar/query/${cAddr}/get_availability_hours?worker=w1`, undefined, r => r.response === 40);
  await test("query workers", "GET", `/calendar/query/${cAddr}/get_registered_workers`, undefined, r => Array.isArray(r.response));

  // Ratings
  console.log("\nRatings:");
  await test("deploy ratings", "POST", "/ratings/deploy/v5", {}, r => r.success);

  // Payments
  console.log("\nPayments:");
  await test("create payment", "POST", "/api/payments/create", { recipientAddress: "addr1", amount: "100", assetId: 1 }, r => !!r.paymentId);
  await test("get payment", "GET", "/api/payments/get?paymentId=1", undefined, r => !!r.payment);
  await test("release payment", "POST", "/api/payments/release", { paymentId: "1" }, r => r.success);
  await test("accept and pay", "POST", "/api/payments/accept-and-pay", { paymentId: "1" }, r => r.success);

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  console.log(`${"=".repeat(40)}\n`);

  server.close();
  process.exit(fail > 0 ? 1 : 0);
});
