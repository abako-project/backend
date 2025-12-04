import {
    DEV_PHRASE,
    entropyToMiniSecret,
    KeyPair,
    mnemonicToEntropy,
    ss58Encode,
} from "@polkadot-labs/hdkd-helpers";

import { getPolkadotSigner } from "polkadot-api/signer";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

const PHRASE = process.env.PHRASE || ""

const entropy = mnemonicToEntropy(PHRASE || DEV_PHRASE);
const seed = entropyToMiniSecret(entropy);
const derive = sr25519CreateDerive(seed);

let publicKey: Uint8Array;
let keyPair: KeyPair;

if (process.env.DERIVE_PATH) {
    keyPair = derive(process.env.DERIVE_PATH);
    publicKey = keyPair.publicKey;
} else {
    keyPair = derive("");
    publicKey = keyPair.publicKey;
}

export const adminPolkadotSigner = getPolkadotSigner(
    publicKey,
    "Sr25519",
    keyPair.sign
);
export const adminPublicAddress = ss58Encode(adminPolkadotSigner.publicKey);
