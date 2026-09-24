import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { fingerprint, type Draw } from './draw';

export interface DrawResult {
  fingerprint: string;
  randomness: string;
  tickets: string[];
  selected: number[];
}

export function computeResult(draw: Draw, randomness: Uint8Array): DrawResult {
  const drawFingerprint = fingerprint(draw);
  const randomnessHex = bytesToHex(randomness);
  const encoder = new TextEncoder();
  const tickets = draw.participants.map((_, i) =>
    bytesToHex(sha256(encoder.encode(`${drawFingerprint} ${randomnessHex} ${i + 1}`))),
  );
  const byTicket = (a: number, b: number) => (tickets[a] < tickets[b] ? -1 : tickets[a] > tickets[b] ? 1 : a - b);
  const selected = tickets.map((_, i) => i).sort(byTicket).slice(0, draw.select);
  return { fingerprint: drawFingerprint, randomness: randomnessHex, tickets, selected };
}
