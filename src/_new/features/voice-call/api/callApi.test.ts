import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/_new/lib/errors';
import { createBoardCall } from './callApi';

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
});
