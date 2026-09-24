import { FINAL_CONFIRMATIONS } from '../sources/bitcoin';
import { QUICKNET, roundTime } from '../sources/drand';
import { h } from './dom';
import { formatNumber, formatWhen } from './format';
import { icon, type IconName } from './icons';

export const ANY_ORACLE = 'a number from drand or from the Bitcoin network';
export const BITCOIN_ORACLE = 'the code of a future block of the Bitcoin network';
export const DRAND_ORACLE = 'a number that the drand service publishes at the draw time';

export function trustPoints(oracle: string): HTMLElement {
  const point = (name: IconName, title: string, text: string) =>
    h('li', {}, icon(name), h('span', {}, h('strong', {}, title), ' ', text));
  return h(
    'ul',
    { class: 'trust-points' },
    point(
      'lock',
      'The list is locked.',
      "The link contains the full list. Change one name and it's a different link.",
    ),
    point(
      'dice',
      'Nobody knows the result in advance, not even the organizer.',
      `It depends on a random number that doesn't exist yet: ${oracle}.`,
    ),
    point('equal', 'Everyone gets the same result.', 'Your own phone or computer works it out, the same way for everyone.'),
    point(
      'search',
      'Anyone can check it.',
      'No need to trust this website: a few standard commands give you the same result.',
    ),
  );
}

export function participantNudge(): HTMLElement {
  return h(
    'p',
    { class: 'nudge' },
    h('strong', {}, 'Just one thing: '),
    'check that you got the link before the draw. A link sent afterwards could be a different draw.',
  );
}

export function organizerNudge(): HTMLElement {
  return h(
    'p',
    { class: 'nudge' },
    h('strong', {}, 'Just one thing: '),
    'share the link before the draw, so everyone can see it was set up before anyone could know the result.',
  );
}

export function fingerprintExplanation(): HTMLElement {
  return h(
    'p',
    {},
    'The link contains the draw data: the title, the participants, how many to select, and the draw oracle. ' +
      'Its SHA256 hash is the fingerprint of the draw. Change one letter and you get a completely different fingerprint.',
  );
}

export function drandExplanation(round?: number): HTMLElement[] {
  const which =
    round === undefined
      ? 'A draw uses the number of the exact second that the organizer picks.'
      : `This draw uses round ${formatNumber(round)}, ${formatWhen(roundTime(round), true)}.`;
  return [
    h(
      'p',
      {},
      h('strong', {}, 'drand '),
      'is a public service for random numbers. A group of independent organizations, the League of Entropy, ' +
        'run it together. Every 3 seconds they publish a new random number with a signature. Nobody can predict ' +
        `the number, and no single organization controls it. ${which}`,
    ),
    h(
      'p',
      {},
      'Your browser checks the signature, so nobody can give it a false number.',
      round === undefined
        ? null
        : h(
            'span',
            {},
            ' ',
            h(
              'a',
              { href: `https://api.drand.sh/${QUICKNET.chainHash}/public/${round}`, target: '_blank', rel: 'noopener' },
              'See this round',
            ),
            ' (after the draw).',
          ),
    ),
  ];
}

export function bitcoinExplanation(height?: number): HTMLElement[] {
  const which =
    height === undefined
      ? 'A draw uses the hash of a future block that the organizer picks by its number, the block height.'
      : `This draw uses the hash of block ${formatNumber(height)}.`;
  return [
    h(
      'p',
      {},
      h('strong', {}, 'Bitcoin '),
      'is a global payment network. About every 10 minutes, it adds a new "block". Each block gets a code, the ' +
        `block hash, that nobody can predict: thousands of computers compete to find it. ${which}`,
    ),
    h(
      'p',
      {},
      'Your browser gets the hash from two independent sources and checks the proof of work of the block, ' +
        `so nobody can give it a false hash. The result is final when ${FINAL_CONFIRMATIONS - 1} more blocks ` +
        'are on top of it.',
    ),
  ];
}

export function ticketsExplanation(): HTMLElement {
  return h(
    'p',
    {},
    'Each participant gets a lottery ticket: the SHA256 of the text ',
    h('code', {}, '"<fingerprint> <random number> <participant number>"'),
    '. The lowest tickets are selected. After the draw, the list of participants shows all tickets.',
  );
}
