import { hexToBytes } from '@noble/hashes/utils.js';
import { APP_NAME } from '../config';
import { fingerprint, toCanonicalText, type Draw } from '../draw';
import { computeResult, type DrawResult } from '../result';
import {
  EXPLORERS,
  FINAL_CONFIRMATIONS,
  expectedTime,
  fetchBlock,
  watchNewBlocks,
  type BitcoinStatus,
} from '../sources/bitcoin';
import { fetchRandomness, roundTime } from '../sources/drand';
import { commandsPanel } from './commands';
import { h, replaceChildren } from './dom';
import {
  BITCOIN_ORACLE,
  DRAND_ORACLE,
  bitcoinExplanation,
  drandExplanation,
  fingerprintExplanation,
  participantNudge,
  ticketsExplanation,
  trustPoints,
} from './explain';
import { formatClock, formatDuration, formatNumber, formatWhen, nowSeconds, plural } from './format';
import { logo } from './icons';
import { playReveal, selectedList, shortTicket, type Reveal } from './reveal';
import { markRevealed, takeCreated, wasRevealed } from './session';
import { sharePanel } from './share';

const BITCOIN_POLL_MS = 30_000;
const DRAND_RETRY_MS = 1_000;
const DRAND_ERROR_RETRY_MS = 3_000;
const FINAL_SECONDS = 10;
const MAX_BLOCK_SQUARES = 12;
const NOTHING_TO_DO =
  "You don't need to do anything. The list is final. Open this link again after the draw to see who's selected.";

interface Page {
  status: HTMLElement;
  connection: HTMLElement;
  explainButton(): HTMLElement;
  showResult(randomness: Uint8Array, notice?: string): HTMLElement;
  setExpectedTime(seconds: number): void;
}

export function renderView(root: HTMLElement, draw: Draw, fragment: string): () => void {
  document.title = `${draw.title} · ${APP_NAME}`;
  const status = h('div', { class: 'status-body', 'aria-live': 'polite' });
  const connection = h('p', { class: 'connection', role: 'status' });
  const share = h('div', { class: 'share-slot' });
  const participants = participantsPanel(draw);
  const trust = trustPanel(draw);
  let reveal: Reveal | undefined;

  const setShare = (drawn: boolean) =>
    replaceChildren(
      share,
      drawn
        ? h('p', {}, 'Everyone who opens this link sees the same result.')
        : h(
            'p',
            {},
            'Send this link to everyone before the draw',
            ...drawTimeNodes(draw),
            '. A group chat works best: everyone gets the same link, and can see when it was sent.',
          ),
      sharePanel(location.href),
    );

  const page: Page = {
    status,
    connection,
    explainButton: () =>
      h('button', { type: 'button', class: 'link-button', onclick: trust.open }, 'How does this work?'),
    showResult(randomness, notice) {
      const result = computeResult(draw, randomness);
      trust.setResult(result);
      participants.setResult(result);
      const seenKey = `${result.fingerprint}:${result.randomness}`;
      const stage = h('div', { class: 'stage' });
      const badge = h('p', { class: 'badge' });
      const replay = h('button', { type: 'button', class: 'button subtle' }, 'Replay the draw');
      const after = h('div', { class: 'after-reveal' }, badge, h('div', { class: 'button-row center' }, replay), page.explainButton());
      const start = (animate: boolean) => {
        after.hidden = true;
        if (!animate) {
          replaceChildren(stage, selectedList(draw.participants, result.tickets, result.selected));
          after.hidden = false;
          return;
        }
        reveal = playReveal(stage, draw.participants, result.tickets, result.selected, () => {
          markRevealed(seenKey);
          after.hidden = false;
        });
      };
      replay.addEventListener('click', () => start(true));
      replaceChildren(
        status,
        notice ? h('p', { class: 'notice' }, notice) : null,
        h('h2', {}, '🎉 Selected'),
        stage,
        after,
        connection,
      );
      start(!wasRevealed(seenKey));
      setShare(true);
      return badge;
    },
    setExpectedTime(seconds) {
      for (const element of root.querySelectorAll('.expected-at')) {
        element.textContent = ` (${formatWhen(seconds)})`;
      }
    },
  };

  replaceChildren(
    root,
    h(
      'nav',
      { class: 'top' },
      h('a', { href: '#', class: 'brand' }, logo(), APP_NAME),
      h('a', { href: '#' }, 'Make your own draw'),
    ),
    h('header', { class: 'draw-header' }, h('h1', {}, draw.title), h('p', { class: 'meta' }, drawSummary(draw))),
    takeCreated(fragment)
      ? h(
          'p',
          { class: 'banner' },
          "🎉 Your draw is ready. Send the link to everyone before the draw starts. That's what makes it fair.",
        )
      : null,
    h('section', { class: 'card status' }, status, share),
    participants.element,
    trust.element,
  );
  setShare(false);

  const stop =
    draw.source.kind === 'bitcoin' ? watchBitcoin(page, draw.source.height) : watchDrand(page, draw.source.round);
  return () => {
    stop();
    reveal?.skip();
  };
}

