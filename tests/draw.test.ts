import { describe, expect, it } from 'vitest';
import {
  DrawFormatError,
  cleanText,
  decodeFragment,
  encodeFragment,
  parseCanonicalText,
  toCanonicalText,
  type Draw,
} from '../src/draw';

const DRAW: Draw = {
  title: 'Test',
  select: 2,
  source: { kind: 'bitcoin', height: 900000 },
  participants: ['Alice', 'Bob', 'Carol'],
};

const CANONICAL = 'kleroto v1\ntitle: Test\nselect: 2\nsource: bitcoin 900000\nparticipants: 3\nAlice\nBob\nCarol\n';

describe('canonical text', () => {
  it('has the documented format', () => {
    expect(toCanonicalText(DRAW)).toBe(CANONICAL);
  });

  it('parses back to the same draw', () => {
    expect(parseCanonicalText(CANONICAL)).toEqual(DRAW);
  });

  it.each([
    ['leading zero', CANONICAL.replace('select: 2', 'select: 02')],
    ['missing final newline', CANONICAL.slice(0, -1)],
    ['extra participant', CANONICAL + 'Dave\n'],
    ['unknown source', CANONICAL.replace('bitcoin', 'ethereum')],
    ['select more than participants', CANONICAL.replace('select: 2', 'select: 4')],
    ['empty participant', CANONICAL.replace('Bob', '')],
    ['participant with trailing space', CANONICAL.replace('Bob', 'Bob ')],
    ['tab in participant', CANONICAL.replace('Bob', 'B\tob')],
    ['wrong header', CANONICAL.replace('v1', 'v2')],
  ])('rejects %s', (_, text) => {
    expect(() => parseCanonicalText(text)).toThrow(DrawFormatError);
  });
});

describe('link fragment', () => {
  it('round-trips', () => {
    expect(decodeFragment(encodeFragment(DRAW))).toEqual(DRAW);
  });

  it('uses only URL-safe characters', () => {
    expect(encodeFragment(DRAW)).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  });

  it('rejects a cut-off link', () => {
    const fragment = encodeFragment(DRAW);
    expect(() => decodeFragment(fragment.slice(0, -5))).toThrow(DrawFormatError);
  });

  it('rejects an unknown version', () => {
    expect(() => decodeFragment('v9.abc')).toThrow(DrawFormatError);
  });
});

describe('cleanText', () => {
  it('trims and collapses white space', () => {
    expect(cleanText('  Mary \t Ann  ')).toBe('Mary Ann');
  });

  it('normalizes to NFC', () => {
    expect(cleanText('Zoë')).toBe('Zoë');
  });
});
