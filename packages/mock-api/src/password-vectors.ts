// Deterministic test vectors for the password-as-keypair flow.
// Any compliant implementation (e.g. a Rust port in crates/pass) must
// reproduce these byte-for-byte — ed25519 signatures are deterministic
// (RFC 8032), so the vectors below are stable across languages.
//
// Run: tsx packages/mock-api/src/password-vectors.ts

import {
  bytesToHex,
  canonicalMessage,
  deriveSalt,
  deriveSeed,
  signMessage,
  ARGON2_PARAMS,
  MOCK_CHAIN_ID,
  PROTOCOL_TAG,
} from "./password.js";
import { ed25519 } from "@noble/curves/ed25519.js";

async function main() {
  const userId = "alice@example.com";
  const password = "correct horse battery staple";
  const blockHash = "0x" + "11".repeat(32);
  const clientNonce = "deadbeefcafef00ddeadbeefcafef00d";

  const salt = deriveSalt(userId);
  const privKey = await deriveSeed(password, salt);
  const pubKey = ed25519.getPublicKey(privKey);

  const registerMsg = canonicalMessage({
    label: "register", userId, blockHash, clientNonce, extra: bytesToHex(pubKey),
  });
  const connectMsg = canonicalMessage({
    label: "connect", userId, blockHash, clientNonce,
  });
  const registerSig = signMessage(privKey, registerMsg);
  const connectSig = signMessage(privKey, connectMsg);

  console.log(JSON.stringify({
    protocolTag: PROTOCOL_TAG,
    chainId: MOCK_CHAIN_ID,
    argon2Params: ARGON2_PARAMS,
    curve: "ed25519",
    inputs: { userId, password, blockHash, clientNonce },
    derived: {
      salt: bytesToHex(salt),
      privKey: bytesToHex(privKey),
      pubKey: bytesToHex(pubKey),
    },
    register: {
      message: new TextDecoder().decode(registerMsg),
      signature: bytesToHex(registerSig),
    },
    connect: {
      message: new TextDecoder().decode(connectMsg),
      signature: bytesToHex(connectSig),
    },
  }, null, 2));
}

main();
