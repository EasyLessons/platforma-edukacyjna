/**
 * LOGIN HOOK
 *
 * Logika formularza logowania oddzielona od UI.
 * Zawiera:
 *  - useState'y do Inputów i Errorów
 *  - handlery do obsługi zmian zawartości Inputów i obsługę Submit'a
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { loginUser, checkUser } from '../api/authApi';
import { validateEmail, validatePassword } from '../utils/validation';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { LoginFormData, FormErrors } from '../types';

export function useLogin() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  // STATE
  const [formData, setFormData] = useState<LoginFormData>({
    login: '',
    password: '',
  });

  const [errors, setErrors] = useState<FormErrors<LoginFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { handleError } = useErrorHandler({
    onError: setGeneralError,
    onForbidden: async () => {
      try {
        const checkData = await checkUser(formData.login);
        if (!checkData.verified && checkData.user_id) {
          router.push(
            `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.login)}`
          );
          return;
        }
      } catch {}
      setGeneralError('Konto niezweryfikowane. Sprawdź email.');
    },
  });

  // VALIDATION
  const validateForm = (): boolean => {
    const newErrors: FormErrors<LoginFormData> = {};

    // Email validation
    const emailValidation = validateEmail(formData.login);
    if (!emailValidation.valid) {
      newErrors.login = emailValidation.error;
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      const response = await loginUser({
        login: formData.login,
        password: formData.password,
      });
      authLogin(response.access_token, response.user);
      router.push('/dashboard');
    } catch (err) {
      setIsLoading(false);
      await handleError(err);
    }
  };

  return {
    // State
    formData,
    errors,
    isLoading,
    generalError,
    // Handlers
    handleChange,
    handleSubmit,
  };
}
