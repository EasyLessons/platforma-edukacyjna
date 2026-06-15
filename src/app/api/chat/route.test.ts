// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@google/generative-ai', () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: { text: () => 'Odpowiedź AI: 2+2=4' },
  });
  const mockGetGenerativeModel = vi.fn().mockReturnValue({ generateContent: mockGenerateContent });
  function MockGoogleGenerativeAI() {
    return { getGenerativeModel: mockGetGenerativeModel };
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

import { POST, GET } from './route';

const makeRequest = (body: unknown, ip = '127.0.0.1') =>
  new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];

// ─── GET /api/chat ────────────────────────────────────────────────────────────

describe('GET /api/chat', () => {
  it('zwraca status ok ze statystykami serwisu', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(typeof data.cacheSize).toBe('number');
    expect(typeof data.activeUsers).toBe('number');
  });
});

// ─── POST /api/chat — walidacja ───────────────────────────────────────────────

describe('POST /api/chat — walidacja wejścia', () => {
  it('400 gdy brak pola message', async () => {
    const res = await POST(makeRequest({}, '10.1.0.1'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_message');
  });

  it('400 gdy message nie jest stringiem', async () => {
    const res = await POST(makeRequest({ message: 42 }, '10.1.0.2'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_message');
  });

  it('400 gdy message jest pustym stringiem (po trim)', async () => {
    const res = await POST(makeRequest({ message: '   ' }, '10.1.0.3'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('too_short');
  });

  it('400 gdy message przekracza 1000 znaków', async () => {
    const res = await POST(makeRequest({ message: 'a'.repeat(1001) }, '10.1.0.4'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('too_long');
  });
});

// ─── POST /api/chat — happy path ──────────────────────────────────────────────

describe('POST /api/chat — poprawne zapytanie', () => {
  it('200 przy sukcesie — zwraca odpowiedź AI', async () => {
    const res = await POST(makeRequest({ message: 'ile to 2+2?' }, '10.2.0.1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBeTruthy();
    expect(data.cached).toBe(false);
    expect(data.apiUsed).toBe(true);
  });

  it('200 z cache przy powtórzeniu tego samego pytania', async () => {
    const ip = '10.2.0.2';
    const msg = 'pytanie do cache unikalne abc999xyz';

    await POST(makeRequest({ message: msg }, ip));
    const res = await POST(makeRequest({ message: msg }, ip));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cached).toBe(true);
  });

  it('cache ignoruje wielkość liter w pytaniu', async () => {
    const ip = '10.2.0.3';
    const msg = 'UniKalne Pytanie CaSe 777';

    await POST(makeRequest({ message: msg }, ip));
    const res = await POST(makeRequest({ message: msg.toLowerCase() }, ip));

    expect(res.status).toBe(200);
    expect((await res.json()).cached).toBe(true);
  });
});

// ─── POST /api/chat — rate limiting ───────────────────────────────────────────

describe('POST /api/chat — rate limiting', () => {
  it('429 po przekroczeniu 20 żądań z tego samego IP', async () => {
    const ip = '10.3.0.1';
    const msg = 'rate limit test unikalne zyx321abc';

    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ message: msg }, ip));
    }

    const res = await POST(makeRequest({ message: msg }, ip));
    expect(res.status).toBe(429);
  });
});
