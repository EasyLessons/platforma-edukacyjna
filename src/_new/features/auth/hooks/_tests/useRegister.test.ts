import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegister } from '../useRegister';
import { registerUser, checkUser } from '../../api/authApi';
import { AppError } from '@/_new/lib/errors';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('../../api/authApi', () => ({
  registerUser: vi.fn(),
  checkUser: vi.fn(),
}));

describe('useRegister', () => {
  beforeEach(() => {
    vi.mocked(registerUser).mockResolvedValue({ user_id: 42, email: 'jan@example.com', message: 'OK' });
    vi.mocked(checkUser).mockResolvedValue({ exists: true, verified: false, user_id: 42 });
  });

  const setup = () => renderHook(() => useRegister());
  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  const fillForm = (result: ReturnType<typeof setup>['result']) => {
    act(() => {
      result.current.handleChange({ target: { name: 'username', value: 'janek' } } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'email', value: 'jan@example.com' } } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'Pass1word' } } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password_confirm', value: 'Pass1word' } } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleTermsChange(true);
    });
  };

  it('inicjalizuje pusty formularz', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({ username: '', email: '', password: '', password_confirm: '' });
    expect(result.current.acceptTerms).toBe(false);
    expect(result.current.generalError).toBe('');
  });

  describe('walidacja', () => {
    it('ustawia błąd gdy regulamin niezaakceptowany', async () => {
      const { result } = setup();
      act(() => {
        result.current.handleChange({ target: { name: 'username', value: 'janek' } } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'jan@example.com' } } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Pass1word' } } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password_confirm', value: 'Pass1word' } } as React.ChangeEvent<HTMLInputElement>);
      });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.generalError).toBe('Musisz zaakceptować regulamin');
      expect(registerUser).not.toHaveBeenCalled();
    });

    it('ustawia błąd dla nieprawidłowego emaila', async () => {
      const { result } = setup();
      act(() => {
        result.current.handleChange({ target: { name: 'email', value: 'zly-email' } } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleTermsChange(true);
      });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.email).toBeTruthy();
      expect(registerUser).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('przekierowuje na /verify z user_id i emailem', async () => {
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(mockPush).toHaveBeenCalledWith('/verify?userId=42&email=jan%40example.com');
    });
  });

  describe('handleSubmit — konflikt 409', () => {
    beforeEach(() => {
      vi.mocked(registerUser).mockRejectedValue(new AppError('Konflikt', 'CONFLICT', 409));
    });

    it('pokazuje błąd gdy konto już istnieje i jest zweryfikowane', async () => {
      vi.mocked(checkUser).mockResolvedValue({ exists: true, verified: true, user_id: 42 });
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.generalError).toBe('To konto już istnieje. Przejdź do logowania.');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('przekierowuje na /verify gdy konto istnieje ale niezweryfikowane', async () => {
      const { result } = setup();
      fillForm(result);
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(mockPush).toHaveBeenCalledWith('/verify?userId=42&email=jan%40example.com');
    });
  });
});