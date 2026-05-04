import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasswordReset } from '../usePasswordReset';
import { requestPasswordReset, verifyResetCode, resetPassword } from '../../api/authApi';
import { AppError } from '@/_new/lib/errors';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('../../api/authApi', () => ({
  requestPasswordReset: vi.fn(),
  verifyResetCode: vi.fn(),
  resetPassword: vi.fn(),
}));

describe('usePasswordReset', () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ message: 'OK' });
    vi.mocked(verifyResetCode).mockResolvedValue({ message: 'OK', valid: true });
    vi.mocked(resetPassword).mockResolvedValue({ message: 'OK' });
  });

  const setup = () => renderHook(() => usePasswordReset());
  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  it('inicjalizuje stan na krok email', () => {
    const { result } = setup();
    expect(result.current.step).toBe('email');
    expect(result.current.email).toBe('');
    expect(result.current.emailLoading).toBe(false);
  });

  describe('krok 1 — email', () => {
    it('ustawia błąd dla nieprawidłowego emaila', async () => {
      const { result } = setup();
      act(() => { result.current.handleEmailChange('zly'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      expect(result.current.emailErrors.email).toBeTruthy();
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it('przechodzi do kroku code po sukcesie', async () => {
      const { result } = setup();
      act(() => { result.current.handleEmailChange('jan@example.com'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'jan@example.com' });
      expect(result.current.step).toBe('code');
    });

    it('ustawia emailError przy błędzie API', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(new AppError('Nie znaleziono', 'NOT_FOUND', 404));
      const { result } = setup();
      act(() => { result.current.handleEmailChange('jan@example.com'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      expect(result.current.emailError).toBeTruthy();
      expect(result.current.step).toBe('email');
    });
  });

  describe('krok 2 — kod', () => {
    it('przechodzi do kroku password po weryfikacji kodu', async () => {
      const { result } = setup();
      act(() => { result.current.handleEmailChange('jan@example.com'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      await act(async () => { await result.current.handleCodeVerified('123456'); });
      expect(result.current.step).toBe('password');
    });

    it('rzuca gdy kod nieprawidłowy — useCodeInput to obsługuje', async () => {
      vi.mocked(verifyResetCode).mockRejectedValue(new AppError('Zły kod', 'VALIDATION_ERROR', 422));
      const { result } = setup();
      await expect(
        act(async () => { await result.current.handleCodeVerified('000000'); })
      ).rejects.toThrow();
    });

    it('handleCodeResend ponownie wysyła email', async () => {
      const { result } = setup();
      act(() => { result.current.handleEmailChange('jan@example.com'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      await act(async () => { await result.current.handleCodeResend(); });
      expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    });
  });

  describe('krok 3 — nowe hasło', () => {
    const goToPasswordStep = async (result: ReturnType<typeof setup>['result']) => {
      act(() => { result.current.handleEmailChange('jan@example.com'); });
      await act(async () => { await result.current.handleSendEmail(fakeEvent); });
      await act(async () => { await result.current.handleCodeVerified('123456'); });
    };

    it('ustawia błąd dla słabego hasła', async () => {
      const { result } = setup();
      await goToPasswordStep(result);
      act(() => {
        result.current.handlePasswordChange('slabe');
        result.current.handlePasswordConfirmChange('slabe');
      });
      await act(async () => { await result.current.handleResetPassword(fakeEvent); });
      expect(result.current.passwordErrors.password).toBeTruthy();
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('ustawia błąd gdy hasła się nie zgadzają', async () => {
      const { result } = setup();
      await goToPasswordStep(result);
      act(() => {
        result.current.handlePasswordChange('Mocne1haslo');
        result.current.handlePasswordConfirmChange('Inne1haslo');
      });
      await act(async () => { await result.current.handleResetPassword(fakeEvent); });
      expect(result.current.passwordErrors.password_confirm).toBeTruthy();
    });

    it('przekierowuje na /login?reset=success po sukcesie', async () => {
      const { result } = setup();
      await goToPasswordStep(result);
      act(() => {
        result.current.handlePasswordChange('Mocne1haslo');
        result.current.handlePasswordConfirmChange('Mocne1haslo');
      });
      await act(async () => { await result.current.handleResetPassword(fakeEvent); });
      expect(mockPush).toHaveBeenCalledWith('/login?reset=success');
    });
  });
});