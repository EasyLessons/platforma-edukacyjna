'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

import { registerUser, checkUser } from '../api/auth-api';
import type { RegisterFormData, RegisterErrors } from '../types';
import { useAuth } from '@/app/context/AuthContext';

export function RegisterForm() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Nasłuchuj na wiadomości z Google OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Sprawdź origin dla bezpieczeństwa
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        const { token, userData } = event.data;
        
        console.log('✅ register-form: GOOGLE_AUTH_SUCCESS!', userData);
        
        // Użyj AuthContext.login() - to robi wszystko prawidłowo
        authLogin(token, userData);
        
        console.log('✅ authLogin() wywołany! Przekierowuję...');
        
        // Przekieruj natychmiast
        window.location.href = '/dashboard';
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.error('❌ Błąd logowania Google:', event.data.error);
        setGeneralError('Błąd logowania przez Google. Spróbuj ponownie.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const handleGoogleLogin = () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const authUrl = `${baseUrl}/api/auth/google`;
    const width = 520;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white">
      {/* Gradient blobs - większe i bardziej widoczne */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Zielonkawy - lewy górny */}
        <div 
          className="absolute -top-20 -left-20 w-[700px] h-[700px] rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(134, 239, 172, 0.7) 0%, rgba(134, 239, 172, 0) 70%)'
          }}
        />
        
        {/* Niebieski - prawy górny */}
        <div 
          className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(147, 197, 253, 0.7) 0%, rgba(147, 197, 253, 0) 70%)'
          }}
        />
        
        {/* Żółty - lewy dół */}
        <div 
          className="absolute -bottom-32 -left-20 w-[600px] h-[600px] rounded-full opacity-35 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(253, 224, 71, 0.6) 0%, rgba(253, 224, 71, 0) 70%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 -mt-40">
        
        {/* Logo */}
        <div className="text-center mb-10">
          <Image 
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson"
            width={200}
            height={60}
            className="mx-auto"
          />
        </div>

        {/* Zarejestruj się! */}
        <h2 className="text-2xl font-light text-gray-900 text-center mb-6">
          Zarejestruj się!
        </h2>

        {/* Masz już konto */}
        <p className="text-center text-gray-600 font-light mb-8">
          Masz już konto?{' '}
          <Link
            href="/login"
            className="hover-shine text-blue-600 font-normal hover:text-blue-700 hover:underline transition-colors hover:cursor-pointer"
          >
            Zaloguj się
          </Link>
        </p>

        {/* General Error */}
        {generalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center font-light">
            {generalError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-3">
          {/* Google Sign In Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="hover-shine w-full h-10 bg-white border-2 border-gray-300 text-gray-700 font-light rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 hover:cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Kontynuuj za pomocą konta Google
            </button>
          </div>

          {/* Separator */}
          <div className="relative flex items-center py-0">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-sm font-light">lub</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          {/* Login Input */}
          <div>
            <input
              type="text"
              name="login"
              value={formData.login}
              onChange={handleChange}
              placeholder="Login"
              className="w-full h-10 px-4 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
            />
            {errors.login && (
              <p className="mt-1 text-sm text-red-600 font-light">{errors.login}</p>
            )}
          </div>

          {/* Email Input */}
          <div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full h-10 px-4 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600 font-light">{errors.email}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Hasło"
                className="w-full h-10 px-4 pr-12 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
              >
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600 font-light">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Powtórz hasło"
                className="w-full h-10 px-4 pr-12 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
              >
                {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600 font-light">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Terms & Conditions */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  setGeneralError('');
                }}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 font-light">
                Akceptuję{' '}
                <Link
                  href="/regulamin"
                  className="hover-shine text-blue-600 hover:text-blue-700 font-normal hover:underline"
                  target="_blank"
                >
                  regulamin
                </Link>{' '}
                i{' '}
                <Link
                  href="/polityka-prywatnosci"
                  className="hover-shine text-blue-600 hover:text-blue-700 font-normal hover:underline"
                  target="_blank"
                >
                  politykę prywatności
                </Link>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="hover-shine w-full h-10 bg-gray-900 text-white font-light rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
          >
            {isLoading ? 'Rejestracja...' : 'Zarejestruj się'}
          </button>
        </form>
      </div>

      {/* Help text at bottom */}
      <div className="absolute bottom-30 left-0 right-0 text-center ">
        <Link 
          href="#"
          className="hover-shine text-sm text-gray-600 font-light hover:text-gray-900 hover:underline transition-colors hover:cursor-pointer"
        >
          Potrzebujesz pomocy?
        </Link>
      </div>
    </div>
  );
}