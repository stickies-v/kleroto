import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hexToBytes } from '@noble/hashes/utils.js';
import { afterAll, describe, expect, it } from 'vitest';
import { decodeFragment } from '../src/draw';
import { manualSteps, type ManualStep } from '../src/manual';
import { computeResult } from '../src/result';

interface Vector {
  name: string;
  fragment: string;
  canonical: string;
  randomness: string;
}

const vectors: { draws: Vector[] } = JSON.parse(readFileSync(new URL('./vectors.json', import.meta.url), 'utf8'));
const workDir = mkdtempSync(join(tmpdir(), 'kleroto-manual-'));

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

function run(step: ManualStep): string {
  return execFileSync('sh', ['-c', step.command], { cwd: workDir, encoding: 'utf8' }).trim();
}

describe('command-line instructions', () => {
  for (const vector of vectors.draws) {
    it(`reproduce the result for ${vector.name}`, { timeout: 30_000 }, () => {
      const draw = decodeFragment(vector.fragment);
      const result = computeResult(draw, hexToBytes(vector.randomness));
      const [save, fingerprint, fromLink, , pick] = manualSteps(draw, `https://example.org/#${vector.fragment}`, result);

      run(save);
      expect(readFileSync(join(workDir, 'draw.txt'), 'utf8')).toBe(vector.canonical);
      expect(run(fingerprint).split(' ')[0]).toBe(fingerprint.expected);
      expect(run(fromLink).split(' ')[0]).toBe(fromLink.expected);
      expect(run(pick)).toBe(pick.expected);
    });
  }

  it('get the real random number with curl', { timeout: 30_000 }, () => {
    const realSources = vectors.draws.filter((vector) =>
      ['select one of five names', 'unicode participants with drand'].includes(vector.name),
    );
    for (const vector of realSources) {
      const draw = decodeFragment(vector.fragment);
      const step = manualSteps(draw, 'https://example.org/', computeResult(draw, hexToBytes(vector.randomness)))[3];
      expect(step.command).not.toContain(';');
      expect(run(step)).toContain(step.expected);
    }
  });

  it('uses placeholders before the draw', () => {
    const draw = decodeFragment(vectors.draws[0].fragment);
    const steps = manualSteps(draw, 'https://example.org/', null);
    expect(steps[4].command).toContain('<random number>');
    expect(steps[4].expected).toBeUndefined();
  });
});
