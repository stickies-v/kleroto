import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deflateSync, inflateSync, strToU8 } from 'fflate';

export type Source =
  | { kind: 'bitcoin'; height: number }
  | { kind: 'drand-quicknet'; round: number };

export interface Draw {
  title: string;
  select: number;
  source: Source;
  participants: string[];
}

export class DrawFormatError extends Error {}

const HEADER = 'kleroto v1';
const LINK_PREFIX = 'v1.';
const FORBIDDEN_CHARS = /[\p{Cc}\p{Cs}\u2028\u2029]/u;
const POSITIVE_INT = /^[1-9][0-9]*$/;

export const LIMITS = { participants: 10_000, textLength: 200 };

export function cleanText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function validate(draw: Draw): void {
  checkText('Title', draw.title);
  const count = draw.participants.length;
  if (count === 0) throw new DrawFormatError('Add at least one participant.');
  if (count > LIMITS.participants) {
    throw new DrawFormatError(`A draw can have at most ${LIMITS.participants.toLocaleString()} participants.`);
  }
  draw.participants.forEach((participant, i) => checkText(`Participant ${i + 1}`, participant));
  if (!Number.isSafeInteger(draw.select) || draw.select < 1 || draw.select > count) {
    throw new DrawFormatError(
      count === 1 ? 'With one participant, you can select only 1.' : `You can select between 1 and ${count} participants.`,
    );
  }
  const target = draw.source.kind === 'bitcoin' ? draw.source.height : draw.source.round;
  if (!Number.isSafeInteger(target) || target < 1) {
    throw new DrawFormatError('The draw target is not valid.');
  }
}

function checkText(label: string, text: string): void {
  if (text.length === 0) throw new DrawFormatError(`${label} is empty.`);
  if (text !== text.trim()) throw new DrawFormatError(`${label} starts or ends with a space.`);
  if (FORBIDDEN_CHARS.test(text)) throw new DrawFormatError(`${label} contains a forbidden character.`);
  if (text.length > LIMITS.textLength) {
    throw new DrawFormatError(`${label} is longer than ${LIMITS.textLength} characters.`);
  }
}

function sourceLine(source: Source): string {
  return source.kind === 'bitcoin' ? `bitcoin ${source.height}` : `drand-quicknet ${source.round}`;
}

export function toCanonicalText(draw: Draw): string {
  validate(draw);
  const lines = [
    HEADER,
    `title: ${draw.title}`,
    `select: ${draw.select}`,
    `source: ${sourceLine(draw.source)}`,
    `participants: ${draw.participants.length}`,
    ...draw.participants,
  ];
  return lines.join('\n') + '\n';
}

export function parseCanonicalText(text: string): Draw {
  const lines = text.split('\n');
  if (lines.pop() !== '') throw new DrawFormatError('The draw data does not end with a newline.');
  if (lines[0] !== HEADER) throw new DrawFormatError('This is not a draw link.');

  const field = (index: number, name: string): string => {
    const line = lines[index] ?? '';
    if (!line.startsWith(`${name}: `)) throw new DrawFormatError(`The "${name}" field is missing.`);
    return line.slice(name.length + 2);
  };
  const positiveInt = (value: string, name: string): number => {
    if (!POSITIVE_INT.test(value)) throw new DrawFormatError(`The "${name}" field is not valid.`);
    return Number(value);
  };

  const title = field(1, 'title');
  const select = positiveInt(field(2, 'select'), 'select');
  const [kind, target, ...rest] = field(3, 'source').split(' ');
  if (rest.length > 0 || target === undefined) throw new DrawFormatError('The "source" field is not valid.');
  let source: Source;
  if (kind === 'bitcoin') source = { kind, height: positiveInt(target, 'source') };
  else if (kind === 'drand-quicknet') source = { kind, round: positiveInt(target, 'source') };
  else throw new DrawFormatError(`The source "${kind}" is not known.`);
  const participantCount = positiveInt(field(4, 'participants'), 'participants');
  const participants = lines.slice(5);
  if (participants.length !== participantCount) {
    throw new DrawFormatError('The number of participants is not correct.');
  }

  const draw: Draw = { title, select, source, participants };
  if (toCanonicalText(draw) !== text) throw new DrawFormatError('The draw data is not in canonical form.');
  return draw;
}

export function fingerprint(draw: Draw): string {
  return bytesToHex(sha256(strToU8(toCanonicalText(draw))));
}

export function encodeFragment(draw: Draw): string {
  return LINK_PREFIX + toBase64Url(deflateSync(strToU8(toCanonicalText(draw)), { level: 9 }));
}

export function decodeFragment(fragment: string): Draw {
  if (!fragment.startsWith(LINK_PREFIX)) throw new DrawFormatError('This is not a draw link.');
  let text: string;
  try {
    const compressed = fromBase64Url(fragment.slice(LINK_PREFIX.length));
    text = new TextDecoder('utf-8', { fatal: true }).decode(inflateSync(compressed));
  } catch {
    throw new DrawFormatError('The link is damaged. Make sure that you copied all of it.');
  }
  return parseCanonicalText(text);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
