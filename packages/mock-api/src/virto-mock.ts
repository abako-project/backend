// Mock routes for virto-api endpoints (mounted under /api)
import { Router } from "express";
import { store } from "./store.js";

export const virtoRouter = Router();

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
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }
  res.json({
    ok: true,
    txHash: store.generateTxHash(),
    blockHash: store.generateTxHash(),
    address,
    amount: "100000000000",
  });
});

// Get balance
virtoRouter.get("/balance", (req, res) => {
  const address = String(req.query.address || "");
  const assetId = parseInt(String(req.query.assetId || "1"));
  // Return a reasonable mock balance
  res.json({
    balance: "50000000000",
    assetId,
  });
});

// --- Payments ---

virtoRouter.post("/payments/create", (req, res) => {
  const { recipientAddress, amount, assetId } = req.body;
  const senderAddress = store.generateAddress();
  const payment = store.createPayment(
    senderAddress,
    recipientAddress || store.generateAddress(),
    String(amount || "0"),
    assetId || 1
  );
  res.json({
    success: true,
    txHash: store.generateTxHash(),
    paymentId: payment.paymentId,
  });
});

virtoRouter.post("/payments/release", (req, res) => {
  const { paymentId } = req.body;
  const payment = store.payments.get(String(paymentId));
  if (payment) payment.state = "Released";
  res.json({
    success: true,
    txHash: store.generateTxHash(),
  });
});

virtoRouter.post("/payments/accept-and-pay", (req, res) => {
  const { paymentId } = req.body;
  const payment = store.payments.get(String(paymentId));
  if (payment) payment.state = "Completed";
  res.json({
    success: true,
    txHash: store.generateTxHash(),
  });
});

virtoRouter.get("/payments/get", (req, res) => {
  const paymentId = String(req.query.paymentId || "");
  const payment = store.payments.get(paymentId);
  res.json({ payment: payment || null });
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
