import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/_new/lib/errors';
import { createBoardCall, isDailyRoomUrl } from './callApi';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/_new/lib/api', () => ({ apiClient: { post } }));

describe('createBoardCall', () => {
  beforeEach(() => post.mockReset());

  it('woła POST /api/v1/whiteboard/{id}/call bez body i zwraca pokój z tokenem', async () => {
    const token = crypto.randomUUID();
    post.mockResolvedValueOnce({
      data: { room_url: 'https://example.daily.co/r', token, expires_at: '2026-10-05T10:00:00Z' },
    });

    const call = await createBoardCall(42);

    expect(post).toHaveBeenCalledWith('/api/v1/whiteboard/42/call');
    expect(call).toEqual({
      room_url: 'https://example.daily.co/r',
      token,
      expires_at: '2026-10-05T10:00:00Z',
    });
  });

  it.each([[undefined], [null], [{}], [{ room_url: 'https://example.daily.co/r' }]])(
    'odpowiedź 2xx bez pokoju lub tokenu (%j) -> AppError zamiast undefined',
    async (data) => {
      post.mockResolvedValueOnce({ data });
      await expect(createBoardCall(1)).rejects.toBeInstanceOf(AppError);
    }
  );

  it.each([
    ['http://example.daily.co/r'],
    ['javascript:alert(1)'],
    ['data:text/html,<p>x</p>'],
    ['https://evil.example/r'],
    ['https://daily.co.evil.example/r'],
    ['https://evildaily.co/r'],
    ['https://example.daily.co.evil.example/r'],
    ['https://example.daily.co@evil.example/r'],
    ['https://user@example.daily.co/r'],
    ['https://example.daily.co:8443/r'],
    ['//example.daily.co/r'],
    ['/r'],
    [''],
  ])(
    'adres pokoju spoza https://*.daily.co (%s) -> AppError, bez zwracania tokenu',
    async (room_url) => {
      post.mockResolvedValueOnce({
        data: { room_url, token: crypto.randomUUID(), expires_at: '2026-10-05T10:00:00Z' },
      });
      await expect(createBoardCall(1)).rejects.toBeInstanceOf(AppError);
    }
  );

  it('isDailyRoomUrl przepuszcza adres konta Daily (także wielkimi literami w hoście)', () => {
    expect(isDailyRoomUrl('https://easylesson.daily.co/easylesson-board-42')).toBe(true);
    expect(isDailyRoomUrl('https://EasyLesson.Daily.co/r')).toBe(true);
  });
});
