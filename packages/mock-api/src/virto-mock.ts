// Mock routes for virto-api endpoints (mounted under /api)
import { Router } from "express";
import { store } from "./store.js";
import { DEFAULT_ASSET_ID, DEFAULT_INITIAL_BALANCE, ledger } from "./ledger.js";
import { payments } from "./payments.js";
import {
  canonicalMessage,
  hexToBytes,
  verifySignature,
  BLOCKHASH_WINDOW,
} from "./password.js";

export const virtoRouter = Router();

function paymentError(res: any, error: unknown): void {
  res.status(400).json({
    success: false,
    error: error instanceof Error ? error.message : "Payment operation failed",
  });
}

/** Mock JWT — header.payload.signature, payload carries {userId, address}. */
function mockToken(userId: string, address: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      address,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    })
  ).toString("base64url");
  return `${header}.${payload}.mocksig`;
}

/** Decode a mock JWT to its payload. Returns null if malformed. */
function decodeMockToken(token: string): { userId?: string; address?: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
    return payload;
  } catch {
    return null;
  }
}

/** Validates a hex string of exactly `bytes` bytes. */
function isHexOfLength(s: unknown, bytes: number): s is string {
  if (typeof s !== "string") return false;
  const stripped = s.startsWith("0x") ? s.slice(2) : s;
  return stripped.length === bytes * 2 && /^[0-9a-fA-F]*$/.test(stripped);
}
const isHex32 = (s: unknown) => isHexOfLength(s, 32);
const isHex64 = (s: unknown) => isHexOfLength(s, 64);

function stripHex(s: string): string {
  return s.startsWith("0x") ? s.slice(2) : s;
}

function verifyEdSig(
  pubKeyHex: string,
  message: Uint8Array,
  signatureHex: string,
): boolean {
  try {
    return verifySignature(
      hexToBytes(stripHex(pubKeyHex)),
      message,
      hexToBytes(stripHex(signatureHex)),
    );
  } catch {
    return false;
  }
}

// Health
virtoRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "vos-mock (mock-api)",
  });
});

