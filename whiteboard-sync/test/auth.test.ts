import { afterEach, describe, expect, it, vi } from 'vitest';
import { onAuthenticate } from '../src/auth';
import { mockAccess } from './backend-mock';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function failureReason(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    return (err as { reason?: string }).reason;
  }
  throw new Error('oczekiwano odmowy autoryzacji');
}

describe('onAuthenticate', () => {
  it('editor: kontekst z tokenem, połączenie do zapisu', async () => {
    const fetchMock = mockAccess({ ok: { status: 200, role: 'editor', can_edit: true } });
    const connection = { readOnly: false };

    const ctx = await onAuthenticate({ token: 'ok', documentName: '12', connection });

    expect(ctx).toMatchObject({ userId: 7, token: 'ok', canEdit: true });
    expect(connection.readOnly).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/whiteboard\/12\/access$/);
  });

  it('viewer: połączenie tylko do odczytu', async () => {
    mockAccess({ v: { status: 200, role: 'viewer', can_edit: false } });
    const connection = { readOnly: false };

    const ctx = await onAuthenticate({ token: 'v', documentName: '12', connection });

    expect(ctx.canEdit).toBe(false);
    expect(connection.readOnly).toBe(true);
  });

  it('backend bez pola can_edit (sprzed ról): zachowanie jak dotąd, do zapisu', async () => {
    mockAccess({ old: { status: 200 } });
    const connection = { readOnly: false };
    await onAuthenticate({ token: 'old', documentName: '12', connection });
    expect(connection.readOnly).toBe(false);
  });

  it('brak tokenu -> token-expired (bez pytania backendu)', async () => {
    const fetchMock = mockAccess({});
    expect(await failureReason(onAuthenticate({ documentName: '12' }))).toBe('token-expired');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nieliczbowe id tablicy -> access-denied', async () => {
    mockAccess({ ok: { status: 200, can_edit: true } });
    expect(await failureReason(onAuthenticate({ token: 'ok', documentName: 'demo-abc' }))).toBe(
      'access-denied'
    );
  });

  it('401 -> token-expired', async () => {
    mockAccess({ t: { status: 401 } });
    expect(await failureReason(onAuthenticate({ token: 't', documentName: '1' }))).toBe('token-expired');
  });

  it('403 i 404 -> access-denied', async () => {
    mockAccess({ a: { status: 403 }, b: { status: 404 } });
    expect(await failureReason(onAuthenticate({ token: 'a', documentName: '1' }))).toBe('access-denied');
    expect(await failureReason(onAuthenticate({ token: 'b', documentName: '1' }))).toBe('access-denied');
  });

  it('5xx -> server-unavailable', async () => {
    mockAccess({ t: { status: 503 } });
    expect(await failureReason(onAuthenticate({ token: 't', documentName: '1' }))).toBe(
      'server-unavailable'
    );
  });

  it('backend nieosiągalny -> server-unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await failureReason(onAuthenticate({ token: 't', documentName: '1' }))).toBe(
      'server-unavailable'
    );
  });
});
