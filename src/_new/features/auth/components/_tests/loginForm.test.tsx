import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../loginForm';

const mockHandleChange = vi.fn();
const mockHandleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

vi.mock('../../hooks/useLogin', () => ({
  useLogin: () => ({
    formData: { login: '', password: '' },
    errors: {},
    isLoading: false,
    generalError: '',
    handleChange: mockHandleChange,
    handleSubmit: mockHandleSubmit,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('LoginForm', () => {
  it('renderuje pola login i hasło', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText('Login')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('renderuje przycisk logowania', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeInTheDocument();
  });

  it('renderuje linki do rejestracji i resetowania hasła', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Zapomniałeś hasła?' })).toHaveAttribute('href', '/reset-password');
    expect(screen.getByRole('link', { name: 'Zarejestruj się' })).toHaveAttribute('href', '/register');
  });

  it('wywołuje handleSubmit po kliknięciu przycisku', () => {
    render(<LoginForm />);
    fireEvent.submit(screen.getByRole('button', { name: 'Zaloguj' }).closest('form')!);
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('wywołuje handleChange po wpisaniu w pole login', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('Login'), { target: { value: 'test@example.com' } });
    expect(mockHandleChange).toHaveBeenCalled();
  });
});