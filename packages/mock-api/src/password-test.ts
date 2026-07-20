// End-to-end smoke for the password-as-keypair flow, exercised via the
// high-level PasswordAuthClient (the same surface the front team will see).
//
// Run: pnpm --filter mock-api start    (in another terminal)
//      tsx packages/mock-api/src/password-test.ts

import {
  PasswordAuthClient,
  PasswordAuthError,
} from "./password-client.js";

const BASE = process.env.MOCK_API_URL ?? "http://localhost:4010";
const USER = "kp-test@example.com";
const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "Tr0ub4dor&3";

let pass = 0;
let fail = 0;

function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       ${JSON.stringify(detail)}` : ""}`);
    fail++;
  }
}

async function expectError(name: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "expected error, got success");
  } catch (e) {
    if (e instanceof PasswordAuthError) {
      check(`${name} → ${status}`, e.status === status, { actual: e.status, body: e.body });
    } else {
      check(name, false, e instanceof Error ? e.message : String(e));
    }
  }
}

async function main() {
  console.log(`Password-as-keypair E2E against ${BASE}\n`);

  const client = new PasswordAuthClient(BASE);

  // ── Registration
  const reg = await client.register(USER, PASSWORD, [2]);
  check("register → ok", reg.ok === true, reg);
  check("register returns address", typeof reg.address === "string");
  check("register returns blockHash", typeof reg.blockHash === "string");

  // Re-register collides
  await expectError("re-register", 409, () => client.register(USER, PASSWORD, [2]));

  // ── Login: correct password
  const login = await client.login(USER, PASSWORD);
  check("login with correct password → ok", login.ok === true);
  check("login returns token", typeof login.token === "string" && login.token.length > 0);
  check("login returns publicKey (account address)", typeof login.publicKey === "string");

  const token = login.token;

  // JWT payload sanity
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
  check("JWT carries userId", payload.userId === USER);
  check("JWT carries address", typeof payload.address === "string");

  // ── Login: wrong password → 401, opaque
  await expectError("login with wrong password", 401, () =>
    client.login(USER, "wrong-password")
  );

  // ── Login: nonexistent user → 401, same code (no enumeration)
  await expectError("login with unknown user", 401, () =>
    client.login("ghost@nowhere.test", PASSWORD)
  );

  // ── Login: stale blockHash → 410.
  // Bypass chainHead() with a hand-crafted stale post.
  const staleResp = await fetch(`${BASE}/api/password-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER,
      blockHash: "0x" + "00".repeat(32),
      clientNonce: "00000000000000000000000000000000",
      signature: "00".repeat(64),
    }),
  });
  check("login with stale blockHash → 410", staleResp.status === 410);

  // ── Tamper detection: valid blockHash but signature for wrong message
  const head = await client.chainHead();
  const tamperResp = await fetch(`${BASE}/api/password-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER,
      blockHash: head.blockHash,
      clientNonce: "deadbeefcafef00ddeadbeefcafef00d",
      signature: "00".repeat(64),
    }),
  });
  check("login with garbage signature → 401", tamperResp.status === 401);

  // ── Change password
  const change = await client.changePassword(token, USER, PASSWORD, NEW_PASSWORD);
  check("change-password → ok", change.ok === true);

  // Old password no longer works
  await expectError("old password rejected after change", 401, () =>
    client.login(USER, PASSWORD)
  );

  // New password works
  const loginNew = await client.login(USER, NEW_PASSWORD);
  check("new password works", loginNew.ok === true);

  // change-password without bearer
  const noTok = await fetch(`${BASE}/api/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockHash: "x" }),
  });
  check("change-password without bearer → 401", noTok.status === 401);

  // ── Existing /auth/me works on the token from password-login
  const meResp = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${USER}` }, // mock /auth/me reads userId from Bearer
  });
  const me = await meResp.json();
  check("/auth/me still works (mock format)", me?.id === USER);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(1);
});
