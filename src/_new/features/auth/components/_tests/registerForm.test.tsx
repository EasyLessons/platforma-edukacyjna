import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegisterForm } from '../registerForm';

const mockHandleChange = vi.fn();
const mockHandleTermsChange = vi.fn();
const mockHandleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

let mockHookReturn = {
  formData: { username: '', email: '', password: '', password_confirm: '' },
  errors: {} as Record<string, string>,
  isLoading: false,
  generalError: '',
  acceptTerms: false,
  handleChange: mockHandleChange,
  handleTermsChange: mockHandleTermsChange,
  handleSubmit: mockHandleSubmit,
};

vi.mock('../../hooks/useRegister', () => ({ useRegister: () => mockHookReturn }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe('RegisterForm', () => {
  it('renderuje wszystkie pola formularza', () => {
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('••••••••')).toHaveLength(2);
  });

  it('renderuje checkbox regulaminu', () => {
    render(<RegisterForm />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renderuje link do logowania', () => {
    render(<RegisterForm />);
    expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/login');
  });

  it('wyświetla generalError gdy jest ustawiony', () => {
    mockHookReturn = { ...mockHookReturn, generalError: 'Musisz zaakceptować regulamin' };
    render(<RegisterForm />);
    expect(screen.getByText('Musisz zaakceptować regulamin')).toBeInTheDocument();
  });

  it('wywołuje handleSubmit po submitcie formularza', () => {
    render(<RegisterForm />);
    fireEvent.submit(screen.getByRole('button', { name: 'Zarejestruj' }).closest('form')!);
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('wywołuje handleTermsChange po kliknięciu checkboxa', () => {
    render(<RegisterForm />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mockHandleTermsChange).toHaveBeenCalledWith(true);
  });
});