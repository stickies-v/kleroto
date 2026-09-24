import { describe, expect, it } from 'vitest';
import { hitUrl, mayCount } from '../src/analytics';

describe('analytics', () => {
  it('sends only the fixed fields', () => {
    const url = new URL(
      hitUrl({ path: '/draw', title: 'Draw page' }, { referrer: 'https://example.org/', screenWidth: 390, bot: false }),
    );
    expect(url.origin + url.pathname).toBe('https://kleroto.goatcounter.com/count');
    expect([...url.searchParams.keys()].sort()).toEqual(['p', 'r', 'rnd', 's', 't']);
    expect(url.searchParams.get('p')).toBe('/draw');
    expect(url.searchParams.get('t')).toBe('Draw page');
    expect(url.hash).toBe('');
  });

  it('marks events and bots', () => {
    const url = new URL(
      hitUrl({ path: 'draw-created-drand', title: 'Draw created', event: true }, { referrer: '', screenWidth: 1, bot: true }),
    );
    expect(url.searchParams.get('e')).toBe('true');
    expect(url.searchParams.get('b')).toBe('153');
    expect(url.searchParams.has('r')).toBe(false);
  });

  it('does not count local visits or visitors who opt out', () => {
    expect(mayCount('kleroto.xyz', false)).toBe(true);
    expect(mayCount('kleroto.xyz', true)).toBe(false);
    for (const host of ['localhost', '127.0.0.1', '192.168.1.20', '10.0.0.5', '172.16.3.4', '[::1]']) {
      expect(mayCount(host, false)).toBe(false);
    }
    expect(mayCount('172.32.0.1', false)).toBe(true);
  });
});
