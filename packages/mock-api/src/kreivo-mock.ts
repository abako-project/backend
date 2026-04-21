// Mock Kreivo chain JSON-RPC endpoint.
// Returns fake but SCALE-decodable responses for balance queries.
import { Router } from "express";

export const kreivoRouter = Router();

// Pre-built SCALE-encoded mock responses:

// System.Account: 80 bytes
// nonce(4) + consumers(4) + providers(4) + sufficients(4) + free(16) + reserved(16) + frozen(16) + flags(16)
// free = 100 KSM = 100_000_000_000_000 planck (12 decimals)
const SYSTEM_ACCOUNT_HEX =
  "0x" +
  "01000000" + // nonce = 1
  "01000000" + // consumers = 1
  "01000000" + // providers = 1
  "00000000" + // sufficients = 0
  "00407a10f35a00000000000000000000" + // free = 100 KSM
  "00000000000000000000000000000000" + // reserved = 0
  "00000000000000000000000000000000" + // frozen = 0
  "00000000000000000000000000000000";  // flags = 0

// Assets.Account: balance(16) + status(1) + reason(1)
// balance = 50_000 DUSD = 50_000_000 planck (3 decimals)
const ASSETS_ACCOUNT_HEX =
  "0x" +
  "800ffa0200000000000000000000000000" + // balance = 50_000_000
  "00";                                    // status = Liquid

// Storage key prefixes to detect which query is being made
const SYSTEM_ACCOUNT_PREFIX = "26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9";
const ASSETS_ACCOUNT_PREFIX = "682a59d51ab9e48a8c8cc418ff9708d2b99d880ec681799c0cf30e8886371da9";

let blockNumber = 5000;

function nextBlockHex(): string {
  return "0x" + (++blockNumber).toString(16).padStart(8, "0");
}

function randomHash(): string {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function handleMethod(method: string, params: any[]): any {
  switch (method) {
    case "chain_getHeader":
      return {
        parentHash: randomHash(),
        number: nextBlockHex(),
        stateRoot: randomHash(),
        extrinsicsRoot: randomHash(),
        digest: { logs: [] },
      };

    case "chain_getFinalizedHead":
      return randomHash();

    case "state_getStorage": {
      const key = (params[0] || "") as string;
      const keyLower = key.toLowerCase().replace(/^0x/, "");

      if (keyLower.startsWith(SYSTEM_ACCOUNT_PREFIX)) {
        return SYSTEM_ACCOUNT_HEX;
      }
      if (keyLower.startsWith(ASSETS_ACCOUNT_PREFIX)) {
        return ASSETS_ACCOUNT_HEX;
      }
      // Unknown storage key — return null (not found)
      return null;
    }

    default:
      return null;
  }
}

kreivoRouter.post("/", (req, res) => {
  const body = req.body;

  // Batch request (array of JSON-RPC calls)
  if (Array.isArray(body)) {
    const results = body.map((call: any) => ({
      jsonrpc: "2.0",
      id: call.id,
      result: handleMethod(call.method, call.params || []),
    }));
    res.json(results);
    return;
  }

  // Single request
  res.json({
    jsonrpc: "2.0",
    id: body.id,
    result: handleMethod(body.method, body.params || []),
  });
});
