// Seed data shared between mock-api and adapter-api.
// Uses fixed addresses so cross-references stay consistent across restarts.

import { store, MockTask, MockTeamMember, MockProjectInfo } from "./store.js";

// Fixed Substrate-style addresses for seed users
export const SEED = {
  users: {
    alice: {
      userId: "alice@example.com",
      address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      credentialId: "cred_seed_alice",
    },
    bob: {
      userId: "bob@example.com",
      address: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      credentialId: "cred_seed_bob",
    },
    carol: {
      userId: "carol@example.com",
      address: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
      credentialId: "cred_seed_carol",
    },
    dave: {
      userId: "dave@example.com",
      address: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
      credentialId: "cred_seed_dave",
    },
    eve: {
      userId: "eve@example.com",
      address: "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
      credentialId: "cred_seed_eve",
    },
  },

  // Fixed contract addresses for seed projects
  contracts: {
    defiDashboard: "5Ck5SLSHYac6WFt5UZRSsdJjwmpSZq85fd5TRNAdZQVzEAPT",
    nftMarketplace: "5HpG9w8EBLe5XCrbczpwq5TSXvedjrBGCwqxK1iQ7qUsSWFc",
    mobileWallet: "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z",
    contractAudit: "5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSneWj5VDnQU",
    calendar: "5Dd34LSU53MLwJpq4wfHmDFwAifJrcaPbd1qTCGZcR7iXQkd",
    ratings: "5JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY",
  },
} as const;

const { users: U, contracts: C } = SEED;

/**
 * Populate the in-memory store with seed users and contracts.
 * Called once on mock-api startup.
 */
export function seedStore(): void {
  // --- Users ---
  for (const u of Object.values(U)) {
    const user = store.getOrCreateUser(u.userId);
    user.address = u.address;
    user.credentialId = u.credentialId;
    user.isMember = true;
  }

  // --- Calendar contract ---
  store.contracts.set(C.calendar, {
    address: C.calendar,
    type: "calendar",
    inkVersion: "5",
    calendarInfo: {
      workers: new Map([
        [U.carol.address, 40],
        [U.dave.address, 20],
        [U.eve.address, 32],
      ]),
    },
  });

  // --- Ratings contract ---
  store.contracts.set(C.ratings, {
    address: C.ratings,
    type: "ratings",
    inkVersion: "5",
    ratingsInfo: {
      ratings: [
        { target: U.carol.address, rating: 9, category: "quality" },
        { target: U.dave.address, rating: 8, category: "quality" },
      ],
      workers: [U.carol.address, U.dave.address, U.eve.address],
    },
  });

  // --- Project 1: DeFi Dashboard (CoordinatorAssigned) ──────────────
  store.contracts.set(C.defiDashboard, {
    address: C.defiDashboard,
    type: "projects",
    inkVersion: "5",
    projectInfo: {
      name: "DeFi Dashboard",
      client: U.alice.address,
      dao_address: store.generateAddress(),
      coordinator: U.carol.address,
      state: "CoordinatorAssigned",
      team: [],
      tasks: [],
      scope: null,
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: 0,
      paid_amount: 0,
    },
  });

  // --- Project 2: NFT Marketplace (ScopePendingClientApproval) ──────
  const nftTasks: MockTask[] = [
    { id: 1, complexity: { type: "Days", value: 15 }, cost: "3000", dependencies: [], completed: false, status: { Pending: null }, assigned_to: null },
    { id: 2, complexity: { type: "Days", value: 20 }, cost: "5000", dependencies: [1], completed: false, status: { Pending: null }, assigned_to: null },
    { id: 3, complexity: { type: "Days", value: 10 }, cost: "2000", dependencies: [], completed: false, status: { Pending: null }, assigned_to: null },
  ];

  store.contracts.set(C.nftMarketplace, {
    address: C.nftMarketplace,
    type: "projects",
    inkVersion: "5",
    projectInfo: {
      name: "NFT Marketplace",
      client: U.alice.address,
      dao_address: store.generateAddress(),
      coordinator: U.carol.address,
      state: "ScopePendingClientApproval",
      team: [],
      tasks: nftTasks,
      scope: {
        tasks: nftTasks.map((t) => [t.id, t.complexity, t.cost, t.dependencies]),
        advance_payment_percentage: 20,
        document_hash: "QmSeedHash1234567890abcdef",
        state: "Proposed",
      },
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: 0,
      paid_amount: 0,
    },
  });

  // --- Project 3: Mobile Wallet (TeamAssigned, in progress) ─────────
  const walletTasks: MockTask[] = [
    { id: 1, complexity: { type: "Days", value: 10 }, cost: "4000", dependencies: [], completed: true, status: { PendingReview: 1005 }, assigned_to: U.dave.address },
    { id: 2, complexity: { type: "Days", value: 15 }, cost: "6000", dependencies: [], completed: false, status: { PendingReview: 1010 }, assigned_to: U.dave.address },
    { id: 3, complexity: { type: "Days", value: 20 }, cost: "8000", dependencies: [1], completed: false, status: { Approved: 1003 }, assigned_to: U.eve.address },
  ];
  const walletTotalCost = 18000; // 4000 + 6000 + 8000
  const walletAdvancePct = 30;

  store.contracts.set(C.mobileWallet, {
    address: C.mobileWallet,
    type: "projects",
    inkVersion: "5",
    projectInfo: {
      name: "Mobile Wallet App",
      client: U.bob.address,
      dao_address: store.generateAddress(),
      coordinator: U.carol.address,
      state: "TeamAssigned",
      team: [
        { account_id: U.dave.address, role: "Designer", rating: null },
        { account_id: U.eve.address, role: "Developer", rating: null },
      ],
      tasks: walletTasks,
      scope: {
        tasks: walletTasks.map((t) => [t.id, t.complexity, t.cost, t.dependencies]),
        advance_payment_percentage: walletAdvancePct,
        document_hash: "QmSeedHash9876543210fedcba",
        state: "Approved",
      },
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: walletTotalCost,
      paid_amount: Math.floor(walletTotalCost * walletAdvancePct / 100),
    },
  });

  // --- Project 4: Smart Contract Audit (Completed) ──────────────────
  const auditTasks: MockTask[] = [
    { id: 1, complexity: { type: "Days", value: 10 }, cost: "5000", dependencies: [], completed: true, status: { PendingReview: 1020 }, assigned_to: U.dave.address },
    { id: 2, complexity: { type: "Days", value: 15 }, cost: "7000", dependencies: [1], completed: true, status: { PendingReview: 1025 }, assigned_to: U.dave.address },
  ];
  const auditTotalCost = 12000;

  store.contracts.set(C.contractAudit, {
    address: C.contractAudit,
    type: "projects",
    inkVersion: "5",
    projectInfo: {
      name: "Smart Contract Security Audit",
      client: U.bob.address,
      dao_address: store.generateAddress(),
      coordinator: U.carol.address,
      state: "Completed",
      team: [
        { account_id: U.dave.address, role: "Developer", rating: 85 },
      ],
      tasks: auditTasks,
      scope: {
        tasks: auditTasks.map((t) => [t.id, t.complexity, t.cost, t.dependencies]),
        advance_payment_percentage: 25,
        document_hash: "QmSeedHashAudit123456",
        state: "Approved",
      },
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: auditTotalCost,
      paid_amount: auditTotalCost, // fully paid
    },
  });

  console.log("  Seed data loaded:");
  console.log(`    ${Object.keys(U).length} users`);
  console.log(`    ${store.contracts.size} contracts`);
}
