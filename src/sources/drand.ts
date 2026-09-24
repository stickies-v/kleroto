import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { SourceError } from './http';

export const QUICKNET = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  publicKey:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  genesis: 1692803367,
  period: 3,
};

const APIS = ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com'];
const DST = 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_';
const HTTP_TOO_EARLY = 425;

export function roundTime(round: number): number {
  return QUICKNET.genesis + (round - 1) * QUICKNET.period;
}

export function firstRoundAtOrAfter(timeSeconds: number): number {
  return Math.ceil((timeSeconds - QUICKNET.genesis) / QUICKNET.period) + 1;
}

export function verifyBeacon(round: number, signatureHex: string): Uint8Array {
  const signature = hexToBytes(signatureHex);
  const roundBytes = new Uint8Array(8);
  new DataView(roundBytes.buffer).setBigUint64(0, BigInt(round));
  const scheme = bls12_381.shortSignatures;
  const message = scheme.hash(sha256(roundBytes), DST);
  if (!scheme.verify(signature, message, hexToBytes(QUICKNET.publicKey))) {
    throw new SourceError(`The drand signature for round ${round} is not valid.`);
  }
  return sha256(signature);
}

export async function fetchRandomness(round: number): Promise<Uint8Array | null> {
  for (const api of APIS) {
    try {
      const response = await fetch(`${api}/${QUICKNET.chainHash}/public/${round}`, { cache: 'no-store' });
      if (response.status === HTTP_TOO_EARLY) return null;
      if (!response.ok) continue;
      const body = (await response.json()) as { round: number; signature: string };
      if (body.round === round) return verifyBeacon(round, body.signature);
    } catch (err) {
      console.warn(`drand API ${api} failed`, err);
    }
  }
  throw new SourceError('Cannot reach the drand APIs.');
}
