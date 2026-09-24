import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it, vi } from 'vitest';
import { checkProofOfWork, expectedTime, watchNewBlocks } from '../src/sources/bitcoin';
import { SourceError } from '../src/sources/http';
import { QUICKNET, firstRoundAtOrAfter, roundTime, verifyBeacon } from '../src/sources/drand';

const BLOCK_960000 = {
  hash: '000000000000000000001268aab06132c2dd203f77b6020462cd177942d6959d',
  header:
    '04000030ad8ce3ad969436c2f9e9b0d3c592475eed9751cc7e6401000000000000000000a9db2e8247ff2e4227ab45004074878b6b723bc9ff6e9a6e32fe0f5cf407e416dcd9686ad43a021789c128b6',
};

const DRAND_ROUND_1000000 = {
  signature:
    '83ad29e4c409f9470fc2ef02f90214df49e02b441a1a241a82d622d9f608ef98fd8b11a029f1bee9d9e83b45088abe72',
  randomness: 'b22aad4794f7451896f7a371aa46106fd84d919f3f569acd5b2fddf1d1440af3',
};

describe('bitcoin proof of work', () => {
  it('accepts a real block header', () => {
    expect(() => checkProofOfWork(hexToBytes(BLOCK_960000.header), BLOCK_960000.hash)).not.toThrow();
  });

  it('rejects a header that does not match the hash', () => {
    const header = hexToBytes(BLOCK_960000.header);
    header[76] ^= 1;
    expect(() => checkProofOfWork(header, BLOCK_960000.hash)).toThrow(SourceError);
  });

  it('rejects a cheap fake block', () => {
    const header = hexToBytes(BLOCK_960000.header);
    header.set([0xff, 0xff, 0x00, 0x21], 72);
    const hash = bytesToHex(sha256(sha256(header)).reverse());
    expect(() => checkProofOfWork(header, hash)).toThrow('difficulty is too low');
  });
});

describe('bitcoin time estimate', () => {
  it('adds ten minutes per block', () => {
    expect(expectedTime(106, 100, 0)).toBe(3600);
  });

  it('expects at least one block for a block that is already due', () => {
    expect(expectedTime(100, 100, 0)).toBe(600);
  });
});

describe('new block notifications', () => {
  it('fire for a new block, not for the first list of blocks', () => {
    const sockets: FakeSocket[] = [];
    class FakeSocket extends EventTarget {
      sent: string[] = [];
      closed = false;
      constructor(readonly url: string) {
        super();
        sockets.push(this);
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {
        this.closed = true;
      }
      receive(data: string) {
        this.dispatchEvent(new MessageEvent('message', { data }));
      }
    }
    vi.stubGlobal('WebSocket', FakeSocket);
    const onBlock = vi.fn();
    const stop = watchNewBlocks(onBlock);
    const socket = sockets[0];
    socket.dispatchEvent(new Event('open'));
    expect(socket.sent).toEqual([JSON.stringify({ action: 'want', data: ['blocks'] })]);
    socket.receive(JSON.stringify({ blocks: [{ height: 1 }] }));
    socket.receive('not json');
    expect(onBlock).not.toHaveBeenCalled();
    socket.receive(JSON.stringify({ block: { height: 2 } }));
    expect(onBlock).toHaveBeenCalledOnce();
    stop();
    expect(socket.closed).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('drand', () => {
  it('verifies a real quicknet beacon', () => {
    const randomness = verifyBeacon(1000000, DRAND_ROUND_1000000.signature);
    expect(bytesToHex(randomness)).toBe(DRAND_ROUND_1000000.randomness);
  });

  it('rejects a signature for a different round', () => {
    expect(() => verifyBeacon(1000001, DRAND_ROUND_1000000.signature)).toThrow(SourceError);
  });

  it('maps time to rounds', () => {
    expect(roundTime(1)).toBe(QUICKNET.genesis);
    expect(firstRoundAtOrAfter(QUICKNET.genesis + 3)).toBe(2);
    expect(firstRoundAtOrAfter(QUICKNET.genesis + 4)).toBe(3);
    expect(roundTime(firstRoundAtOrAfter(QUICKNET.genesis + 4))).toBeGreaterThanOrEqual(QUICKNET.genesis + 4);
  });
});
