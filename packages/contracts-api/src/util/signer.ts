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

const aliceKeyPair = derive("//Alice");
export const alicePolkadotSigner = getPolkadotSigner(
    aliceKeyPair.publicKey,
    "Sr25519",
    aliceKeyPair.sign
);
export const alicePublicAddress = ss58Encode(alicePolkadotSigner.publicKey);

const bobKeyPair = derive("//Bob");
export const bobPolkadotSigner = getPolkadotSigner(
    bobKeyPair.publicKey,
    "Sr25519",
    bobKeyPair.sign
);
export const bobPublicAddress = ss58Encode(bobPolkadotSigner.publicKey);

const charlieKeyPair = derive("//Charlie");
export const charliePolkadotSigner = getPolkadotSigner(
    charlieKeyPair.publicKey,
    "Sr25519",
    charlieKeyPair.sign
);
export const charliePublicAddress = ss58Encode(charliePolkadotSigner.publicKey);

console.log('Alice public address:', alicePublicAddress);
console.log('Bob public address:', bobPublicAddress);
console.log('Charlie public address:', charliePublicAddress);

