// Seed data shared between mock-api and adapter-api.
// Uses fixed addresses so cross-references stay consistent across restarts.

import { store, MockTask, MockTeamMember, MockProjectInfo } from "./store.js";
import { SkillCategory, workerRegistry } from "./worker-registry.js";
import { ledger } from "./ledger.js";

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
    frank: {
      userId: "frank@example.com",
      address: "5FRAkQ2HFxVwLxq7ALxGm8fRzGrPb7YVQJjJfm3SgVtK8eUa",
      credentialId: "cred_seed_frank",
    },
    grace: {
      userId: "grace@example.com",
      address: "5GRAcE4nVh7KpM2sQw9YtB6dFx3Lz8RjUa1Ce5NvHg2Pk7Ws",
      credentialId: "cred_seed_grace",
    },
    heidi: {
      userId: "heidi@example.com",
      address: "5HEiD9xQm4Vb7Np2Lk8Tc5Rw1Yg6Fs3ZaUh9Jd4Ke7Bn2PxM",
      credentialId: "cred_seed_heidi",
    },
    ivan: {
      userId: "ivan@example.com",
      address: "5iVAn7Rm3Kq9Wc2Tx6Bp4Ld8Yh1Fs5NzUa7Je3Gv9Qm2PkX",
      credentialId: "cred_seed_ivan",
    },
    judy: {
      userId: "judy@example.com",
      address: "5JUDy8Qn2Vf6Kp4Rx9Lm3Tc7Za1Hg5WsEu8Bd2Nj6Yr4PkMx",
      credentialId: "cred_seed_judy",
    },
    malik: {
      userId: "malik@example.com",
      address: "5MALiK3Qr8Vn2Fc7Wp4Yt9Lx1Hg6Bs5Za8Je3Du7Km2RwPx",
      credentialId: "cred_seed_malik",
    },
    nina: {
      userId: "nina@example.com",
      address: "5NiNA4Vq7Kx2Rm9Tc5Wp1Ld8Yh3Fs6ZaUa4Je7Gn2Bk9PxM",
      credentialId: "cred_seed_nina",
    },
    oscar: {
      userId: "oscar@example.com",
      address: "5OSCaR8Qm3Vf6Kp2Lx9Tc4Rw1Yg7Hs5ZaUb8Je3Dn6Pk2Mx",
      credentialId: "cred_seed_oscar",
    },
    priya: {
      userId: "priya@example.com",
      address: "5PRiYA7Qn4Vk2Rm8Tc6Wp3Ld9Yh1Fs5ZaUg7Je4Bn2Kx8PxM",
      credentialId: "cred_seed_priya",
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

const SEED_SKILL_DEFINITIONS: Array<{ name: string; category: SkillCategory }> = [
  { name: "rust", category: "software" },
  { name: "solidity", category: "software" },
  { name: "ink", category: "software" },
  { name: "substrate", category: "software" },
  { name: "typescript", category: "software" },
  { name: "javascript", category: "software" },
  { name: "node.js", category: "software" },
  { name: "react", category: "software" },
  { name: "next.js", category: "software" },
  { name: "vue", category: "software" },
  { name: "postgresql", category: "software" },
  { name: "sqlite", category: "software" },
  { name: "docker", category: "software" },
  { name: "kubernetes", category: "software" },
  { name: "aws", category: "software" },
  { name: "graphql", category: "software" },
  { name: "rest api", category: "software" },
  { name: "web3", category: "software" },
  { name: "smart contract auditing", category: "software" },
  { name: "automated testing", category: "software" },
  { name: "ui/ux", category: "software" },
  { name: "figma", category: "software" },
  { name: "react native", category: "software" },
  { name: "communication", category: "soft" },
  { name: "leadership", category: "soft" },
  { name: "mentoring", category: "soft" },
  { name: "problem solving", category: "soft" },
  { name: "stakeholder management", category: "soft" },
  { name: "facilitation", category: "soft" },
  { name: "technical writing", category: "soft" },
  { name: "teamwork", category: "soft" },
  { name: "adaptability", category: "soft" },
  { name: "time management", category: "soft" },
];

export const SEED_SKILLS = SEED_SKILL_DEFINITIONS.map(
  (skill, index) => ({ id: index + 1, ...skill }),
);

const SKILL_ID_BY_NAME = new Map(SEED_SKILLS.map((skill) => [skill.name, skill.id]));

function skillIds(names: readonly string[]): number[] {
  return names.map((name) => {
    const id = SKILL_ID_BY_NAME.get(name);
    if (!id) throw new Error(`Unknown seed skill: ${name}`);
    return id;
  });
}

const SEEDED_WORKERS = [
  { key: "carol", name: "Carol Chen", coordinator: true, hours: 40, skills: ["rust", "ink", "substrate", "node.js", "leadership", "stakeholder management"] },
  { key: "dave", name: "Dave Kim", coordinator: false, hours: 32, skills: ["typescript", "javascript", "react", "next.js", "ui/ux", "teamwork"] },
  { key: "eve", name: "Eve Santos", coordinator: false, hours: 40, skills: ["rust", "solidity", "smart contract auditing", "automated testing", "technical writing"] },
  { key: "frank", name: "Frank Müller", coordinator: false, hours: 24, skills: ["node.js", "postgresql", "graphql", "rest api", "problem solving"] },
  { key: "grace", name: "Grace Okafor", coordinator: true, hours: 40, skills: ["typescript", "react", "web3", "leadership", "facilitation", "communication"] },
  { key: "heidi", name: "Heidi Berg", coordinator: false, hours: 20, skills: ["figma", "ui/ux", "react", "communication", "adaptability"] },
  { key: "ivan", name: "Ivan Petrov", coordinator: false, hours: 36, skills: ["rust", "substrate", "docker", "kubernetes", "problem solving"] },
  { key: "judy", name: "Judy Alvarez", coordinator: false, hours: 30, skills: ["react native", "typescript", "automated testing", "teamwork", "time management"] },
  { key: "malik", name: "Malik Rahman", coordinator: true, hours: 40, skills: ["solidity", "web3", "postgresql", "leadership", "mentoring", "technical writing"] },
  { key: "nina", name: "Nina Rossi", coordinator: false, hours: 28, skills: ["vue", "javascript", "node.js", "sqlite", "adaptability"] },
  { key: "oscar", name: "Oscar Silva", coordinator: false, hours: 16, skills: ["aws", "docker", "kubernetes", "postgresql", "communication"] },
  { key: "priya", name: "Priya Shah", coordinator: false, hours: 0, skills: ["typescript", "react", "graphql", "mentoring", "teamwork"] },
] as const;

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
  ledger.seedAssets();
  ledger.seedInitialBalances((userId) => store.getOrCreateUser(userId));

  workerRegistry.seed(
    SEED_SKILLS,
    SEEDED_WORKERS.map((worker) => {
      const user = U[worker.key];
      return {
        walletAddress: user.address,
        userId: user.userId,
        name: worker.name,
        isCoordinator: worker.coordinator,
        skillIds: skillIds(worker.skills),
        permanentWeeklyHours: worker.hours,
      };
    }),
  );

  // --- Calendar contract ---
  store.contracts.set(C.calendar, {
    address: C.calendar,
    type: "calendar",
    inkVersion: "5",
    calendarInfo: {
      workers: new Set(SEEDED_WORKERS.map((worker) => U[worker.key].address)),
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
    { id: 1, complexity: { type: "Days", value: 15 }, cost: "3000", dependencies: [], completed: false, status: { Pending: null }, assigned_to: null, assignments: [], requirements: [{ assignment_key: "developer-1", hours: 80, skill_ids: skillIds(["rust", "ink"]) }] },
    { id: 2, complexity: { type: "Days", value: 20 }, cost: "5000", dependencies: [1], completed: false, status: { Pending: null }, assigned_to: null, assignments: [], requirements: [{ assignment_key: "developer-1", hours: 100, skill_ids: skillIds(["typescript", "react"]) }, { assignment_key: "designer-1", hours: 100, skill_ids: skillIds(["ui/ux"]) }] },
    { id: 3, complexity: { type: "Days", value: 10 }, cost: "2000", dependencies: [], completed: false, status: { Pending: null }, assigned_to: null, assignments: [], requirements: [{ assignment_key: "tester-1", hours: 40, skill_ids: skillIds(["automated testing"]) }] },
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
        team_size: 2,
      },
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: 0,
      paid_amount: 0,
    },
  });

  // --- Project 3: Mobile Wallet (TeamAssigned, in progress) ─────────
  const walletTasks: MockTask[] = [
    { id: 1, complexity: { type: "Days", value: 10 }, cost: "4000", dependencies: [], completed: true, status: { PendingReview: 1005 }, assigned_to: U.dave.address, assignments: [{ assignment_key: "developer-1", hours: 40, skill_ids: skillIds(["typescript"]), account_id: U.dave.address }], requirements: [{ assignment_key: "developer-1", hours: 40, skill_ids: skillIds(["typescript"]) }] },
    { id: 2, complexity: { type: "Days", value: 15 }, cost: "6000", dependencies: [], completed: false, status: { PendingReview: 1010 }, assigned_to: U.dave.address, assignments: [{ assignment_key: "developer-1", hours: 60, skill_ids: skillIds(["react", "ui/ux"]), account_id: U.dave.address }], requirements: [{ assignment_key: "developer-1", hours: 60, skill_ids: skillIds(["react", "ui/ux"]) }] },
    { id: 3, complexity: { type: "Days", value: 20 }, cost: "8000", dependencies: [1], completed: false, status: { Approved: 1003 }, assigned_to: U.eve.address, assignments: [{ assignment_key: "developer-2", hours: 80, skill_ids: skillIds(["rust", "web3"]), account_id: U.eve.address }], requirements: [{ assignment_key: "developer-2", hours: 80, skill_ids: skillIds(["rust", "web3"]) }] },
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
        { account_id: U.dave.address, rating: null },
        { account_id: U.eve.address, rating: null },
      ],
      tasks: walletTasks,
      scope: {
        tasks: walletTasks.map((t) => [t.id, t.complexity, t.cost, t.dependencies]),
        advance_payment_percentage: walletAdvancePct,
        document_hash: "QmSeedHash9876543210fedcba",
        state: "Approved",
        team_size: 2,
      },
      calendar_contract: C.calendar,
      ratings_contract: C.ratings,
      total_cost: walletTotalCost,
      paid_amount: Math.floor(walletTotalCost * walletAdvancePct / 100),
    },
  });

  // --- Project 4: Smart Contract Audit (Completed) ──────────────────
  const auditTasks: MockTask[] = [
    { id: 1, complexity: { type: "Days", value: 10 }, cost: "5000", dependencies: [], completed: true, status: { PendingReview: 1020 }, assigned_to: U.eve.address, assignments: [{ assignment_key: "auditor-1", hours: 40, skill_ids: skillIds(["smart contract auditing"]), account_id: U.eve.address }], requirements: [{ assignment_key: "auditor-1", hours: 40, skill_ids: skillIds(["smart contract auditing"]) }] },
    { id: 2, complexity: { type: "Days", value: 15 }, cost: "7000", dependencies: [1], completed: true, status: { PendingReview: 1025 }, assigned_to: U.eve.address, assignments: [{ assignment_key: "auditor-1", hours: 60, skill_ids: skillIds(["rust", "technical writing"]), account_id: U.eve.address }], requirements: [{ assignment_key: "auditor-1", hours: 60, skill_ids: skillIds(["rust", "technical writing"]) }] },
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
        { account_id: U.dave.address, rating: 85 },
      ],
      tasks: auditTasks,
      scope: {
        tasks: auditTasks.map((t) => [t.id, t.complexity, t.cost, t.dependencies]),
        advance_payment_percentage: 25,
        document_hash: "QmSeedHashAudit123456",
        state: "Approved",
        team_size: 1,
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
