// In-memory state for mock services
// Data structures mirror the ink! smart contracts in ../../../contracts/

export interface MockUser {
  userId: string;
  address: string;
  credentialId: string;
  isMember: boolean;
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
}

// Mirrors contracts/projects TaskStatus
export type MockTaskStatus =
  | { Pending: null }
  | { Approved: number }   // block number
  | { Rejected: number }
  | { PendingReview: number };

// Mirrors contracts/projects TeamMember
export interface MockTeamMember {
  account_id: string;
  role: string;           // "Designer" | "Developer" | "Tester"
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
}

export interface MockContract {
  address: string;
  type: "projects" | "calendar" | "ratings";
  inkVersion: string;
  projectInfo?: MockProjectInfo;
  calendarInfo?: {
    workers: Map<string, number>; // address -> availability hours
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

  nextBlockNumber(): number {
    return ++this.blockNumber;
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

  getAvailableWorkers(calendarAddress: string | null, minHours: number): Array<{ worker: string; hours: number }> {
    const cal = this.getCalendarContract(calendarAddress);
    if (!cal?.calendarInfo) return [];
    const result: Array<{ worker: string; hours: number }> = [];
    for (const [addr, hours] of cal.calendarInfo.workers.entries()) {
      if (hours >= minHours) result.push({ worker: addr, hours });
    }
    // Sort by hours descending (same as real contract)
    result.sort((a, b) => b.hours - a.hours);
    return result;
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
        workers: new Map(),
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
