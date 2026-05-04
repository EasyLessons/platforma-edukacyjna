import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthCallback } from '../useAuthCallback';
import { mockUser } from '../../../../../test/mocks/authFixtures';

const mockReplace = vi.fn();
const mockAuthLogin = vi.fn();
const mockSearchParams = { get: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ login: mockAuthLogin }),
}));

const validToken = 'access-token-123';
const validUserEncoded = btoa(JSON.stringify(mockUser));

describe('useAuthCallback', () => {
  beforeEach(() => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'token') return validToken;
      if (key === 'user') return validUserEncoded;
      if (key === 'error') return null;
      return null;
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'opener', { value: null, writable: true });
  });

  describe('bez window.opener (bezpośrednie przekierowanie)', () => {
    it('wywołuje login i przekierowuje na /dashboard po sukcesie', () => {
      renderHook(() => useAuthCallback());
      expect(mockAuthLogin).toHaveBeenCalledWith(validToken, mockUser);
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    it('przekierowuje na /login gdy error w URL', () => {
      mockSearchParams.get.mockImplementation((key: string) =>
        key === 'error' ? 'access_denied' : null
      );
      renderHook(() => useAuthCallback());
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(mockAuthLogin).not.toHaveBeenCalled();
    });

    it('przekierowuje na /login gdy brak tokenu', () => {
      mockSearchParams.get.mockImplementation((key: string) =>
        key === 'user' ? validUserEncoded : null
      );
      renderHook(() => useAuthCallback());
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('przekierowuje na /login przy nieprawidłowym base64', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'token') return validToken;
        if (key === 'user') return 'nie-base64!!!';
        return null;
      });
      renderHook(() => useAuthCallback());
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  describe('z window.opener (tryb popup)', () => {
    const mockPostMessage = vi.fn();

    beforeEach(() => {
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });
      vi.spyOn(window, 'close').mockImplementation(() => {});
    });

    it('wysyła GOOGLE_AUTH_SUCCESS i zamyka okno po sukcesie', () => {
      renderHook(() => useAuthCallback());
      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'GOOGLE_AUTH_SUCCESS', token: validToken, userData: mockUser },
        window.location.origin
      );
      expect(window.close).toHaveBeenCalled();
    });

    it('wysyła GOOGLE_AUTH_ERROR i zamyka okno gdy error w URL', () => {
      mockSearchParams.get.mockImplementation((key: string) =>
        key === 'error' ? 'access_denied' : null
      );
      renderHook(() => useAuthCallback());
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GOOGLE_AUTH_ERROR' }),
        window.location.origin
      );
      expect(window.close).toHaveBeenCalled();
    });

    it('wysyła GOOGLE_AUTH_ERROR przy nieprawidłowym base64', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'token') return validToken;
        if (key === 'user') return 'nie-base64!!!';
        return null;
      });
      renderHook(() => useAuthCallback());
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GOOGLE_AUTH_ERROR' }),
        window.location.origin
      );
    });
  });
});