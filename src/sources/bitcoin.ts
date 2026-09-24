import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { SourceError, fetchText, fulfilled } from './http';

export const FINAL_CONFIRMATIONS = 3;
export const BLOCK_INTERVAL_SECONDS = 600;

const APIS = ['https://mempool.space/api', 'https://blockstream.info/api'];
const BLOCKS_WEBSOCKET = 'wss://mempool.space/api/v1/ws';

export const EXPLORERS = [
  { name: 'mempool.space', url: 'https://mempool.space/' },
  { name: 'blockstream.info', url: 'https://blockstream.info/' },
];
const HEADER_BYTES = 80;
const DIFFICULTY_1_TARGET = 0xffffn << 208n;
const MIN_ACCEPTED_DIFFICULTY = 10n ** 13n;
const MAX_ACCEPTED_TARGET = DIFFICULTY_1_TARGET / MIN_ACCEPTED_DIFFICULTY;

export type BitcoinStatus =
  | { state: 'waiting'; tip: number }
  | { state: 'mined'; tip: number; hash: string; confirmations: number };

export function expectedTime(height: number, tip: number, nowSeconds: number): number {
  return nowSeconds + Math.max(1, height - tip) * BLOCK_INTERVAL_SECONDS;
}

export function watchNewBlocks(onBlock: () => void): () => void {
  let socket: WebSocket;
  try {
    socket = new WebSocket(BLOCKS_WEBSOCKET);
  } catch {
    return () => {};
  }
  socket.addEventListener('open', () => socket.send(JSON.stringify({ action: 'want', data: ['blocks'] })));
  socket.addEventListener('message', (event) => {
    try {
      if ('block' in JSON.parse(event.data)) onBlock();
    } catch {
      // Ignore messages that are not JSON.
    }
  });
  return () => socket.close();
}

export async function fetchTipHeight(): Promise<number> {
  const results = await Promise.allSettled(APIS.map((api) => fetchText(`${api}/blocks/tip/height`)));
  const heights = fulfilled(results).map(Number).filter(Number.isSafeInteger);
  if (heights.length === 0) throw new SourceError('Cannot reach the Bitcoin APIs.');
  return Math.max(...heights);
}

export async function fetchBlock(height: number): Promise<BitcoinStatus> {
  const tip = await fetchTipHeight();
  if (tip < height) return { state: 'waiting', tip };

  const answers = fulfilled(
    await Promise.allSettled(
      APIS.map(async (api) => ({ api, hash: await fetchText(`${api}/block-height/${height}`) })),
    ),
  ).filter((answer): answer is { api: string; hash: string } => answer.hash !== null);
  if (answers.length === 0) return { state: 'waiting', tip };
  const hashes = new Set(answers.map((answer) => answer.hash));
  if (hashes.size > 1) throw new SourceError(`The Bitcoin APIs do not agree on block ${height} yet.`);

  const { api, hash } = answers[0];
  const header = await fetchText(`${api}/block/${hash}/header`);
  if (header === null) throw new SourceError(`Cannot get the header of block ${height}.`);
  checkProofOfWork(hexToBytes(header), hash);
  return { state: 'mined', tip, hash, confirmations: tip - height + 1 };
}

export function checkProofOfWork(header: Uint8Array, expectedHash: string): void {
  if (header.length !== HEADER_BYTES) throw new SourceError('The block header has the wrong length.');
  const hash = bytesToHex(sha256(sha256(header)).reverse());
  if (hash !== expectedHash) throw new SourceError('The block header does not match the block hash.');
  const bits = new DataView(header.buffer, header.byteOffset + 72, 4).getUint32(0, true);
  const target = bitsToTarget(bits);
  if (target > MAX_ACCEPTED_TARGET) throw new SourceError('The block difficulty is too low.');
  if (BigInt(`0x${hash}`) > target) throw new SourceError('The block hash does not meet its target.');
}

function bitsToTarget(bits: number): bigint {
  const exponent = BigInt(bits >>> 24);
  const mantissa = BigInt(bits & 0x007fffff);
  return exponent >= 3n ? mantissa << (8n * (exponent - 3n)) : mantissa >> (8n * (3n - exponent));
}
