/**
 * REGISTER HOOK
 *
 * Logika formularza rejestracji oddzielona od UI.
 * Zawiera:
 *  - useState'y do Inputów i Errorów
 *  - handlery do obsługi zmian zawartości Inputów, obsługę Submit'a itp.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser, checkUser } from '../api/auth-api';
import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  validateLogin,
} from '../utils/validation';
import type { RegisterFormData, RegisterErrors } from '../types';

export function useRegister() {
  const router = useRouter();

  // STATE
  const [formData, setFormData] = useState<RegisterFormData>({
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // VALIDATION
  const validateForm = (): boolean => {
    const newErrors: RegisterErrors = {};
    let isValid = true;

    // Login validation
    const loginValidation = validateLogin(formData.login);
    if (!loginValidation.valid) {
      newErrors.login = loginValidation.error;
      isValid = false;
    }

    // Email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
      isValid = false;
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
      isValid = false;
    }

    // Passwords match validation
    const passwordsMatchValidation = validatePasswordsMatch(
      formData.password,
      formData.confirmPassword
    );
    if (!passwordsMatchValidation.valid) {
      newErrors.confirmPassword = passwordsMatchValidation.error;
      isValid = false;
    }

    // Terms acceptance
    if (!acceptTerms) {
        setGeneralError('Musisz zaakceptować regulamin');
        isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // HANDLERS
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setGeneralError('');
  };

  const handleTermsChange = (checked: boolean) => {
    setAcceptTerms(checked);
    setGeneralError('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      // Call API
      const response = await registerUser({
        login: formData.login,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      // Redirect to verification
      router.push(
        `/weryfikacja?userId=${response.user_id}&email=${encodeURIComponent(formData.email)}`
      );
    } catch (error: any) {
      setIsLoading(false);

      // Handle "Email zajęty" error
      if (error.message.includes('Email zajęty')) {
        try {
          const checkData = await checkUser(formData.email);

          if (checkData.verified) {
            // Account verified - redirect to login
            setGeneralError('To konto już istnieje. Przejdź do logowania.');
          } else {
            // Account not verified - resend code
            router.push(
              `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`
            );
          }
        } catch (checkError) {
          setGeneralError('Email już zajęty');
        }
      } else {
        setGeneralError(error.message || 'Błąd rejestracji');
      }
    }
  };

  return {
    // State
    formData,
    errors,
    isLoading,
    generalError,
    acceptTerms,

    // Handlers
    handleChange,
    handleTermsChange,
    handleSubmit,
  };
}
