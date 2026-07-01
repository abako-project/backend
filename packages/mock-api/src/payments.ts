import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_ASSET_ID, ledger, parseAmount } from "./ledger.js";

export type PaymentState =
  | "Created"
  | "Released"
  | "PaymentRequested"
  | "Completed"
  | "RefundRequested"
  | "Cancelled"
  | "Refunded"
  | "NeedsReview"
  | "DisputeResolved";

export interface MockPaymentRecord {
  paymentId: string;
  from: string;
  to: string;
  amount: string;
  asset: { type: "Here"; value: number };
  state: PaymentState;
  remark: string | null;
  kind: string | null;
  projectContract: string | null;
  taskId: number | null;
}

interface PaymentRow {
  payment_id: number;
  from_address: string;
  to_address: string;
  asset_id: number;
  amount: string;
  state: PaymentState;
  remark: string | null;
  kind: string | null;
  project_contract: string | null;
  task_id: number | null;
}

interface PaymentInput {
  from: string;
  to: string;
  assetId?: number;
  amount: string | number | bigint;
  remark?: string;
  kind?: string;
  projectContract?: string;
  taskId?: number;
}

function resolveDatabasePath(): string {
  const configured = process.env.MOCK_SQLITE_PATH || "./data/mock-registry.sqlite";
  if (configured === ":memory:") return configured;
  const absolute = resolve(configured);
  mkdirSync(dirname(absolute), { recursive: true });
  return absolute;
}

class Payments {
  private readonly db = new Database(resolveDatabasePath());

  constructor() {
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mock_payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        asset_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        state TEXT NOT NULL,
        remark TEXT,
        kind TEXT,
        project_contract TEXT,
        task_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  createPayment(input: PaymentInput): MockPaymentRecord {
    const amount = parseAmount(input.amount);
    ledger.debit(input.from, input.assetId || DEFAULT_ASSET_ID, amount, "payment.create");
    return this.insert(input, "Created");
  }

  requestPayment(input: PaymentInput): MockPaymentRecord {
    return this.insert(input, "PaymentRequested");
  }

  releasePayment(paymentId: string | number): MockPaymentRecord {
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "Created") throw new Error("Payment is not releasable");
    ledger.credit(payment.to_address, payment.asset_id, payment.amount, "payment.release", String(payment.payment_id));
    this.setState(payment.payment_id, "Released");
    return this.requirePayment(payment.payment_id);
  }

  acceptAndPay(paymentId: string | number): MockPaymentRecord {
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "PaymentRequested") throw new Error("Payment request is not payable");
    ledger.transfer(
      payment.from_address,
      payment.to_address,
      payment.asset_id,
      payment.amount,
      "payment.accept_and_pay",
      String(payment.payment_id),
    );
    this.setState(payment.payment_id, "Completed");
    return this.requirePayment(payment.payment_id);
  }

  requestRefund(paymentId: string | number): MockPaymentRecord {
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "Created") throw new Error("Payment is not refundable");
    this.setState(payment.payment_id, "RefundRequested");
    return this.requirePayment(payment.payment_id);
  }

  cancelPayment(paymentId: string | number): MockPaymentRecord {
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "Created" && payment.state !== "RefundRequested") {
      throw new Error("Payment is not cancellable");
    }
    ledger.credit(payment.from_address, payment.asset_id, payment.amount, "payment.cancel", String(payment.payment_id));
    this.setState(payment.payment_id, payment.state === "RefundRequested" ? "Refunded" : "Cancelled");
    return this.requirePayment(payment.payment_id);
  }

  disputeRefund(paymentId: string | number): MockPaymentRecord {
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "RefundRequested") throw new Error("Payment refund is not disputable");
    this.setState(payment.payment_id, "NeedsReview");
    return this.requirePayment(payment.payment_id);
  }

  resolveDispute(paymentId: string | number, percentBeneficiary: unknown): MockPaymentRecord {
    const percent = Number(percentBeneficiary);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new Error("percentBeneficiary must be an integer from 0 to 100");
    }
    const payment = this.requirePayment(paymentId);
    if (payment.state !== "NeedsReview") throw new Error("Payment is not in review");
    const amount = BigInt(payment.amount);
    const toBeneficiary = amount * BigInt(percent) / 100n;
    const toSender = amount - toBeneficiary;
    if (toBeneficiary > 0n) {
      ledger.credit(payment.to_address, payment.asset_id, toBeneficiary, "payment.resolve_dispute", String(payment.payment_id));
    }
    if (toSender > 0n) {
      ledger.credit(payment.from_address, payment.asset_id, toSender, "payment.resolve_dispute", String(payment.payment_id));
    }
    this.setState(payment.payment_id, "DisputeResolved");
    return this.requirePayment(payment.payment_id);
  }

  getPayment(paymentId: string | number): MockPaymentRecord | null {
    const row = this.db.prepare("SELECT * FROM mock_payments WHERE payment_id = ?").get(String(paymentId)) as PaymentRow | undefined;
    return row ? this.serialize(row) : null;
  }

  private insert(input: PaymentInput, state: PaymentState): MockPaymentRecord {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO mock_payments
        (from_address, to_address, asset_id, amount, state, remark, kind, project_contract, task_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.from,
      input.to,
      input.assetId || DEFAULT_ASSET_ID,
      parseAmount(input.amount).toString(),
      state,
      input.remark || null,
      input.kind || null,
      input.projectContract || null,
      input.taskId || null,
      now,
      now,
    );
    return this.requirePayment(result.lastInsertRowid);
  }

  private requirePayment(paymentId: string | number | bigint): MockPaymentRecord & PaymentRow {
    const row = this.db.prepare("SELECT * FROM mock_payments WHERE payment_id = ?").get(String(paymentId)) as PaymentRow | undefined;
    if (!row) throw new Error("Payment not found");
    return { ...row, ...this.serialize(row) };
  }

  private setState(paymentId: number, state: PaymentState): void {
    this.db.prepare(
      "UPDATE mock_payments SET state = ?, updated_at = ? WHERE payment_id = ?",
    ).run(state, new Date().toISOString(), paymentId);
  }

  private serialize(row: PaymentRow): MockPaymentRecord {
    return {
      paymentId: String(row.payment_id),
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      asset: { type: "Here", value: row.asset_id },
      state: row.state,
      remark: row.remark,
      kind: row.kind,
      projectContract: row.project_contract,
      taskId: row.task_id,
    };
  }
}

export const payments = new Payments();
