import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import { AppError } from '@new/lib/errors/AppError';
import { mockUser } from '@/test/mocks/authFixtures';
import { AVATAR_MAX_BYTES, uploadAvatar, validateAvatarFile } from './avatarApi';

vi.mock('@new/lib/auth', () => ({
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
  refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
  logoutAndRedirect: vi.fn(),
  removeAccessToken: vi.fn(),
  getStoredUser: vi.fn(() => null),
  setStoredUser: vi.fn(),
  removeStoredUser: vi.fn(),
}));

const mock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

beforeEach(() => mock.reset());
afterAll(() => mock.restore());

const AVATAR_URL = '/api/v1/auth/users/me/avatar';

function makeFile(type = 'image/png', size = 10, name = 'avatar.png'): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('uploadAvatar', () => {
  it('wysyła plik do backendu jako multipart w polu "file"', async () => {
    const updated = { ...mockUser, avatar_url: 'https://x.supabase.co/a.webp' };
    mock.onPost(AVATAR_URL).reply(200, { success: true, data: updated });
    const file = makeFile();

    const result = await uploadAvatar(file);

    expect(result.avatar_url).toBe('https://x.supabase.co/a.webp');
    expect(mock.history.post).toHaveLength(1);
    const request = mock.history.post[0];
    expect(request.data).toBeInstanceOf(FormData);
    expect((request.data as FormData).get('file')).toBe(file);
    // Domyślny JSON-owy Content-Type klienta jest zdjęty — boundary ustawi przeglądarka.
    expect(request.headers?.['Content-Type']).not.toBe('application/json');
  });

  it('nie odwołuje się do Supabase ani do starego PUT /users/me', async () => {
    mock.onPost(AVATAR_URL).reply(200, { success: true, data: mockUser });

    await uploadAvatar(makeFile());

    expect(mock.history.put).toHaveLength(0);
    expect(mock.history.post.map((r) => r.url)).toEqual([AVATAR_URL]);
  });

  it('rzuca AppError z kodem i komunikatem backendu przy 400', async () => {
    mock.onPost(AVATAR_URL).reply(400, {
      success: false,
      error: 'Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP',
      code: 'INVALID_FILE_TYPE',
    });

    await expect(uploadAvatar(makeFile())).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof AppError &&
        e.status === 400 &&
        e.code === 'INVALID_FILE_TYPE' &&
        e.message === 'Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP'
    );
  });

  it('rzuca AppError przy 413 i 503', async () => {
    mock.onPost(AVATAR_URL).replyOnce(413, { success: false, code: 'FILE_TOO_LARGE' });
    await expect(uploadAvatar(makeFile())).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.status === 413
    );

    mock.onPost(AVATAR_URL).replyOnce(503, { success: false, code: 'STORAGE_NOT_CONFIGURED' });
    await expect(uploadAvatar(makeFile())).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === 'STORAGE_NOT_CONFIGURED'
    );
  });
});

describe('validateAvatarFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('przepuszcza %s', (type) => {
    expect(validateAvatarFile(makeFile(type))).toBeNull();
  });

  it.each(['image/svg+xml', 'image/gif', 'text/html', 'application/pdf', ''])(
    'odrzuca typ "%s"',
    (type) => {
      expect(validateAvatarFile(makeFile(type))).toMatch(/JPG, PNG lub WEBP/);
    }
  );

  it('odrzuca plik większy niż limit', () => {
    expect(validateAvatarFile(makeFile('image/png', AVATAR_MAX_BYTES + 1))).toMatch(/za duże/);
  });

  it('przepuszcza plik dokładnie na limicie', () => {
    expect(validateAvatarFile(makeFile('image/png', AVATAR_MAX_BYTES))).toBeNull();
  });
});
