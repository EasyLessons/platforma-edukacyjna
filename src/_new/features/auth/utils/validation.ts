/**
 * VALIDATION UTILS
 *
 * Zbiór współdzielonych funkcji walidacyjnych dla formularzy
 * związanych z autoryzacją (logowanie, rejestracja, resetowanie hasła).
 *
 * Każda funkcja zwraca obiekt z polem `valid` (boolean)
 * oraz opcjonalnym polem `error` (string)
 */

// Walidacja emaila
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    return { valid: false, error: 'Email jest wymagany' };
  }
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Nieprawidłowy format email' };
  }
  return { valid: true };
};

// Walidacja hasła
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password) {
    return { valid: false, error: 'Hasło jest wymagane' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Hasło musi mieć co najmniej 6 znaków' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Hasło musi zawierać małą literę' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Hasło musi zawierać wielką literę' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Hasło musi zawierać cyfrę' };
  }
  if (/\s/.test(password)) {
    return { valid: false, error: 'Hasło nie może zawierać spacji' };
  }
  return { valid: true };
};

export const validatePasswordsMatch = (
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } => {
  if (!confirmPassword) {
    return { valid: false, error: 'Potwierdzenie hasła jest wymagane' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Hasła nie są zgodne' };
  }
  return { valid: true };
};

// Walidacja loginu
export const validateLogin = (login: string): { valid: boolean; error?: string } => {
  if (!login) {
    return { valid: false, error: 'Login jest wymagany' };
  }
  if (login.trim().length < 3) {
    return { valid: false, error: 'Login musi mieć co najmniej 3 znaki' };
  }
  return { valid: true };
};
