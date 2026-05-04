import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordResetForm } from '../passwordResetForm';

const mockHandleEmailChange = vi.fn();
const mockHandleSendEmail = vi.fn((e: React.FormEvent) => e.preventDefault());
const mockHandleCodeVerified = vi.fn();
const mockHandleCodeResend = vi.fn();
const mockHandlePasswordChange = vi.fn();
const mockHandlePasswordConfirmChange = vi.fn();
const mockHandleResetPassword = vi.fn((e: React.FormEvent) => e.preventDefault());

const baseHook = {
  step: 'email' as 'email' | 'code' | 'password',
  email: '',
  emailErrors: {},
  emailError: '',
  emailLoading: false,
  handleEmailChange: mockHandleEmailChange,
  handleSendEmail: mockHandleSendEmail,
  handleCodeVerified: mockHandleCodeVerified,
  handleCodeResend: mockHandleCodeResend,
  password: '',
  passwordConfirm: '',
  passwordErrors: {},
  passwordError: '',
  passwordLoading: false,
  handlePasswordChange: mockHandlePasswordChange,
  handlePasswordConfirmChange: mockHandlePasswordConfirmChange,
  handleResetPassword: mockHandleResetPassword,
  setStep: vi.fn(),
};

let mockHookReturn = { ...baseHook };

vi.mock('../../hooks/usePasswordReset', () => ({ usePasswordReset: () => mockHookReturn }));
vi.mock('../codeInput', () => ({
  CodeInput: ({ onVerify, onResend }: { onVerify: () => void; onResend: () => void }) => (
    <div data-testid="code-input">
      <button onClick={onVerify}>Zweryfikuj</button>
      <button onClick={onResend}>Wyślij ponownie</button>
    </div>
  ),
}));

describe('PasswordResetForm', () => {
  describe('krok email', () => {
    it('renderuje pole email i przycisk wysyłania', () => {
      render(<PasswordResetForm />);
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Wyślij kod' })).toBeInTheDocument();
    });

    it('wywołuje handleSendEmail po submitcie', () => {
      render(<PasswordResetForm />);
      fireEvent.submit(screen.getByRole('button', { name: 'Wyślij kod' }).closest('form')!);
      expect(mockHandleSendEmail).toHaveBeenCalled();
    });
  });

  describe('krok code', () => {
    it('renderuje CodeInput', () => {
      mockHookReturn = { ...baseHook, step: 'code' };
      render(<PasswordResetForm />);
      expect(screen.getByTestId('code-input')).toBeInTheDocument();
    });

    it('przekazuje handleCodeVerified i handleCodeResend do CodeInput', () => {
      mockHookReturn = { ...baseHook, step: 'code' };
      render(<PasswordResetForm />);
      fireEvent.click(screen.getByRole('button', { name: 'Zweryfikuj' }));
      expect(mockHandleCodeVerified).toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Wyślij ponownie' }));
      expect(mockHandleCodeResend).toHaveBeenCalled();
    });
  });

  describe('krok password', () => {
    it('renderuje pola nowego hasła', () => {
      mockHookReturn = { ...baseHook, step: 'password' };
      render(<PasswordResetForm />);
      expect(screen.getByPlaceholderText('Nowe hasło')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Powtórz hasło')).toBeInTheDocument();
    });

    it('wywołuje handleResetPassword po submitcie', () => {
      mockHookReturn = { ...baseHook, step: 'password' };
      render(<PasswordResetForm />);
      fireEvent.submit(screen.getByRole('button', { name: 'Zmień hasło' }).closest('form')!);
      expect(mockHandleResetPassword).toHaveBeenCalled();
    });
  });
});