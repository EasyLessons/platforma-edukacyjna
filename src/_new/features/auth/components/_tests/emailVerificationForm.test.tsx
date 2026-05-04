import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailVerificationForm } from '../emailVerificationForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../api/authApi', () => ({
  verifyEmail: vi.fn().mockResolvedValue({}),
  resendVerificationCode: vi.fn().mockResolvedValue({}),
}));
vi.mock('../codeInput', () => ({
  CodeInput: () => <div data-testid="code-input" />,
}));

describe('EmailVerificationForm', () => {
  it('zwraca null gdy brak userId', () => {
    const { container } = render(<EmailVerificationForm userId="" email="jan@example.com" />);
    expect(container.firstChild).toBeNull();
  });

  it('zwraca null gdy brak email', () => {
    const { container } = render(<EmailVerificationForm userId="1" email="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderuje CodeInput gdy props są poprawne', () => {
    render(<EmailVerificationForm userId="1" email="jan@example.com" />);
    expect(screen.getByTestId('code-input')).toBeInTheDocument();
  });

  it('renderuje podpowiedź o folderze spam', () => {
    render(<EmailVerificationForm userId="1" email="jan@example.com" />);
    expect(screen.getByText(/folder spam/i)).toBeInTheDocument();
  });
});