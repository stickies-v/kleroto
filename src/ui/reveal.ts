import { h, prefersReducedMotion, replaceChildren } from './dom';

const FIRST_SPIN_MS = 3200;
const SHORT_LIST_SPIN_MS = 1800;
const LONG_LIST_SPIN_MS = 1000;
const SPINS_IN_LONG_LIST = 3;
const SHORT_LIST = 5;
const PAUSE_AFTER_SPIN_MS = 500;
const CONFETTI_PIECES = 90;

export interface Reveal {
  skip(): void;
}

export function selectedList(participants: string[], tickets: string[], selected: number[]): HTMLOListElement {
  return h(
    'ol',
    { class: 'selected-list' },
    ...selected.map((index, place) => selectedRow(participants, tickets, index, place)),
  );
}

function selectedRow(participants: string[], tickets: string[], index: number, place: number): HTMLLIElement {
  const name = participants[index];
  const hasDuplicate = participants.indexOf(name) !== participants.lastIndexOf(name);
  return h(
    'li',
    {},
    h('span', { class: 'place' }, place + 1),
    h('span', { class: 'name' }, name, hasDuplicate ? h('span', { class: 'number' }, ` (no. ${index + 1})`) : null),
    h('code', { class: 'ticket', title: `Ticket ${tickets[index]}` }, shortTicket(tickets[index])),
  );
}

export function shortTicket(ticket: string): string {
  return `${ticket.slice(0, 8)}…`;
}

export function playReveal(
  stage: HTMLElement,
  participants: string[],
  tickets: string[],
  selected: number[],
  onDone: () => void,
): Reveal {
  const slotText = h('span', { class: 'slot-text' }, '?');
  const slot = h('div', { class: 'slot', 'aria-hidden': 'true' }, slotText);
  const list = h('ol', { class: 'selected-list' });
  const skipButton = h('button', { type: 'button', class: 'button subtle' }, 'Skip');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const wait = (ms: number) => new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)));

  function finish(celebrate: boolean): void {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    replaceChildren(stage, selectedList(participants, tickets, selected));
    if (celebrate && !prefersReducedMotion()) confetti();
    onDone();
  }

  async function spin(durationMs: number, place: number): Promise<void> {
    const drawn = new Set(selected.slice(0, place));
    const remaining = participants.map((_, i) => i).filter((i) => !drawn.has(i));
    slot.classList.remove('landed');
    const start = performance.now();
    let previous = -1;
    for (let elapsed = 0; elapsed < durationMs; elapsed = performance.now() - start) {
      let pick = remaining[Math.floor(Math.random() * remaining.length)];
      if (pick === previous && remaining.length > 1) pick = remaining[(remaining.indexOf(pick) + 1) % remaining.length];
      previous = pick;
      slotText.textContent = participants[pick];
      await wait(40 + 320 * (elapsed / durationMs) ** 2);
      if (finished) return;
    }
    slotText.textContent = participants[selected[place]];
    slot.classList.add('landed');
  }

  function spinDuration(place: number): number {
    if (place === 0) return FIRST_SPIN_MS;
    if (selected.length <= SHORT_LIST) return SHORT_LIST_SPIN_MS;
    return place < SPINS_IN_LONG_LIST ? LONG_LIST_SPIN_MS : 0;
  }

  async function run(): Promise<void> {
    const staggerMs = Math.max(20, Math.min(150, 3000 / selected.length));
    for (let place = 0; place < selected.length; place++) {
      const duration = spinDuration(place);
      if (duration > 0) await spin(duration, place);
      if (finished) return;
      const row = selectedRow(participants, tickets, selected[place], place);
      row.classList.add('pop');
      list.append(row);
      await wait(duration > 0 ? PAUSE_AFTER_SPIN_MS : staggerMs);
      if (finished) return;
    }
    finish(true);
  }

  skipButton.addEventListener('click', () => finish(false));

  if (prefersReducedMotion()) {
    finish(false);
  } else {
    replaceChildren(stage, slot, list, h('div', { class: 'button-row center' }, skipButton));
    void run();
  }
  return { skip: () => finish(false) };
}

function confetti(): void {
  const colors = ['#b9532c', '#e27d52', '#e0b44c', '#2c7a57', '#3f6f9e'];
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    const piece = h('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 4500);
}
