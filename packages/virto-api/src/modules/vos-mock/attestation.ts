import type {
    AttestationMeta,
    BlockNumber,
    Compact,
    Attestation as TAttestation,
  } from "./types";
  
  import { u8aToHex } from "@polkadot/util";
  
  export class Attestation {
    meta: AttestationMeta<Compact<BlockNumber>>;
    authenticatorData: `0x${string}`;
    clientData: `0x${string}`;
    publicKey: `0x${string}`;
  
    constructor(tAttestation: TAttestation<Compact<BlockNumber>>) {
      if (!tAttestation) {
        throw new Error('Attestation data is required');
      }
      
      if (!tAttestation.meta) {
        throw new Error('Attestation metadata is required');
      }
      
      // Validate essential fields are present
      if (!tAttestation.authenticatorData || !tAttestation.clientData || !tAttestation.publicKey) {
        throw new Error('Attestation requires authenticatorData, clientData, and publicKey');
      }
      
      this.meta = tAttestation.meta;
      this.authenticatorData = u8aToHex(tAttestation.authenticatorData);
      this.clientData = u8aToHex(tAttestation.clientData);
      this.publicKey = u8aToHex(tAttestation.publicKey);
    }
}