// WebAuthn attestation (registration init)
virtoRouter.get("/attestation", (req, res) => {
  const { id, name, challenge } = req.query;
  if (!id || !challenge) {
    res.status(400).json({ error: "id and challenge are required" });
    return;
  }

  const userId = String(id);
  const user = store.getOrCreateUser(userId);

  res.json({
    publicKey: {
      rp: { name: "Kunveno Mock" },
      user: {
        id: Array.from(Buffer.from(userId)),
        name: String(name || userId),
        displayName: String(name || userId),
      },
      challenge: String(challenge),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { userVerification: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
    blockNumber: store.nextBlockNumber(),
  });
});

// WebAuthn register (complete registration)
virtoRouter.post("/register", (req, res) => {
  const { userId, credentialId, address } = req.body;
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const user = store.getOrCreateUser(userId);
  if (credentialId) user.credentialId = credentialId;
  if (address) user.address = address;

  res.json({ ok: true });
});

// WebAuthn assertion (login init)
virtoRouter.get("/assertion", (req, res) => {
  const { userId, challenge } = req.query;
  if (!userId || !challenge) {
    res.status(400).json({ error: "userId and challenge are required" });
    return;
  }

  const user = store.users.get(String(userId));
  const allowCredentials = user
    ? [{ id: user.credentialId, type: "public-key" as const }]
    : [];

  res.json({
    publicKey: {
      challenge: String(challenge),
      allowCredentials,
      userVerification: "preferred",
      timeout: 60000,
    },
    blockNumber: store.nextBlockNumber(),
  });
});

// ─────────────────── Email + Password (password-as-keypair) ───────────────────
//
// The chain (mocked here) stores only the user's password-derived ed25519
// pubKey. To authenticate, the client signs a recent blockHash with the
// matching privKey, which it re-derives from the password. Plain password
// never leaves the client. See password.ts for the derivation, and
// password-vectors.ts for cross-language test vectors.

// GET /chain-head — current { blockNumber, blockHash }, used as the freshness
// challenge. In the real flow the front reads this from chain via the SDK.
virtoRouter.get("/chain-head", (_req, res) => {
  const blockNumber = store.nextBlockNumber();
  res.json({ blockNumber, blockHash: store.currentBlockHash() });
});

// POST /password-register — registers a password-derived pubKey for the user.
//
// Body: { userId, pubKey: hex32, blockHash, clientNonce, signature: hex64, address? }
// The signature is over canonical("register" | userId | blockHash | nonce | pubKey)
// using the privKey derived from the password — it's a proof of possession.
// 200 → { ok, address, blockNumber, blockHash }
// 400 malformed; 401 signature invalid; 409 already registered; 410 stale blockHash.
virtoRouter.post("/password-register", (req, res) => {
  const { userId, pubKey, blockHash, clientNonce, signature, address } = req.body ?? {};
  if (
    typeof userId !== "string" ||
    !isHex32(pubKey) ||
    typeof blockHash !== "string" ||
    typeof clientNonce !== "string" ||
    !isHex64(signature)
  ) {
    res.status(400).json({
      error: "userId, pubKey (hex32), blockHash, clientNonce, signature (hex64) required",
    });
    return;
  }

  if (!store.isRecentBlockHash(blockHash, BLOCKHASH_WINDOW)) {
    res.status(410).json({ ok: false, error: "blockHash outside freshness window" });
    return;
  }

  const existing = store.users.get(userId);
  if (existing?.pubKey) {
    res.status(409).json({ error: "User already registered with a password" });
    return;
  }

  const message = canonicalMessage({
    label: "register",
    userId,
    blockHash,
    clientNonce,
    extra: stripHex(pubKey),
  });
  if (!verifyEdSig(pubKey, message, signature)) {
    res.status(401).json({ ok: false, error: "Invalid signature" });
    return;
  }

  const user = store.getOrCreateUser(userId);
  if (typeof address === "string" && address.length > 0) user.address = address;
  user.pubKey = stripHex(pubKey);
  user.isMember = true;

  res.json({
    ok: true,
    address: user.address,
    blockNumber: store.nextBlockNumber(),
    blockHash: store.currentBlockHash(),
  });
});

// POST /password-connect — verifies a signature against the stored pubKey
// and mints a JWT.
//
// Body: { userId, blockHash, clientNonce, signature: hex64 }
// signature is over canonical("connect" | userId | blockHash | nonce).
// 200 → { ok, token, publicKey, blockNumber }
// 400 malformed; 401 invalid credentials (opaque); 410 stale blockHash.
virtoRouter.post("/password-connect", (req, res) => {
  const { userId, blockHash, clientNonce, signature } = req.body ?? {};
  if (
    typeof userId !== "string" ||
    typeof blockHash !== "string" ||
    typeof clientNonce !== "string" ||
    !isHex64(signature)
  ) {
    res.status(400).json({ error: "userId, blockHash, clientNonce, signature (hex64) required" });
    return;
  }

  if (!store.isRecentBlockHash(blockHash, BLOCKHASH_WINDOW)) {
    res.status(410).json({ ok: false, error: "blockHash outside freshness window" });
    return;
  }

  // Opaque 401 — never reveal whether the user exists vs. wrong signature.
  const fail = () => res.status(401).json({ ok: false, error: "Invalid credentials" });
  const user = store.users.get(userId);
  if (!user?.pubKey) {
    fail();
    return;
  }

  const message = canonicalMessage({
    label: "connect",
    userId,
    blockHash,
    clientNonce,
  });
  if (!verifyEdSig(user.pubKey, message, signature)) {
    fail();
    return;
  }

  res.json({
    ok: true,
    token: mockToken(user.userId, user.address),
    publicKey: user.address,
    blockNumber: store.nextBlockNumber(),
  });
});

// POST /change-password — proves possession of the current key AND of the new
// key, then replaces the stored pubKey.
//
// Auth: Bearer <token>
// Body: { blockHash, clientNonce, oldSignature: hex64, newPubKey: hex32, newSignature: hex64 }
//   oldSignature signs canonical("change-password-old" | userId | bh | nonce | newPubKey)
//   newSignature signs canonical("change-password-new" | userId | bh | nonce | newPubKey)
// Both signatures bind to the new pubKey so neither can be substituted alone.
// 200 → { ok }
// 401 if token bad or any signature fails; 410 stale blockHash.
virtoRouter.post("/change-password", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const tokenPayload = decodeMockToken(auth.slice("Bearer ".length).trim());
  const userId = tokenPayload?.userId;
  const user = userId ? store.users.get(userId) : undefined;
  if (!user?.pubKey) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const { blockHash, clientNonce, oldSignature, newPubKey, newSignature } = req.body ?? {};
  if (
    typeof blockHash !== "string" ||
    typeof clientNonce !== "string" ||
    !isHex64(oldSignature) ||
    !isHex32(newPubKey) ||
    !isHex64(newSignature)
  ) {
    res.status(400).json({
      error: "blockHash, clientNonce, oldSignature (hex64), newPubKey (hex32), newSignature (hex64) required",
    });
    return;
  }

  if (!store.isRecentBlockHash(blockHash, BLOCKHASH_WINDOW)) {
    res.status(410).json({ ok: false, error: "blockHash outside freshness window" });
    return;
  }

  const newPubKeyStripped = stripHex(newPubKey);
  const oldMessage = canonicalMessage({
    label: "change-password-old",
    userId: user.userId,
    blockHash,
    clientNonce,
    extra: newPubKeyStripped,
  });
  const newMessage = canonicalMessage({
    label: "change-password-new",
    userId: user.userId,
    blockHash,
    clientNonce,
    extra: newPubKeyStripped,
  });

  if (
    !verifyEdSig(user.pubKey, oldMessage, oldSignature) ||
    !verifyEdSig(newPubKey, newMessage, newSignature)
  ) {
    res.status(401).json({ ok: false, error: "Invalid signatures" });
    return;
  }

  user.pubKey = newPubKeyStripped;
  res.json({ ok: true });
});

// Check if user is registered
virtoRouter.get("/check-user-registered", (req, res) => {
  const userId = String(req.query.userId || "");
  const user = store.users.get(userId);
  res.json({ ok: !!user });
});

// Get user address by userId
virtoRouter.get("/get-user-address", (req, res) => {
  const userId = String(req.query.userId || "");
  const user = store.getOrCreateUser(userId);
  res.json({ address: user.address });
});

// Get userId by address
virtoRouter.get("/get-user-id-by-address", (req, res) => {
  const address = String(req.query.address || "");
  const user = store.getUserByAddress(address);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ userId: user.userId });
});

