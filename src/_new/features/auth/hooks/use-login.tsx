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
import { loginUser, checkUser } from '../api/auth-api';
import { validateEmail, validatePassword } from '../utils/validation';
import type { LoginFormData, LoginErrors } from '../types';

export function useLogin() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  // STATE
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<LoginErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // VALIDATION
  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};
    let isValid = true;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      // Call login API
      const response = await loginUser({
        login: formData.email,
        password: formData.password,
      });

      // Update auth context
      authLogin(response.access_token, response.user);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      // To do dupy. Trzeba stworzyć system Errorów API
      setIsLoading(false);

      if (error.message.includes('niezweryfikowane')) {
        try {
          const checkData = await checkUser(formData.email);

          if (!checkData.verified && checkData.user_id) {
            router.push(
              `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`
            );
            return;
          } else {
            setGeneralError('Konto niezweryfikowane. Sprawdź email.');
          }
        } catch (checkError) {
          setGeneralError('Konto niezweryfikowane. Sprawdź email lub zarejestruj się ponownie.');
        }
      } else {
        setGeneralError(error.message || 'Błędny email lub hasło');
      }
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