function watchBitcoin(page: Page, height: number): () => void {
  let stopped = false;
  let polling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastTip: number | null = null;
  let shown: { hash: string; badge: HTMLElement } | null = null;

  const currentBlock = h('dd', {});
  const countdown = h('div', { class: 'big-number' });
  const when = h('p', { class: 'when' });
  const blocks = h('div', { class: 'blocks', 'aria-hidden': 'true' });
  const blocksLabel = h('p', { class: 'blocks-label' });
  const news = h('p', { class: 'news', role: 'status' });
  const waitingView = [
    h('h2', {}, 'The draw starts in about'),
    countdown,
    when,
    blocks,
    blocksLabel,
    news,
    h(
      'dl',
      { class: 'block-stats' },
      h('div', {}, h('dt', {}, 'Current block'), currentBlock),
      h('div', {}, h('dt', {}, 'Draw block'), h('dd', {}, formatNumber(height))),
    ),
    h('p', { class: 'nothing-to-do' }, NOTHING_TO_DO),
    h(
      'p',
      { class: 'hint' },
      'The draw waits for the Bitcoin network. A new block arrives about every 10 minutes, ' +
        'sometimes sooner, sometimes later. Watch it live on ',
      ...EXPLORERS.flatMap((explorer, i) => [
        i > 0 ? ' or ' : '',
        h('a', { href: explorer.url, target: '_blank', rel: 'noopener' }, explorer.name),
      ]),
      '. ',
      page.explainButton(),
    ),
    page.connection,
  ];
  replaceChildren(page.status, h('p', { class: 'loading' }, 'Connecting to the Bitcoin network…'), page.connection);

  function showWaiting(tip: number): void {
    if (lastTip === null) replaceChildren(page.status, ...waitingView);
    const remaining = height - tip;
    const expectedAt = expectedTime(height, tip, nowSeconds());
    countdown.textContent = formatDuration(expectedAt - nowSeconds());
    currentBlock.textContent = formatNumber(tip);
    when.textContent = formatWhen(expectedAt);
    replaceChildren(
      blocks,
      ...(remaining <= MAX_BLOCK_SQUARES ? Array.from({ length: remaining }, () => h('span', { class: 'block' })) : []),
    );
    blocksLabel.textContent =
      remaining === 1 ? 'The next Bitcoin block decides!' : `${formatNumber(remaining)} Bitcoin blocks to go`;
    if (lastTip !== null && tip > lastTip) {
      news.textContent = `A new block arrived! ${remaining === 1 ? 'One more to go.' : ''}`;
      news.classList.remove('flash');
      void news.offsetWidth;
      news.classList.add('flash');
    }
    lastTip = tip;
    page.setExpectedTime(expectedAt);
  }

  function showMined(status: Extract<BitcoinStatus, { state: 'mined' }>): boolean {
    if (!shown || shown.hash !== status.hash) {
      const notice = shown
        ? 'The Bitcoin network replaced the deciding block, so the result changed. This is the new result.'
        : undefined;
      shown = { hash: status.hash, badge: page.showResult(hexToBytes(status.hash), notice) };
    }
    const final = status.confirmations >= FINAL_CONFIRMATIONS;
    shown.badge.className = final ? 'badge final' : 'badge provisional';
    shown.badge.textContent = final
      ? '✓ Final result'
      : `Almost final. The Bitcoin network is still confirming the result (${status.confirmations} of ` +
        `${FINAL_CONFIRMATIONS}). In rare cases, it can still change.`;
    return final;
  }

  async function poll(): Promise<void> {
    if (polling) return;
    polling = true;
    clearTimeout(timer);
    let final = false;
    try {
      const status = await fetchBlock(height);
      if (stopped) return;
      page.connection.textContent = '';
      if (status.state === 'waiting') showWaiting(status.tip);
      else final = showMined(status);
    } catch (err) {
      if (stopped) return;
      console.warn('Bitcoin check failed', err);
      page.connection.textContent = "Can't reach the Bitcoin network right now. Trying again soon.";
    }
    polling = false;
    if (final) stopWatching();
    else if (!stopped) timer = setTimeout(poll, BITCOIN_POLL_MS);
  }

  const stopWatching = watchNewBlocks(() => void poll());
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopWatching();
  };
}

