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
import { registerUser, checkUser } from '../api/authApi';
import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  validateUsername,
} from '../utils/validation';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import { AppError } from '@/_new/lib/errors';
import type { RegisterFormData, FormErrors } from '../types';

export function useRegister() {
  const router = useRouter();

  // STATE
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const [errors, setErrors] = useState<FormErrors<RegisterFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const { handleError, isError } = useErrorHandler({
    onError: setGeneralError,
  });

  // VALIDATION
  const validateForm = (): boolean => {
    const newErrors: FormErrors<RegisterFormData> = {};

    // Username validation
    const usernameValidation = validateUsername(formData.username);
    if (!usernameValidation.valid) {
      newErrors.username = usernameValidation.error;
    }

    // Email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
    }

    // Passwords match validation
    const passwordsMatchValidation = validatePasswordsMatch(
      formData.password,
      formData.password_confirm
    );
    if (!passwordsMatchValidation.valid) {
      newErrors.password_confirm = passwordsMatchValidation.error;
    }

    // Terms acceptance
    if (!acceptTerms) {
      setGeneralError('Musisz zaakceptować regulamin');
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
  };

  const handleConflict = async () => {
    try {
      const checkData = await checkUser(formData.email);
      if (checkData.verified) {
        setGeneralError('To konto już istnieje. Przejdź do logowania.');
      } else {
        router.push(
          `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`
        );
      }
    } catch {
      handleError(new AppError('Email już zajęty', 'CONFLICT', 409));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      const response = await registerUser(formData);
      router.push(
        `/weryfikacja?userId=${response.user_id}&email=${encodeURIComponent(formData.email)}`
      );
    } catch (err) {
      setIsLoading(false);
      if (isError(err, 'CONFLICT')) {
        await handleConflict();
        return;
      }
      await handleError(err);
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
