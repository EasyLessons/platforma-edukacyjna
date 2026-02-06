'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { registerUser, checkUser } from '../api/auth-api';
import type { RegisterFormData, RegisterErrors } from '../types';

export function RegisterForm() {
  const router = useRouter();

  // ============================================================================
  // STATE
  // ============================================================================

  const [formData, setFormData] = useState<RegisterFormData>({
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<RegisterErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: RegisterErrors = {};

    // Login validation
    if (!formData.login.trim()) {
      newErrors.login = 'Login jest wymagany';
      isValid = false;
    } else if (formData.login.trim().length < 3) {
      newErrors.login = 'Login musi mieć co najmniej 3 znaki';
      isValid = false;
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email jest wymagany';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Nieprawidłowy format email';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Hasło jest wymagane';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Hasło musi mieć co najmniej 8 znaków';
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Hasło musi zawierać małą i wielką literę oraz cyfrę';
      isValid = false;
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Potwierdzenie hasła jest wymagane';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Hasła nie są identyczne';
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

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
    setGeneralError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
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

      console.log('✅ Użytkownik zarejestrowany! User ID:', response.user_id);
      console.log('📧 Kod wysłany na email:', formData.email);

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
            console.log('📧 Konto istnieje ale niezweryfikowane. Nowy kod wysłany.');
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

      console.error('❌ Błąd rejestracji:', error);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-2xl font-semibold">Dołącz do nas!</h2>
      </div>

      {/* Form */}
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Zarejestruj się
        </h1>

        <p className="text-center text-gray-600 mb-6">Utwórz nowe konto</p>

        {/* General Error */}
        {generalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
            {generalError}
          </div>
        )}

        {/* Login Input */}
        <Input
          label="Login"
          type="text"
          name="login"
          value={formData.login}
          onChange={handleChange}
          placeholder="User123"
          leftIcon={<User className="w-5 h-5" />}
          error={errors.login}
          wrapperClassName="mb-4"
        />

        {/* Email Input */}
        <Input
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="nazwa@example.com"
          leftIcon={<Mail className="w-5 h-5" />}
          error={errors.email}
          wrapperClassName="mb-4"
        />

        {/* Password Input */}
        <Input
          label="Hasło"
          type={showPassword ? 'text' : 'password'}
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          leftIcon={<Lock className="w-5 h-5" />}
          rightIcon={showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          onRightIconClick={() => setShowPassword(!showPassword)}
          error={errors.password}
          wrapperClassName="mb-4"
        />

        {/* Confirm Password Input */}
        <Input
          label="Powtórz hasło"
          type={showConfirmPassword ? 'text' : 'password'}
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="••••••••"
          leftIcon={<Lock className="w-5 h-5" />}
          rightIcon={
            showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />
          }
          onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
          error={errors.confirmPassword}
          wrapperClassName="mb-4"
        />

        {/* Terms & Conditions */}
        <div className="mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                setGeneralError('');
              }}
              className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
            />
            <span className="text-sm text-gray-600 group-hover:text-gray-800">
              Akceptuję{' '}
              <Link
                href="/regulamin"
                className="text-green-600 hover:text-green-700 font-medium hover:underline"
                target="_blank"
              >
                regulamin
              </Link>{' '}
              i{' '}
              <Link
                href="/polityka-prywatnosci"
                className="text-green-600 hover:text-green-700 font-medium hover:underline"
                target="_blank"
              >
                politykę prywatności
              </Link>
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <Button type="submit" loading={isLoading} className="w-full mb-5">
          {isLoading ? 'Rejestracja...' : 'Zarejestruj się'}
        </Button>

        {/* Login Link */}
        <div className="text-center text-gray-600">
          Masz już konto?{' '}
          <Link
            href="/login"
            className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors duration-200"
          >
            Zaloguj się
          </Link>
        </div>
      </form>
    </div>
  );
}