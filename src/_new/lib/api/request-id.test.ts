import { describe, it, expect } from 'vitest';
import { newRequestId, readRequestIdHeader, REQUEST_ID_HEADER } from './request-id';

describe('newRequestId', () => {
  it('zwraca 32 znaki hex (format akceptowany przez backend) i różne wartości', () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('działa bez crypto.randomUUID (fallback)', () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      expect(newRequestId()).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe('readRequestIdHeader', () => {
  it('czyta nagłówek w obu wariantach wielkości liter', () => {
    expect(readRequestIdHeader({ 'x-request-id': 'abc' })).toBe('abc');
    expect(readRequestIdHeader({ [REQUEST_ID_HEADER]: 'def' })).toBe('def');
  });

  it('zwraca undefined dla braku nagłówka lub pustej wartości', () => {
    expect(readRequestIdHeader(undefined)).toBeUndefined();
    expect(readRequestIdHeader({})).toBeUndefined();
    expect(readRequestIdHeader({ 'x-request-id': '' })).toBeUndefined();
    expect(readRequestIdHeader({ 'x-request-id': 42 })).toBeUndefined();
  });
});
