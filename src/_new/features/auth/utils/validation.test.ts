import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  validateUsername,
} from './validation';

describe('validateEmail', () => {
  it('zwraca błąd dla pustego stringa', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'Email jest wymagany' });
  });

  it('zwraca błąd dla braku domeny', () => {
    expect(validateEmail('user@')).toEqual({ valid: false, error: 'Nieprawidłowy format email' });
  });

  it('zwraca błąd dla braku @', () => {
    expect(validateEmail('notanemail')).toEqual({ valid: false, error: 'Nieprawidłowy format email' });
  });

  it('zwraca błąd dla braku TLD', () => {
    expect(validateEmail('user@domain')).toEqual({ valid: false, error: 'Nieprawidłowy format email' });
  });

  it('zwraca valid: true dla poprawnego emaila', () => {
    expect(validateEmail('user@domain.com')).toEqual({ valid: true });
  });

  it('zwraca valid: true dla emaila z tagiem', () => {
    expect(validateEmail('user+tag@sub.domain.org')).toEqual({ valid: true });
  });
});

describe('validatePassword', () => {
  it('zwraca błąd dla pustego stringa', () => {
    expect(validatePassword('')).toEqual({ valid: false, error: 'Hasło jest wymagane' });
  });

  it('zwraca błąd gdy hasło za krótkie', () => {
    expect(validatePassword('Ab1')).toEqual({ valid: false, error: 'Hasło musi mieć co najmniej 6 znaków' });
  });

  it('zwraca błąd gdy brak małej litery', () => {
    expect(validatePassword('ABCDEF1')).toEqual({ valid: false, error: 'Hasło musi zawierać małą literę' });
  });

  it('zwraca błąd gdy brak wielkiej litery', () => {
    expect(validatePassword('abcdef1')).toEqual({ valid: false, error: 'Hasło musi zawierać wielką literę' });
  });

  it('zwraca błąd gdy brak cyfry', () => {
    expect(validatePassword('Abcdefgh')).toEqual({ valid: false, error: 'Hasło musi zawierać cyfrę' });
  });

  it('zwraca błąd gdy hasło zawiera spację', () => {
    expect(validatePassword('Valid Pass1')).toEqual({ valid: false, error: 'Hasło nie może zawierać spacji' });
  });

  it('zwraca valid: true dla poprawnego hasła', () => {
    expect(validatePassword('Valid1pass')).toEqual({ valid: true });
  });
});

describe('validatePasswordsMatch', () => {
  it('zwraca błąd gdy potwierdzenie jest puste', () => {
    expect(validatePasswordsMatch('abc', '')).toEqual({
      valid: false,
      error: 'Potwierdzenie hasła jest wymagane',
    });
  });

  it('zwraca błąd gdy hasła się różnią', () => {
    expect(validatePasswordsMatch('abc', 'xyz')).toEqual({
      valid: false,
      error: 'Hasła nie są zgodne',
    });
  });

  it('zwraca valid: true gdy hasła są zgodne', () => {
    expect(validatePasswordsMatch('abc', 'abc')).toEqual({ valid: true });
  });
});

describe('validateUsername', () => {
  it('zwraca błąd dla pustego stringa', () => {
    expect(validateUsername('')).toEqual({ valid: false, error: 'Login jest wymagany' });
  });

  it('zwraca błąd gdy username za krótki', () => {
    expect(validateUsername('ab')).toEqual({ valid: false, error: 'Login musi mieć co najmniej 3 znaki' });
  });

  it('zwraca błąd gdy po trimie za krótki', () => {
    expect(validateUsername('  x  ')).toEqual({ valid: false, error: 'Login musi mieć co najmniej 3 znaki' });
  });

  it('zwraca valid: true dla poprawnego loginu', () => {
    expect(validateUsername('alice')).toEqual({ valid: true });
  });
});