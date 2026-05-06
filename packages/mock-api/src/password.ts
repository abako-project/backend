// Password-as-keypair primitives shared by client and server.
//
// Design (matches crates/pass in virto-sdk):
//   1. salt    = blake2b(PROTOCOL_TAG || chainId || userId)         deterministic
//   2. seed    = argon2id(password, salt, OWASP_params)             32 bytes
//   3. keypair = ed25519.from_seed(seed)                            (priv, pub)
//   4. The federate-server / chain stores only the pubKey.
//   5. To authenticate, the client signs a block-hash challenge with privKey;
//      the verifier checks the signature against the stored pubKey.
//
// Plain password never leaves the client. On-chain leakage of pubKey reveals
// nothing about the password — an attacker has to run argon2id per candidate
// and derive ed25519, which makes brute-force impractical at OWASP params.
//
// Extending to sr25519 (Substrate's default) is a one-line swap of the curve
// import; ed25519 is used here to keep the mock dependency-light.

import { argon2idAsync } from "@noble/hashes/argon2.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { utf8ToBytes, hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import { ed25519 } from "@noble/curves/ed25519.js";

export { utf8ToBytes, hexToBytes, bytesToHex };

/** Bump and add a domain separator if the derivation below changes. */
export const PROTOCOL_TAG = "kunveno-pwd-v1" as const;

/** Mock chain id. The real implementation reads it from chain spec. */
export const MOCK_CHAIN_ID = "kreivo-mock" as const;

/**
 * Argon2id parameters — fixed globally as part of the protocol so neither
 * client nor server stores them per user. OWASP-2024 minimum.
 */
export const ARGON2_PARAMS = { t: 2, m: 19456, p: 1, dkLen: 32 } as const;

/** ±N blocks tolerated for the freshness challenge. */
export const BLOCKHASH_WINDOW = 60;

/** Deterministic 16-byte salt: blake2b(PROTOCOL_TAG ‖ chainId ‖ userId). */
export function deriveSalt(userId: string, chainId: string = MOCK_CHAIN_ID): Uint8Array {
  return blake2b(utf8ToBytes(`${PROTOCOL_TAG}|${chainId}|${userId}`), { dkLen: 16 });
}

/** Stretch a password into a 32-byte ed25519 seed. */
export async function deriveSeed(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return argon2idAsync(utf8ToBytes(password), salt, ARGON2_PARAMS);
}

export interface KeyPair {
  privKey: Uint8Array;  // 32 bytes (the seed)
  pubKey: Uint8Array;   // 32 bytes
}

/** Derive an ed25519 keypair from a password. */
export async function deriveKeyPair(
  userId: string,
  password: string,
  chainId: string = MOCK_CHAIN_ID
): Promise<KeyPair> {
  const salt = deriveSalt(userId, chainId);
  const privKey = await deriveSeed(password, salt);
  const pubKey = ed25519.getPublicKey(privKey);
  return { privKey, pubKey };
}

/**
 * Canonical message that gets signed. Domain-separated by `label` so a
 * register signature can never be replayed as a connect signature, and so on.
 *
 * Format: PROTOCOL_TAG | label | userId | blockHash | clientNonce | extra
 */
export function canonicalMessage(args: {
  label: string;
  userId: string;
  blockHash: string;
  clientNonce: string;
  extra?: string;
}): Uint8Array {
  const parts = [PROTOCOL_TAG, args.label, args.userId, args.blockHash, args.clientNonce, args.extra ?? ""];
  return utf8ToBytes(parts.join("|"));
}

export function signMessage(privKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, privKey);
}

export function verifySignature(pubKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, pubKey);
  } catch {
    return false;
  }
}
