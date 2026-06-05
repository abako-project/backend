// In-memory state for mock services
// Data structures mirror the ink! smart contracts in ../../../contracts/

import { createHash } from "node:crypto";

export interface MockUser {
  userId: string;
  address: string;
  credentialId: string;
  isMember: boolean;
  /**
   * Password-derived ed25519 public key, hex-encoded (32 bytes).
   * Set when the user registers via email+password. The matching private key
   * lives only on the user's device, derived deterministically from the
   * password via argon2id (see password.ts).
   */
  pubKey?: string;
}

export interface MockPayment {
  paymentId: string;
  from: string;
  to: string;
  amount: string;
  asset: number;
  state: string;
}

export interface MockMember {
  address: string;
  membershipId: number;
  communityId: number;
}

// Mirrors contracts/projects Task
export interface MockTask {
  id: number;
  complexity: { type: string; value: number }; // e.g. { type: "Days", value: 15 }
  cost: string;
  dependencies: number[];
  completed: boolean;
  status: MockTaskStatus;
  assigned_to: string | null;
  requirements: MockRequirement[];
  assignments: MockAssignment[];
}

export interface MockRequirement {
  assignment_key: string;
  hours: number;
  skill_ids: number[];
}

export interface MockAssignment extends MockRequirement {
  account_id: string;
}

// Mirrors contracts/projects TaskStatus
export type MockTaskStatus =
  | { Pending: null }
  | { Approved: number }   // block number
  | { Active: number }
  | { Rejected: number }
  | { PendingReview: number };

// Mirrors contracts/projects TeamMember
export interface MockTeamMember {
  account_id: string;
  rating: number | null;  // 0-100, null until project completed
}

export interface MockProjectInfo {
  name: string;
  client: string;
  dao_address: string;
  coordinator: string | null;
  state: string;       // Created | CoordinatorAssigned | ScopePendingClientApproval | ScopeAccepted | TeamAssigned | Completed
  team: MockTeamMember[];
  tasks: MockTask[];
  scope: MockScope | null;
  calendar_contract: string | null;
  ratings_contract: string | null;
  total_cost: number;
  paid_amount: number;
}

// Mirrors contracts/projects ProjectScope
export interface MockScope {
  tasks: Array<[number, any, string, number[]]>;  // [id, complexity, cost, deps]
  advance_payment_percentage: number;
  document_hash: string;
  state: string;
  team_size: number;
}

export interface MockContract {
  address: string;
  type: "projects" | "calendar" | "ratings";
  inkVersion: string;
  projectInfo?: MockProjectInfo;
  calendarInfo?: {
    workers: Set<string>;
  };
  ratingsInfo?: {
    ratings: Array<{ target: string; rating: number; category: string }>;
    workers: string[];
  };
}

class Store {
  users = new Map<string, MockUser>();
  payments = new Map<string, MockPayment>();
  members = new Map<string, MockMember[]>(); // communityId -> members
  contracts = new Map<string, MockContract>();

  private paymentCounter = 1;
  private membershipCounter = 1;
  private contractCounter = 1;
  private blockNumber = 1000;
  private blockHashes = new Map<number, string>();

  /** Deterministic block hash from a block number. */
  private hashFor(n: number): string {
    return "0x" + createHash("sha256").update(`mock-block:${n}`).digest("hex");
  }

  nextBlockNumber(): number {
    this.blockNumber += 1;
    this.blockHashes.set(this.blockNumber, this.hashFor(this.blockNumber));
    // Bound memory: keep only the recent window.
    const cutoff = this.blockNumber - 200;
    for (const k of this.blockHashes.keys()) {
      if (k < cutoff) this.blockHashes.delete(k);
    }
    return this.blockNumber;
  }

  /** Hash of the current head — what /password-connect submits as the challenge. */
  currentBlockHash(): string {
    if (!this.blockHashes.has(this.blockNumber)) {
      this.blockHashes.set(this.blockNumber, this.hashFor(this.blockNumber));
    }
    return this.blockHashes.get(this.blockNumber)!;
  }

  /** Is this hash within the ±windowSize-block freshness window? */
  isRecentBlockHash(hash: string, windowSize: number): boolean {
    const lo = Math.max(1, this.blockNumber - windowSize);
    const hi = this.blockNumber + windowSize;
    for (let n = lo; n <= hi; n++) {
      if (!this.blockHashes.has(n)) this.blockHashes.set(n, this.hashFor(n));
      if (this.blockHashes.get(n) === hash) return true;
    }
    return false;
  }

  generateAddress(): string {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let addr = "5";
    for (let i = 0; i < 47; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr;
  }

  generateTxHash(): string {
    return (
      "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")
    );
  }

  // User methods
  getOrCreateUser(userId: string): MockUser {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        userId,
        address: this.generateAddress(),
        credentialId: `cred_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        isMember: false,
      };
      this.users.set(userId, user);
    }
    return user;
  }

  getUserByAddress(address: string): MockUser | undefined {
    for (const user of this.users.values()) {
      if (user.address === address) return user;
    }
    return undefined;
  }

  // Payment methods
  createPayment(from: string, to: string, amount: string, assetId: number): MockPayment {
    const payment: MockPayment = {
      paymentId: String(this.paymentCounter++),
      from,
      to,
      amount,
      asset: assetId,
      state: "Created",
    };
    this.payments.set(payment.paymentId, payment);
    return payment;
  }

  // Member methods
  addMember(communityId: string, address: string): MockMember {
    const members = this.members.get(communityId) || [];
    const existing = members.find((m) => m.address === address);
    if (existing) return existing;

    const member: MockMember = {
      address,
      membershipId: this.membershipCounter++,
      communityId: parseInt(communityId),
    };
    members.push(member);
    this.members.set(communityId, members);
    return member;
  }

  // Calendar helpers – used by project contract mock to find available workers
  getCalendarContract(address: string | null): MockContract | undefined {
    if (!address) {
      // Find the first calendar contract
      for (const c of this.contracts.values()) {
        if (c.type === "calendar") return c;
      }
      return undefined;
    }
    const c = this.contracts.get(address);
    return c?.type === "calendar" ? c : undefined;
  }

  getRegisteredWorkers(calendarAddress: string | null): string[] {
    const cal = this.getCalendarContract(calendarAddress);
    if (!cal?.calendarInfo) return [];
    return [...cal.calendarInfo.workers];
  }

  // Contract methods
  deployContract(
    type: "projects" | "calendar" | "ratings",
    inkVersion: string,
    params?: any
  ): MockContract {
    const address = this.generateAddress();
    const contract: MockContract = {
      address,
      type,
      inkVersion,
    };

    if (type === "projects") {
      contract.projectInfo = {
        name: params?.name || "Untitled",
        client: params?.client || "",
        dao_address: params?.dao_address || "",
        coordinator: null,
        state: "Created",
        team: [],
        tasks: [],
        scope: null,
        calendar_contract: params?.calendar_contract || null,
        ratings_contract: params?.ratings_contract || null,
        total_cost: 0,
        paid_amount: 0,
      };
    } else if (type === "calendar") {
      contract.calendarInfo = {
        workers: new Set(),
      };
    } else if (type === "ratings") {
      contract.ratingsInfo = {
        ratings: [],
        workers: [],
      };
    }

    this.contracts.set(address, contract);
    return contract;
  }
}

export const store = new Store();
