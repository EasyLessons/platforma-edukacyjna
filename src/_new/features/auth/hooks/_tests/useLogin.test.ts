import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogin } from '../useLogin';
import { loginUser, checkUser } from '../../api/authApi';
import { AppError } from '@/_new/lib/errors';
import { mockLoginResponse } from '@/test/mocks/authFixtures';

const mockPush = vi.fn();
const mockAuthLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ login: mockAuthLogin }),
}));

vi.mock('../../api/authApi', () => ({
  loginUser: vi.fn(),
  checkUser: vi.fn(),
}));

describe('useLogin', () => {
  beforeEach(() => {
    vi.mocked(loginUser).mockResolvedValue(mockLoginResponse);
    vi.mocked(checkUser).mockResolvedValue({ exists: true, verified: false, user_id: 5 });
  });

  const setup = () => renderHook(() => useLogin());

  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  const fillForm = (result: ReturnType<typeof setup>['result'], login = 'test@example.com', password = 'Pass1word') => {
    act(() => {
      result.current.handleChange({ target: { name: 'login', value: login } } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: password } } as React.ChangeEvent<HTMLInputElement>);
    });
  };

  it('inicjalizuje pusty formularz', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({ login: '', password: '' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.generalError).toBe('');
    expect(result.current.errors).toEqual({});
  });

  describe('handleChange', () => {
    it('aktualizuje pole formularza', () => {
      const { result } = setup();
      act(() => {
        result.current.handleChange({ target: { name: 'login', value: 'jan@example.com' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.formData.login).toBe('jan@example.com');
    });

    it('czyści błąd pola i generalError', () => {
      const { result } = setup();
      act(() => {
        result.current.handleChange({ target: { name: 'login', value: 'bad' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { name: 'login', value: 'ok@ok.com' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.errors.login).toBeFalsy();
      expect(result.current.generalError).toBe('');
    });
  });

  describe('walidacja formularza', () => {
    it('ustawia errors.login dla nieprawidłowego emaila', async () => {
      const { result } = setup();
      fillForm(result, 'nieprawidlowy-email');
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.login).toBeTruthy();
      expect(loginUser).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('wywołuje authLogin z tokenem i użytkownikiem', async () => {
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(mockAuthLogin).toHaveBeenCalledWith(mockLoginResponse.access_token, mockLoginResponse.user);
    });

    it('przekierowuje na /dashboard', async () => {
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('handleSubmit — błędy API', () => {
    it('ustawia generalError przy 401 (błędne hasło)', async () => {
      vi.mocked(loginUser).mockRejectedValue(new AppError('Unauthorized', 'AUTH_ERROR', 401));
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.generalError).toBe('Błędny email lub hasło');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('przekierowuje na /verify przy 403 gdy konto niezweryfikowane', async () => {
      vi.mocked(loginUser).mockRejectedValue(new AppError('Forbidden', 'AUTH_ERROR', 403));
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(mockPush).toHaveBeenCalledWith('/verify?userId=5&email=test%40example.com');
    });

    it('ustawia generalError przy 403 gdy checkUser nie zwraca user_id', async () => {
      vi.mocked(loginUser).mockRejectedValue(new AppError('Forbidden', 'AUTH_ERROR', 403));
      vi.mocked(checkUser).mockResolvedValue({ exists: false, verified: false });
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.generalError).toBe('Konto niezweryfikowane. Sprawdź email.');
    });

    it('ustawia isLoading false po błędzie', async () => {
      vi.mocked(loginUser).mockRejectedValue(new AppError('Unauthorized', 'AUTH_ERROR', 401));
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.isLoading).toBe(false);
    });
  });
});