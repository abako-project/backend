// In-memory state for mock services

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

export interface MockContract {
  address: string;
  type: "projects" | "calendar" | "ratings";
  inkVersion: string;
  projectInfo?: {
    name: string;
    client: string;
    coordinator: string | null;
    state: string;
    team: any[];
    tasks: any[];
    scope: any;
  };
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
        coordinator: null,
        state: "Created",
        team: [],
        tasks: [],
        scope: null,
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
