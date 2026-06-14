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
    expect(body.to).toContain('easylesson@interia.pl');
    expect(body.html).toContain('Jan Kowalski');
    expect(body.html).toContain('Zapytanie o ofertę');
  });
});

// ─── Błąd zewnętrznego API ────────────────────────────────────────────────────

describe('POST /api/contact — błąd Resend', () => {
  it('500 gdy Resend API zwraca błąd', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Resend error' }),
    });
    const res = await POST(
      makeRequest({ name: 'Jan', email: 'jan@example.com', message: 'test' })
    );
    expect(res.status).toBe(500);
  });

  it('500 gdy fetch rzuca wyjątek (brak sieci)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const res = await POST(
      makeRequest({ name: 'Jan', email: 'jan@example.com', message: 'test' })
    );
    expect(res.status).toBe(500);
  });
});
