// Reference password client for the mock auth flow.
//
// Front-end developers consume this API:
//
//     const client = new PasswordAuthClient("http://localhost:4010");
//     await client.register("alice@example.com", "hunter2");
//     const { token } = await client.login("alice@example.com", "hunter2");
//     await client.changePassword(token, "hunter2", "tr0ub4dor&3");
//
// The keypair derivation (argon2id → ed25519) is hidden inside.
// See ./password.ts for protocol constants and ./password-vectors.ts for
// deterministic test vectors a Rust port can validate against.

import { randomBytes } from "node:crypto";
import {
  bytesToHex,
  canonicalMessage,
  deriveKeyPair,
  signMessage,
  MOCK_CHAIN_ID,
} from "./password.js";

interface ChainHead {
  blockNumber: number;
  blockHash: string;
}

interface RegisterResponse {
  ok: boolean;
  address: string;
  blockNumber: number;
  blockHash: string;
}

interface LoginResponse {
  ok: boolean;
  token: string;
  publicKey: string;
  blockNumber: number;
}

interface ChangeResponse {
  ok: boolean;
}

/** A mock-friendly HTTP error so callers can branch on status. */
export class PasswordAuthError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = "PasswordAuthError";
  }
}

export class PasswordAuthClient {
  constructor(
    private readonly baseUrl: string,
    private readonly chainId: string = MOCK_CHAIN_ID,
  ) {}

  /** Hex-encoded random 16 bytes — overridable by tests for determinism. */
  protected newNonce(): string {
    return bytesToHex(randomBytes(16));
  }

  /** Recent chain head, used as the freshness challenge. */
  async chainHead(): Promise<ChainHead> {
    const r = await fetch(`${this.baseUrl}/api/chain-head`);
    if (!r.ok) throw new PasswordAuthError(r.status, await r.text(), "chain-head failed");
    return await r.json() as ChainHead;
  }

  async register(userId: string, password: string, address?: string): Promise<RegisterResponse> {
    const { privKey, pubKey } = await deriveKeyPair(userId, password, this.chainId);
    const head = await this.chainHead();
    const clientNonce = this.newNonce();
    const message = canonicalMessage({
      label: "register",
      userId,
      blockHash: head.blockHash,
      clientNonce,
      extra: bytesToHex(pubKey),
    });
    const signature = signMessage(privKey, message);

    return await this.post<RegisterResponse>("/api/password-register", {
      userId,
      pubKey: bytesToHex(pubKey),
      blockHash: head.blockHash,
      clientNonce,
      signature: bytesToHex(signature),
      ...(address ? { address } : {}),
    });
  }

  async login(userId: string, password: string): Promise<LoginResponse> {
    const { privKey } = await deriveKeyPair(userId, password, this.chainId);
    const head = await this.chainHead();
    const clientNonce = this.newNonce();
    const message = canonicalMessage({
      label: "connect",
      userId,
      blockHash: head.blockHash,
      clientNonce,
    });
    const signature = signMessage(privKey, message);

    return await this.post<LoginResponse>("/api/password-connect", {
      userId,
      blockHash: head.blockHash,
      clientNonce,
      signature: bytesToHex(signature),
    });
  }

  async changePassword(
    token: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangeResponse> {
    const oldKp = await deriveKeyPair(userId, currentPassword, this.chainId);
    const newKp = await deriveKeyPair(userId, newPassword, this.chainId);
    const head = await this.chainHead();
    const clientNonce = this.newNonce();
    const newPubKeyHex = bytesToHex(newKp.pubKey);

    // Both signatures bind to the same (blockHash, clientNonce, newPubKey) so
    // an attacker can't substitute either signature independently.
    const oldMessage = canonicalMessage({
      label: "change-password-old",
      userId,
      blockHash: head.blockHash,
      clientNonce,
      extra: newPubKeyHex,
    });
    const newMessage = canonicalMessage({
      label: "change-password-new",
      userId,
      blockHash: head.blockHash,
      clientNonce,
      extra: newPubKeyHex,
    });

    return await this.post<ChangeResponse>(
      "/api/change-password",
      {
        blockHash: head.blockHash,
        clientNonce,
        oldSignature: bytesToHex(signMessage(oldKp.privKey, oldMessage)),
        newPubKey: newPubKeyHex,
        newSignature: bytesToHex(signMessage(newKp.privKey, newMessage)),
      },
      token,
    );
  }

  private async post<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    const r = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* parsed stays null */ }
    if (!r.ok) {
      throw new PasswordAuthError(r.status, parsed ?? text, parsed?.error ?? `${path} failed`);
    }
    return parsed as T;
  }
}
