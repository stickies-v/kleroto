import { readFileSync, writeFileSync } from 'node:fs';
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { decodeFragment, encodeFragment, toCanonicalText, type Draw } from '../src/draw';
import { computeResult } from '../src/result';

const VECTORS_PATH = new URL('./vectors.json', import.meta.url);

const BLOCK_960000 = '000000000000000000001268aab06132c2dd203f77b6020462cd177942d6959d';
const DRAND_ROUND_1000000 = 'b22aad4794f7451896f7a371aa46106fd84d919f3f569acd5b2fddf1d1440af3';

const INPUTS: { name: string; draw: Draw; randomness: string }[] = [
  {
    name: 'select one of five names',
    draw: {
      title: 'Who buys the cake?',
      select: 1,
      source: { kind: 'bitcoin', height: 960000 },
      participants: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
    },
    randomness: BLOCK_960000,
  },
  {
    name: 'unicode participants with drand',
    draw: {
      title: 'Prijzen 🎁 für alle',
      select: 3,
      source: { kind: 'drand-quicknet', round: 1000000 },
      participants: ['Zoë', 'José', '李雷', 'Мария', 'Ørjan', '😀 Smiley', 'Nguyễn Văn A'],
    },
    randomness: DRAND_ROUND_1000000,
  },
  {
    name: 'select everyone',
    draw: {
      title: 'Speaking order',
      select: 10,
      source: { kind: 'bitcoin', height: 960000 },
      participants: Array.from({ length: 10 }, (_, i) => `Speaker ${i + 1}`),
    },
    randomness: BLOCK_960000,
  },
  {
    name: 'single participant',
    draw: { title: 'Only one', select: 1, source: { kind: 'bitcoin', height: 1 }, participants: ['Solo'] },
    randomness: '00'.repeat(32),
  },
  {
    name: 'duplicate participants',
    draw: {
      title: 'Two tickets for Bob',
      select: 2,
      source: { kind: 'drand-quicknet', round: 42 },
      participants: ['Alice', 'Bob', 'Bob', 'Carol'],
    },
    randomness: 'ff'.repeat(32),
  },
  {
    name: 'one thousand participants',
    draw: {
      title: 'Raffle',
      select: 25,
      source: { kind: 'bitcoin', height: 999999 },
      participants: Array.from({ length: 1000 }, (_, i) => `Ticket ${i + 1}`),
    },
    randomness: BLOCK_960000,
  },
];

function buildVectors() {
  return {
    draws: INPUTS.map(({ name, draw, randomness }) => {
      const result = computeResult(draw, hexToBytes(randomness));
      return {
        name,
        fragment: encodeFragment(draw),
        canonical: toCanonicalText(draw),
        randomness,
        fingerprint: result.fingerprint,
        selected: result.selected,
        selectedTickets: result.selected.map((index) => result.tickets[index]),
      };
    }),
  };
}

if (process.env.UPDATE_VECTORS) {
  writeFileSync(VECTORS_PATH, JSON.stringify(buildVectors(), null, 2) + '\n');
}

describe('test vectors', () => {
  const stored = JSON.parse(readFileSync(VECTORS_PATH, 'utf8'));

  it('match the current implementation', () => {
    expect(buildVectors()).toEqual(stored);
  });

  it('round-trip through the link fragment', () => {
    for (const vector of stored.draws) {
      expect(toCanonicalText(decodeFragment(vector.fragment))).toBe(vector.canonical);
    }
  });
});
