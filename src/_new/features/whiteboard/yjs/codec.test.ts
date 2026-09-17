import { describe, it, expect } from 'vitest';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  splitIntoChunks,
  createChunkCollector,
} from './codec';

describe('uint8ArrayToBase64 / base64ToUint8Array', () => {
  it('round-trip dla pustej tablicy', () => {
    const bytes = new Uint8Array([]);
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes);
  });

  it('round-trip dla małej tablicy', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128, 64]);
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes);
  });

  it('round-trip dla dużej tablicy (>32K — testuje pętlę chunkującą fromCharCode)', () => {
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes);
  });
});

describe('splitIntoChunks', () => {
  it('pusty string -> jeden pusty kawałek', () => {
    expect(splitIntoChunks('', 10)).toEqual(['']);
  });

  it('krótszy niż chunkSize -> jeden kawałek', () => {
    expect(splitIntoChunks('abc', 10)).toEqual(['abc']);
  });

  it('dzieli równo i z resztą', () => {
    expect(splitIntoChunks('abcdefghij', 3)).toEqual(['abc', 'def', 'ghi', 'j']);
  });
});

describe('createChunkCollector', () => {
  it('jeden kawałek (totalChunks=1) składa się od razu', () => {
    const collector = createChunkCollector();
    const result = collector.collect({
      transmissionId: 't1',
      chunkIndex: 0,
      totalChunks: 1,
      data: 'hello',
    });
    expect(result).toBe('hello');
  });

  it('wiele kawałków w kolejności - składa dopiero po ostatnim', () => {
    const collector = createChunkCollector();
    expect(
      collector.collect({ transmissionId: 't1', chunkIndex: 0, totalChunks: 3, data: 'a' })
    ).toBeNull();
    expect(
      collector.collect({ transmissionId: 't1', chunkIndex: 1, totalChunks: 3, data: 'b' })
    ).toBeNull();
    expect(
      collector.collect({ transmissionId: 't1', chunkIndex: 2, totalChunks: 3, data: 'c' })
    ).toBe('abc');
  });

  it('kawałki nie po kolei - nadal składa poprawnie po ostatnim brakującym', () => {
    const collector = createChunkCollector();
    collector.collect({ transmissionId: 't1', chunkIndex: 2, totalChunks: 3, data: 'c' });
    collector.collect({ transmissionId: 't1', chunkIndex: 0, totalChunks: 3, data: 'a' });
    const result = collector.collect({
      transmissionId: 't1',
      chunkIndex: 1,
      totalChunks: 3,
      data: 'b',
    });
    expect(result).toBe('abc');
  });

  it('dwie przeplecione transmisje (różne transmissionId) nie mieszają się', () => {
    const collector = createChunkCollector();
    collector.collect({ transmissionId: 't1', chunkIndex: 0, totalChunks: 2, data: 'A' });
    collector.collect({ transmissionId: 't2', chunkIndex: 0, totalChunks: 2, data: 'X' });
    const r1 = collector.collect({
      transmissionId: 't1',
      chunkIndex: 1,
      totalChunks: 2,
      data: 'B',
    });
    const r2 = collector.collect({
      transmissionId: 't2',
      chunkIndex: 1,
      totalChunks: 2,
      data: 'Y',
    });
    expect(r1).toBe('AB');
    expect(r2).toBe('XY');
  });
});