function watchDrand(page: Page, round: number): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drawAt = roundTime(round);

  const clock = h('div', { class: 'big-number clock' });
  const waitingView = [
    h('h2', {}, 'The draw starts in'),
    clock,
    h('p', { class: 'when' }, `${formatWhen(drawAt, true)} exactly`),
    h('p', { class: 'nothing-to-do' }, NOTHING_TO_DO),
    h(
      'p',
      { class: 'hint' },
      'At that second, the drand service publishes a new random number, and the draw happens. ',
      page.explainButton(),
    ),
    page.connection,
  ];

  function tick(): void {
    const remaining = drawAt - nowSeconds();
    if (remaining <= 0) {
      replaceChildren(page.status, h('p', { class: 'loading' }, 'Drawing…'), page.connection);
      void fetchResult();
      return;
    }
    if (!page.status.contains(clock)) replaceChildren(page.status, ...waitingView);
    clock.textContent = formatClock(remaining);
    clock.classList.toggle('final-countdown', remaining <= FINAL_SECONDS);
    timer = setTimeout(tick, (remaining % 1) * 1000 || 1000);
  }

  async function fetchResult(): Promise<void> {
    let retryMs = DRAND_RETRY_MS;
    try {
      const randomness = await fetchRandomness(round);
      if (stopped) return;
      if (randomness) {
        const badge = page.showResult(randomness);
        badge.className = 'badge final';
        badge.textContent = '✓ Final result';
        return;
      }
    } catch (err) {
      if (stopped) return;
      console.warn('drand check failed', err);
      page.connection.textContent = "Can't reach drand right now. Trying again.";
      retryMs = DRAND_ERROR_RETRY_MS;
    }
    timer = setTimeout(fetchResult, retryMs);
  }

  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

function participantsPanel(draw: Draw) {
  const rows = draw.participants.map((participant) => h('li', {}, h('span', { class: 'name' }, participant)));
  const hint = h('p', { class: 'hint', hidden: true });
  const element = h(
    'details',
    { class: 'card details', open: true },
    h('summary', {}, `All ${plural(draw.participants.length, 'participant')}`),
    hint,
    h('ol', { class: 'participants' }, ...rows),
  );
  return {
    element,
    setResult(result: DrawResult) {
      const places = new Map(result.selected.map((index, place) => [index, place + 1]));
      hint.hidden = false;
      hint.textContent = 'Each participant has a lottery ticket. The lowest tickets are selected.';
      rows.forEach((row, i) => {
        const place = places.get(i);
        row.classList.toggle('is-selected', place !== undefined);
        replaceChildren(
          row,
          h('span', { class: 'name' }, draw.participants[i]),
          place !== undefined ? h('span', { class: 'mark' }, `✓ ${place}`) : null,
          h('code', { class: 'ticket', title: `Ticket ${result.tickets[i]}` }, shortTicket(result.tickets[i])),
        );
      });
    },
  };
}

function trustPanel(draw: Draw) {
  const randomnessValue = h('code', {}, 'not known yet');
  const sourceLink = h('p', { class: 'hint' });
  const commands = commandsPanel(draw, location.href);
  const fingerprintValue = h('code', {}, fingerprint(draw));

  const element = h(
    'details',
    { class: 'card details trust' },
    h('summary', {}, 'Why this draw is provably fair'),
    trustPoints(draw.source.kind === 'bitcoin' ? BITCOIN_ORACLE : DRAND_ORACLE),
    participantNudge(),
    h(
      'details',
      { class: 'deeper' },
      h('summary', {}, 'How does it work exactly?'),
      h('h3', {}, '1. The fingerprint'),
      fingerprintExplanation(),
      h('p', {}, fingerprintValue),
      h('details', { class: 'raw' }, h('summary', {}, 'Show the draw data'), h('pre', {}, toCanonicalText(draw))),
      h('h3', {}, '2. The random number'),
      ...(draw.source.kind === 'bitcoin' ? bitcoinExplanation(draw.source.height) : drandExplanation(draw.source.round)),
      h('p', {}, 'Random number: ', randomnessValue),
      sourceLink,
      h('h3', {}, '3. The tickets'),
      ticketsExplanation(),
      h('h3', {}, '4. Check it yourself'),
      h(
        'p',
        {},
        "You don't have to trust this website: work out the result yourself with the commands below.",
      ),
      commands.element,
    ),
  );
  return {
    element,
    open() {
      element.open = true;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    setResult(result: DrawResult) {
      randomnessValue.textContent = result.randomness;
      if (draw.source.kind === 'bitcoin') {
        replaceChildren(
          sourceLink,
          h('a', { href: `https://mempool.space/block/${result.randomness}`, target: '_blank', rel: 'noopener' }, 'See this block on mempool.space'),
        );
      }
      commands.setResult(result);
    },
  };
}

function drawSummary(draw: Draw): string {
  return `${plural(draw.participants.length, 'participant')} · selecting ${formatNumber(draw.select)}`;
}

function drawTimeNodes(draw: Draw): (string | HTMLElement)[] {
  if (draw.source.kind === 'drand-quicknet') return [` (${formatWhen(roundTime(draw.source.round), true)})`];
  return [h('span', { class: 'expected-at' })];
}
