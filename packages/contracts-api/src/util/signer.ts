import {
    DEV_PHRASE,
    entropyToMiniSecret,
    KeyPair,
    mnemonicToEntropy,
    ss58Encode,
} from "@polkadot-labs/hdkd-helpers";

import { getPolkadotSigner } from "polkadot-api/signer";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

const PHRASE= process.env.PHRASE || ""
const DERIVE_PATH = process.env.DERIVE_PATH || "//Alice";

const entropy = mnemonicToEntropy(PHRASE || DEV_PHRASE);
const seed = entropyToMiniSecret(entropy);
const derive = sr25519CreateDerive(seed);


let publicKey: Uint8Array;
let keyPair: KeyPair;

if (DERIVE_PATH) {
    keyPair = derive(DERIVE_PATH);
    publicKey = keyPair.publicKey;
} else {
    keyPair = derive("");
    publicKey = keyPair.publicKey;
}

// Example usage for generating a sr25519 keypair with hard derivation

export const polkadotSigner = getPolkadotSigner(
    publicKey,
    "Sr25519",
    keyPair.sign
);
export const publicAddress = ss58Encode(polkadotSigner.publicKey);
