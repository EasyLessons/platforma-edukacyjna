// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { POST } from './route';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'email-test-123' }),
  });
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
});

// ─── Sukces ───────────────────────────────────────────────────────────────────

describe('POST /api/contact — poprawne dane', () => {
  it('200 i Resend wywołany z poprawnymi parametrami', async () => {
    const res = await POST(
      makeRequest({ name: 'Jan Kowalski', email: 'jan@example.com', message: 'Zapytanie o ofertę' })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(options.body as string);
    expect(body.to).toEqual(['kontakt@easylesson.app']);
    expect(body.html).toContain('Jan Kowalski');
    expect(body.html).toContain('Zapytanie o ofertę');
  });
});

describe('POST /api/contact — odbiorca z env', () => {
  it('CONTACT_TO_EMAIL nadpisuje domyślną skrzynkę', async () => {
    vi.stubEnv('CONTACT_TO_EMAIL', 'inbox@example.com');
    try {
      const res = await POST(makeRequest({ name: 'Jan', email: 'jan@example.com', message: 'test' }));
      expect(res.status).toBe(200);
      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.to).toEqual(['inbox@example.com']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

// ─── Błąd zewnętrznego API ────────────────────────────────────────────────────

describe('POST /api/contact — błąd Resend', () => {
  it('500 gdy Resend API zwraca błąd', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Resend error' }),
    });
    const res = await POST(makeRequest({ name: 'Jan', email: 'jan@example.com', message: 'test' }));
    expect(res.status).toBe(500);
  });

  it('500 gdy fetch rzuca wyjątek (brak sieci)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const res = await POST(makeRequest({ name: 'Jan', email: 'jan@example.com', message: 'test' }));
    expect(res.status).toBe(500);
  });
});
