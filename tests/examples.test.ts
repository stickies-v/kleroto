import { describe, expect, it } from 'vitest';
import { cleanText, validate } from '../src/draw';
import { EXAMPLES } from '../src/examples';

describe('placeholder examples', () => {
  it.each(EXAMPLES.map((example) => [example.title, example]))('%s is a valid draw', (_, example) => {
    expect(example.participants.map(cleanText)).toEqual(example.participants);
    expect(() =>
      validate({ title: example.title, select: 1, source: { kind: 'bitcoin', height: 1 }, participants: example.participants }),
    ).not.toThrow();
  });
});