// Add member
virtoRouter.post("/add-member", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const user = store.getOrCreateUser(userId);
  user.isMember = true;
  res.json({ ok: true });
});

// Check membership
virtoRouter.get("/is-member", (req, res) => {
  const address = String(req.query.address || "");
  const user = store.getUserByAddress(address);
  res.json({ ok: user?.isMember ?? false });
});

// Fund account
virtoRouter.post("/fund", (req, res) => {
  try {
    const { address, assetId, amount } = req.body;
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }
    const fundedAmount = amount || DEFAULT_INITIAL_BALANCE;
    ledger.credit(address, assetId || DEFAULT_ASSET_ID, fundedAmount, "fund");
    res.json({
      ok: true,
      txHash: store.generateTxHash(),
      blockHash: store.generateTxHash(),
      address,
      assetId: assetId || DEFAULT_ASSET_ID,
      amount: String(fundedAmount),
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Funding failed" });
  }
});

// Get balance
virtoRouter.get("/balance", (req, res) => {
  const address = String(req.query.address || "");
  const assetId = parseInt(String(req.query.assetId || "1"));
  res.json({
    balance: ledger.getBalance(address, assetId),
    assetId,
  });
});

// --- Payments ---

virtoRouter.post("/payments/create", (req, res) => {
  try {
    const { senderAddress, recipientAddress, amount, assetId, remark } = req.body;
    if (!senderAddress || !recipientAddress) throw new Error("senderAddress and recipientAddress are required");
    const payment = payments.createPayment({
      from: senderAddress,
      to: recipientAddress,
      amount,
      assetId: assetId || DEFAULT_ASSET_ID,
      remark,
    });
    res.json({ success: true, txHash: store.generateTxHash(), paymentId: payment.paymentId });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/release", (req, res) => {
  try {
    payments.releasePayment(req.body.paymentId);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/accept-and-pay", (req, res) => {
  try {
    payments.acceptAndPay(req.body.paymentId);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.get("/payments/get", (req, res) => {
  const paymentId = String(req.query.paymentId || "");
  res.json({ payment: payments.getPayment(paymentId) });
});

virtoRouter.post("/payments/request-payment", (req, res) => {
  try {
    const { senderAddress, recipientAddress, amount, assetId, remark } = req.body;
    if (!senderAddress || !recipientAddress) throw new Error("senderAddress and recipientAddress are required");
    const payment = payments.requestPayment({
      from: senderAddress,
      to: recipientAddress,
      amount,
      assetId: assetId || DEFAULT_ASSET_ID,
      remark,
    });
    res.json({ success: true, txHash: store.generateTxHash(), paymentId: payment.paymentId });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/request-refund", (req, res) => {
  try {
    payments.requestRefund(req.body.paymentId);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/cancel", (req, res) => {
  try {
    payments.cancelPayment(req.body.paymentId);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/dispute-refund", (req, res) => {
  try {
    payments.disputeRefund(req.body.paymentId);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.post("/payments/resolve-dispute", (req, res) => {
  try {
    payments.resolveDispute(req.body.paymentId, req.body.percentBeneficiary);
    res.json({ success: true, txHash: store.generateTxHash() });
  } catch (error) {
    paymentError(res, error);
  }
});

virtoRouter.get("/payments/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "payments-mock",
  });
});

// --- Memberships ---

virtoRouter.get("/memberships/:communityId/address", (req, res) => {
  res.json({ address: store.generateAddress() });
});

virtoRouter.get("/memberships/:communityId/members", (req, res) => {
  const communityId = req.params.communityId;
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "10"));
  const members = store.members.get(communityId) || [];
  const start = (page - 1) * limit;
  const paged = members.slice(start, start + limit);

  res.json({
    members: paged,
    total: members.length,
    page,
    limit,
    totalPages: Math.ceil(members.length / limit) || 1,
  });
});

virtoRouter.get("/memberships/:communityId/members/:membershipId", (req, res) => {
  const communityId = req.params.communityId;
  const membershipId = parseInt(req.params.membershipId);
  const members = store.members.get(communityId) || [];
  const member = members.find((m) => m.membershipId === membershipId);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json({ member });
});

virtoRouter.get("/memberships/:communityId/members/:address/check", (req, res) => {
  const communityId = req.params.communityId;
  const address = req.params.address;
  const members = store.members.get(communityId) || [];
  const isMember = members.some((m) => m.address === address);
  res.json({ isMember });
});

virtoRouter.post("/memberships/:communityId/members", (req, res) => {
  const communityId = req.params.communityId;
  const { memberAddress } = req.body;
  store.addMember(communityId, memberAddress);
  res.json({ success: true });
});

virtoRouter.delete("/memberships/:communityId/members/:address", (req, res) => {
  const communityId = req.params.communityId;
  const address = req.params.address;
  const members = store.members.get(communityId) || [];
  const idx = members.findIndex((m) => m.address === address);
  let membershipId = "0";
  if (idx >= 0) {
    membershipId = String(members[idx].membershipId);
    members.splice(idx, 1);
    store.members.set(communityId, members);
  }
  res.json({ success: true, membershipId });
});

virtoRouter.post("/memberships/governance/submit-remark", (req, res) => {
  // Return mock encoded call data
  res.json({
    success: true,
    callData: "0x" + "00".repeat(32),
  });
});

virtoRouter.get("/memberships/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "memberships-mock",
  });
});
