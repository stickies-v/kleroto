import { APP_NAME, APP_TAGLINE } from '../config';
import { DrawFormatError, LIMITS, cleanText, encodeFragment, type Draw, type Source } from '../draw';
import { count } from '../analytics';
import { randomExample } from '../examples';
import { BLOCK_INTERVAL_SECONDS, expectedTime, fetchTipHeight } from '../sources/bitcoin';
import { firstRoundAtOrAfter, roundTime } from '../sources/drand';
import { h, replaceChildren } from './dom';
import { icon, logo, type IconName } from './icons';
import {
  ANY_ORACLE,
  bitcoinExplanation,
  drandExplanation,
  fingerprintExplanation,
  organizerNudge,
  ticketsExplanation,
  trustPoints,
} from './explain';
import { formatDuration, formatNumber, formatWhen, nowSeconds, plural, timeZoneName } from './format';
import { markCreated } from './session';

type Oracle = 'drand' | 'bitcoin';

const DEFAULT_TITLE = 'Random draw';
const DEFAULT_LEAD_SECONDS = 3600;
const MIN_LEAD_SECONDS = 30;
const TIP_REFRESH_MS = 60_000;
const SUBMIT_LABEL = 'Create the draw';

export function renderCreate(root: HTMLElement): () => void {
  let tip: number | null = null;
  let tipFailed = false;
  let heightEdited = false;
  const example = randomExample();

  const titleInput = h('input', {
    id: 'title',
    type: 'text',
    maxLength: LIMITS.textLength,
    placeholder: example.title,
    autocomplete: 'off',
  });
  const participantsInput = h('textarea', {
    id: 'participants',
    rows: 8,
    placeholder: example.participants.join('\n'),
    spellcheck: false,
  });
  const participantsInfo = h('p', { class: 'hint' });
  const selectInput = h('input', { id: 'select', type: 'number', min: 1, value: '1', inputMode: 'numeric' });
  const timeInput = h('input', { id: 'time', type: 'datetime-local', value: toLocalInputValue(defaultTime()) });
  const timeInfo = h('p', { class: 'hint' });
  const heightInput = h('input', { id: 'height', type: 'number', min: 1, inputMode: 'numeric', disabled: true });
  const heightInfo = h('p', { class: 'hint' });
  const error = h('p', { class: 'error', role: 'alert' });
  const submitButton = h('button', { type: 'submit', class: 'button primary big' }, SUBMIT_LABEL);

  const oracleOption = (oracle: Oracle, label: string, tradeOff: string, checked: boolean, ...extra: HTMLElement[]) =>
    h(
      'div',
      { class: 'choice' },
      h(
        'label',
        { class: 'choice-head' },
        h('input', { type: 'radio', name: 'oracle', value: oracle, checked }),
        h('span', { class: 'choice-text' }, h('strong', {}, label), h('span', {}, tradeOff)),
      ),
      h('div', { class: 'choice-extra' }, ...extra),
    );

  const form = h(
    'form',
    { class: 'card form', novalidate: true, hidden: true },
    field('title', 'What is the draw for?', titleInput),
    field(
      'participants',
      'Participants',
      h('p', { class: 'hint' }, 'One on each line: people, places, films, anything.'),
      participantsInput,
      participantsInfo,
    ),
    field('select', 'How many to select?', selectInput),
    h(
      'fieldset',
      { class: 'choices' },
      h('legend', {}, 'Draw oracle'),
      h('p', { class: 'hint' }, 'Where the random number comes from. Nobody knows it until the draw.'),
      oracleOption(
        'drand',
        'drand',
        'Exact to the second, but it relies on a group of independent organizations.',
        true,
        h('label', { htmlFor: 'time' }, 'Draw time'),
        timeInput,
        timeInfo,
      ),
      oracleOption(
        'bitcoin',
        'Bitcoin block',
        'Relies on no organization, but the draw time is only an estimate, because blocks arrive at random intervals.',
        false,
        h('label', { htmlFor: 'height' }, 'Block height'),
        heightInput,
        heightInfo,
      ),
    ),
    error,
    submitButton,
  );

  const readParticipants = () => participantsInput.value.split('\n').map(cleanText).filter(Boolean);
  const readOracle = () => (form.querySelector<HTMLInputElement>('input[name=oracle]:checked')?.value ?? 'drand') as Oracle;
  const readTime = () => {
    const time = new Date(timeInput.value).getTime();
    return Number.isNaN(time) ? null : time / 1000;
  };
  const readHeight = () => {
    const height = Number(heightInput.value);
    return Number.isSafeInteger(height) && height > 0 ? height : null;
  };

  function updateParticipantsInfo(): void {
    const participants = readParticipants();
    const duplicates = participants.length - new Set(participants).size;
    replaceChildren(
      participantsInfo,
      plural(participants.length, 'participant'),
      duplicates > 0
        ? h('span', { class: 'warning' }, ` · ${plural(duplicates, 'name')} more than once (each line is one ticket)`)
        : null,
    );
    selectInput.max = String(Math.max(1, participants.length));
  }

  function updateTimeInfo(): void {
    const target = readTime();
    const now = nowSeconds();
    if (target === null || target < now + MIN_LEAD_SECONDS) {
      timeInfo.textContent = 'Pick a time in the future.';
      return;
    }
    const drawAt = roundTime(firstRoundAtOrAfter(target));
    timeInfo.textContent =
      `${capitalize(formatWhen(drawAt, true))} (in ${formatDuration(drawAt - now)}). ` +
      `Everyone sees it in their own time zone (yours is ${timeZoneName()}).`;
  }

  function updateHeightInfo(): void {
    if (tip === null) {
      heightInfo.textContent = tipFailed ? 'Cannot reach the Bitcoin network at the moment.' : 'Connecting to the Bitcoin network…';
      return;
    }
    heightInput.disabled = false;
    heightInput.min = String(tip + 1);
    if (!heightEdited) heightInput.value = String(tip + Math.round(DEFAULT_LEAD_SECONDS / BLOCK_INTERVAL_SECONDS));
    const height = readHeight();
    if (height === null || height <= tip) {
      heightInfo.textContent = `Pick a block after the current block, ${formatNumber(tip)}.`;
      return;
    }
    const now = nowSeconds();
    const drawAt = expectedTime(height, tip, now);
    heightInfo.textContent =
      `Expected ${formatWhen(drawAt)} (in about ${formatDuration(drawAt - now)}). ` +
      `The current block is ${formatNumber(tip)}; a new one arrives about every 10 minutes.`;
  }

  async function refreshTip(): Promise<void> {
    try {
      tip = await fetchTipHeight();
      tipFailed = false;
    } catch {
      tipFailed = tip === null;
    }
    updateHeightInfo();
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    error.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Creating…';
    try {
      const draw: Draw = {
        title: cleanText(titleInput.value) || DEFAULT_TITLE,
        select: Number(selectInput.value),
        source: await makeSource(readOracle(), readTime(), readHeight()),
        participants: readParticipants(),
      };
      const fragment = encodeFragment(draw);
      count({ path: `draw-created-${readOracle()}`, title: 'Draw created', event: true });
      markCreated(fragment);
      location.hash = fragment;
    } catch (err) {
      error.textContent =
        err instanceof DrawFormatError ? err.message : 'Cannot reach the Bitcoin network. Check your connection and try again.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = SUBMIT_LABEL;
    }
  }

  participantsInput.addEventListener('input', updateParticipantsInfo);
  timeInput.addEventListener('input', updateTimeInfo);
  heightInput.addEventListener('input', () => {
    heightEdited = true;
    updateHeightInfo();
  });
  form.addEventListener('submit', submit);

  const startButton = h('button', { type: 'button', class: 'button primary big' }, 'Get started');
  const start = h('div', { class: 'start' }, startButton);
  startButton.addEventListener('click', () => {
    start.hidden = true;
    form.hidden = false;
    form.classList.add('unfold');
    titleInput.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  replaceChildren(
    root,
    h(
      'header',
      { class: 'hero' },
      logo(),
      h('h1', {}, APP_NAME),
      h('p', { class: 'lead' }, `${APP_TAGLINE}.`),
      h(
        'p',
        { class: 'sub' },
        'Make a list, share the link, and let chance decide. Nobody can rig it, and anyone can check it.',
      ),
      h(
        'ul',
        { class: 'highlights' },
        h('li', {}, '✓ Provably fair'),
        h('li', {}, '✓ No sign-up'),
        h('li', {}, '✓ Free and open source'),
      ),
    ),
    howItWorks(),
    start,
    form,
    whyTrust(),
    aboutName(),
  );
  updateParticipantsInfo();
  updateTimeInfo();
  updateHeightInfo();
  void refreshTip();

  const timers = [
    setInterval(() => {
      updateTimeInfo();
      updateHeightInfo();
    }, 15_000),
    setInterval(refreshTip, TIP_REFRESH_MS),
  ];
  return () => timers.forEach(clearInterval);
}

async function makeSource(oracle: Oracle, time: number | null, height: number | null): Promise<Source> {
  if (oracle === 'drand') {
    if (time === null || time < nowSeconds() + MIN_LEAD_SECONDS) throw new DrawFormatError('Pick a draw time in the future.');
    return { kind: 'drand-quicknet', round: firstRoundAtOrAfter(time) };
  }
  if (height === null) throw new DrawFormatError('Pick a block height.');
  const tip = await fetchTipHeight();
  if (height <= tip) {
    throw new DrawFormatError(`Block ${formatNumber(height)} already exists. Pick a block after ${formatNumber(tip)}.`);
  }
  return { kind: 'bitcoin', height };
}

function field(id: string, label: string, ...controls: HTMLElement[]): HTMLElement {
  return h('div', { class: 'field' }, h('label', { htmlFor: id }, label), ...controls);
}

function howItWorks(): HTMLElement {
  const step = (name: IconName, title: string, text: string) =>
    h('li', {}, h('span', { class: 'step-icon' }, icon(name)), h('strong', {}, title), h('span', {}, text));
  return h(
    'section',
    { class: 'steps' },
    h('h2', {}, 'How it works'),
    h(
      'ol',
      {},
      step('list', 'Make a list', 'Add the participants and pick a time.'),
      step('link', 'Share the link', 'Send it to everyone before the draw.'),
      step('dice', 'Chance decides', 'Everyone sees the same result once the draw finishes.'),
    ),
  );
}

function whyTrust(): HTMLElement {
  return h(
    'section',
    { class: 'card trust' },
    h('h2', {}, "Why it's fair"),
    trustPoints(ANY_ORACLE),
    organizerNudge(),
    h(
      'details',
      { class: 'deeper' },
      h('summary', {}, 'How does it work exactly?'),
      h('h3', {}, '1. The fingerprint'),
      fingerprintExplanation(),
      h('h3', {}, '2. The random number'),
      h('p', {}, 'The organizer picks one of two draw oracles.'),
      ...drandExplanation(),
      ...bitcoinExplanation(),
      h('h3', {}, '3. The tickets'),
      ticketsExplanation(),
      h('h3', {}, '4. Check it yourself'),
      h(
        'p',
        {},
        "You don't have to trust this website. Every draw page lists the terminal commands to work out " +
          'the result yourself.',
      ),
    ),
  );
}

function aboutName(): HTMLElement {
  return h(
    'section',
    { class: 'about-name' },
    h('h2', {}, `Why "${APP_NAME}"?`),
    h(
      'p',
      {},
      'In ancient Athens, juries and officials were picked with a kleroterion: a stone machine that chose ' +
        `at random, so nobody could rig it. ${APP_NAME} does the same, minus the stone.`,
    ),
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function defaultTime(): Date {
  const fiveMinutes = 5 * 60 * 1000;
  return new Date(Math.ceil((Date.now() + DEFAULT_LEAD_SECONDS * 1000) / fiveMinutes) * fiveMinutes);
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
