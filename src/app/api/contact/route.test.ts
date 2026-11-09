// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { POST, MAX_MESSAGE_LENGTH } from './route';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Limiter jest w pamięci modułu, więc każdy test dostaje własne IP (nagłówek X-Forwarded-For).
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

const makeRequest = (body: unknown, ip: string = nextIp(), raw = false) =>
  new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: raw ? (body as string) : JSON.stringify(body),
  });

const valid = { name: 'Jan Kowalski', email: 'jan@example.com', message: 'Zapytanie o ofertę' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key-not-real');
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'email-test-123' }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Walidacja ────────────────────────────────────────────────────────────────

describe('POST /api/contact — walidacja', () => {
  it('400 gdy brak pola name', async () => {
    const res = await POST(makeRequest({ email: 'jan@example.com', message: 'Cześć' }));
    expect(res.status).toBe(400);
  });

  it('400 gdy brak pola email', async () => {
    const res = await POST(makeRequest({ name: 'Jan', message: 'Cześć' }));
    expect(res.status).toBe(400);
  });

  it('400 gdy brak pola message', async () => {
    const res = await POST(makeRequest({ name: 'Jan', email: 'jan@example.com' }));
    expect(res.status).toBe(400);
  });

  it('400 gdy email nie zawiera @', async () => {
    const res = await POST(makeRequest({ name: 'Jan', email: 'niemail.com', message: 'Cześć' }));
    expect(res.status).toBe(400);
  });

  it('400 gdy email nie zawiera kropki', async () => {
    const res = await POST(makeRequest({ name: 'Jan', email: 'jan@example', message: 'Cześć' }));
    expect(res.status).toBe(400);
  });

  it('400 gdy body nie jest JSON-em (nie 500)', async () => {
    const res = await POST(makeRequest('{nie json', nextIp(), true));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('400 gdy pola nie są tekstem', async () => {
    const res = await POST(makeRequest({ name: ['Jan'], email: 5, message: { a: 1 } }));
    expect(res.status).toBe(400);
  });

  it('400 gdy wiadomość przekracza limit długości, Resend nie jest wołany', async () => {
    const res = await POST(makeRequest({ ...valid, message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Ochrona przed spamem ─────────────────────────────────────────────────────

describe('POST /api/contact — honeypot i limit', () => {
  it('wypełnione pole website = udany "sukces" bez wysyłki maila', async () => {
    const res = await POST(makeRequest({ ...valid, website: 'http://spam.example' }));
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('6. wiadomość z tego samego IP w oknie dostaje 429', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(valid, ip))).status).toBe(200);
    }
    const res = await POST(makeRequest(valid, ip));
    expect(res.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('limit liczy się per IP - inne IP przechodzi', async () => {
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
  });
});

// ─── Sukces ───────────────────────────────────────────────────────────────────

describe('POST /api/contact — poprawne dane', () => {
  it('200 i Resend wywołany z treścią jako text (bez html), reply_to = nadawca', async () => {
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(options.body as string);
    expect(body.to).toEqual(['kontakt@easylesson.app']);
    expect(body.reply_to).toBe('jan@example.com');
    expect(body.html).toBeUndefined();
    expect(body.text).toContain('Jan Kowalski');
    expect(body.text).toContain('Zapytanie o ofertę');
  });

  it('HTML w treści trafia do maila jako zwykły tekst', async () => {
    await POST(makeRequest({ ...valid, message: '<img src=x onerror=alert(1)>' }));
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain('<img src=x onerror=alert(1)>');
    expect(body.html).toBeUndefined();
  });
});

describe('POST /api/contact — konfiguracja', () => {
  it('CONTACT_TO_EMAIL nadpisuje domyślną skrzynkę', async () => {
    vi.stubEnv('CONTACT_TO_EMAIL', 'inbox@example.com');
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.to).toEqual(['inbox@example.com']);
  });

  it('500 bez wołania Resend, gdy brak RESEND_API_KEY', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Błąd zewnętrznego API ────────────────────────────────────────────────────

describe('POST /api/contact — błąd Resend', () => {
  it('500 gdy Resend API zwraca błąd', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Resend error' }),
    });
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(500);
  });

  it('500 gdy fetch rzuca wyjątek (brak sieci)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(500);
  });
});
